from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from extensions import db
from models import Patient, Medication, MedicationLog, User, Notification
from sqlalchemy import func
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
import bcrypt
from sms import sms_account_created
from utils import log_action

patients_bp = Blueprint('patients', __name__)
patients_bp.strict_slashes = False


# ─────────────────────────────────────────────
# Helper: Auto-remove overdue medications inline
# Mirrors scheduler.handle_overdue_medications but runs on every GET
# so patients/doctors don't wait until the 7 AM job.
# ─────────────────────────────────────────────
def _auto_remove_overdue_medications(patients_list):
    """
    Marks active medications whose refill_date is strictly 3+ days in the past
    as completed=True, sends SMS and in-app notifications (deduplicated — once
    per medication per day), then recalculates adherence + status for affected
    patients from the database so numbers are immediately correct.

    Only medications that are 3+ days past their refill_date are removed.
    Medications with no refill_date, or whose refill_date is within the last
    2 days (or in the future), are left completely untouched.
    """
    from config import Config

    today        = datetime.now(ZoneInfo("Africa/Nairobi")).date()
    cutoff       = today - timedelta(days=3)   # strictly MORE than 3 days overdue
    changed      = False
    affected_ids = set()

    for patient in patients_list:
        for med in list(patient.medications):   # list() snapshot — safe to iterate while marking
            if med.completed:
                continue
            if med.refill_date is None:
                continue
            if med.refill_date > cutoff:        # 0-2 days overdue → leave alone
                continue

            days_overdue = (today - med.refill_date).days
            med.completed = True
            changed = True
            affected_ids.add(patient.id)

            # ── Deduplicate: skip notifications already sent today ────────
            already_patient = patient.user_id and Notification.query.filter(
                Notification.user_id == patient.user_id,
                Notification.title == f'Medication Removed — {med.name}',
                func.date(Notification.created_at) == today
            ).first()

            if not already_patient:
                if patient.user_id:
                    db.session.add(Notification(
                        user_id=patient.user_id,
                        title=f'Medication Removed — {med.name}',
                        message=(
                            f'Your medication {med.name} {med.dosage} has been removed '
                            f'from your active list as the refill date passed {days_overdue} '
                            f'day{"s" if days_overdue != 1 else ""} ago. '
                            f'Please contact your doctor if you still require it.'
                        ),
                        type='alert'
                    ))
                if Config.SMS_ENABLED and patient.phone:
                    from sms import sms_medication_overdue_removed
                    sms_medication_overdue_removed(
                        patient_name=patient.name,
                        phone=patient.phone,
                        medication_name=med.name,
                        dosage=med.dosage,
                        days_overdue=days_overdue
                    )

            already_doctor = patient.assigned_doctor_id and Notification.query.filter(
                Notification.user_id == patient.assigned_doctor_id,
                Notification.title == f'Overdue Medication Auto-Removed — {patient.name}',
                func.date(Notification.created_at) == today
            ).first()

            if not already_doctor and patient.assigned_doctor_id:
                db.session.add(Notification(
                    user_id=patient.assigned_doctor_id,
                    title=f'Overdue Medication Auto-Removed — {patient.name}',
                    message=(
                        f'{med.name} {med.dosage} prescribed to {patient.name} '
                        f'was automatically removed after being {days_overdue} '
                        f'day{"s" if days_overdue != 1 else ""} past its refill date '
                        f'without a refill or completion. Please review and re-prescribe if needed.'
                    ),
                    type='alert'
                ))

    if not changed:
        return

    # Flush so completed=True is persisted to the DB before we re-query
    db.session.flush()

    # ── Recalculate adherence from the DB (not the stale ORM list) ──────────
    # We re-query active med IDs directly so we don't rely on the in-memory
    # relationship list which SQLAlchemy may not have fully refreshed yet.
    start_date = today - timedelta(days=30)
    for patient in patients_list:
        if patient.id not in affected_ids:
            continue

        active_med_ids = [
            m.id for m in
            Medication.query.filter_by(patient_id=patient.id, completed=False).all()
        ]

        if not active_med_ids:
            patient.adherence_rate = 100.0
        else:
            logs = MedicationLog.query.filter(
                MedicationLog.patient_id == patient.id,
                MedicationLog.medication_id.in_(active_med_ids),
                MedicationLog.date >= start_date
            ).all()
            if logs:
                taken = sum(1 for l in logs if l.taken)
                patient.adherence_rate = round((taken / len(logs)) * 100, 2)
            else:
                patient.adherence_rate = 100.0

        adherence = float(patient.adherence_rate)
        if adherence >= 80:
            patient.status = 'stable'
        elif adherence >= 50:
            patient.status = 'warning'
        else:
            patient.status = 'critical'

    db.session.commit()


@patients_bp.before_request
def allow_preflight():
    if request.method == "OPTIONS":
        return '', 200


# ─────────────────────────────────────────────
# Helper: Determine Status
# ─────────────────────────────────────────────
def determine_status(hba1c: float, blood_sugars: list, adherence: float) -> str:
    if (
        hba1c >= 9
        or any(bs > 250 for bs in blood_sugars)
        or adherence < 50
    ):
        return "critical"

    if (
        hba1c >= 7
        or any(bs > 180 for bs in blood_sugars)
        or adherence < 80
    ):
        return "warning"

    return "stable"


# ─────────────────────────────────────────────
# Helper: Calculate Adherence (30-Day Rolling)
# Only counts logs for active (non-completed) medications so that
# auto-removed overdue meds don't permanently drag the score down.
# ─────────────────────────────────────────────
def calculate_adherence(patient: Patient, days: int = 30) -> float:
    kenya_now = datetime.now(ZoneInfo("Africa/Nairobi"))
    start_date = kenya_now.date() - timedelta(days=days)

    # Get IDs of active medications only
    active_med_ids = [m.id for m in patient.medications if not m.completed]

    if not active_med_ids:
        return 100.0

    logs = MedicationLog.query.filter(
        MedicationLog.patient_id == patient.id,
        MedicationLog.medication_id.in_(active_med_ids),
        MedicationLog.date >= start_date
    ).all()

    if not logs:
        return 100.0

    taken_count = sum(1 for log in logs if log.taken)
    return round((taken_count / len(logs)) * 100, 2)


# ─────────────────────────────────────────────
# GET Patients
# ─────────────────────────────────────────────
@patients_bp.route('', methods=['GET'])
@patients_bp.route('/', methods=['GET'])
@jwt_required()
def get_patients():
    user_id = int(get_jwt_identity())
    role = get_jwt().get('role', 'patient')

    if role == 'admin':
        patients = Patient.query.order_by(Patient.created_at.desc()).all()
    elif role == 'doctor':
        patients = Patient.query.filter_by(
            assigned_doctor_id=user_id
        ).order_by(Patient.created_at.desc()).all()
    else:
        patients = Patient.query.filter_by(user_id=user_id).all()

    kenya_today = datetime.now(ZoneInfo("Africa/Nairobi")).date()

    # Auto-remove any medications overdue by 3+ days before returning data
    _auto_remove_overdue_medications(patients)

    for p in patients:
        for med in p.medications:
            if med.completed:
                continue
            today_log = MedicationLog.query.filter_by(
                patient_id=p.id,
                medication_id=med.id,
                date=kenya_today
            ).first()
            med.taken_today = today_log.taken if today_log else False

        p.adherence_rate = calculate_adherence(p)
        p.status = determine_status(float(p.hba1c), [], p.adherence_rate)

    return jsonify([p.to_dict(include_medications=True) for p in patients]), 200


# ─────────────────────────────────────────────
# GET Single Patient
# ─────────────────────────────────────────────
@patients_bp.route('/<int:patient_id>', methods=['GET'])
@jwt_required()
def get_patient(patient_id):
    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    kenya_today = datetime.now(ZoneInfo("Africa/Nairobi")).date()

    # Auto-remove any medications overdue by 3+ days before returning data
    _auto_remove_overdue_medications([patient])

    for med in patient.medications:
        if med.completed:
            continue
        today_log = MedicationLog.query.filter_by(
            patient_id=patient.id,
            medication_id=med.id,
            date=kenya_today
        ).first()
        med.taken_today = today_log.taken if today_log else False

    patient.adherence_rate = calculate_adherence(patient)
    patient.status = determine_status(float(patient.hba1c), [], patient.adherence_rate)

    return jsonify(patient.to_dict(include_medications=True)), 200


# ─────────────────────────────────────────────
# CREATE Patient (Admin / Doctor Only)
# ─────────────────────────────────────────────
@patients_bp.route('', methods=['POST'])
@patients_bp.route('/', methods=['POST'])
@jwt_required()
def create_patient():
    current_user_id = int(get_jwt_identity())
    role = get_jwt().get('role')

    if role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()

    required_fields = ['name', 'username', 'password', 'age', 'gender', 'diabetes_type', 'email']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    try:
        age = int(data['age'])
        blood_sugar = float(data.get('blood_sugar', 0))
        hba1c = float(data.get('hba1c', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid numeric values'}), 400

    existing_user = User.query.filter(
        (User.username == data['username']) |
        (User.email == data['email'])
    ).first()

    if existing_user:
        return jsonify({'error': 'Username or email already exists'}), 409

    password_hash = bcrypt.hashpw(
        data['password'].encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    if role == 'doctor':
        assigned_doctor_id = current_user_id
    else:
        doctor_counts = (
            db.session.query(User.id, func.count(Patient.id))
            .outerjoin(Patient, Patient.assigned_doctor_id == User.id)
            .filter(User.role == 'doctor')
            .group_by(User.id)
            .order_by(func.count(Patient.id))
            .all()
        )
        if not doctor_counts:
            return jsonify({'error': 'No doctors available'}), 400
        assigned_doctor_id = doctor_counts[0][0]

    try:
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=password_hash,
            role='patient',
            full_name=data['name'],
            phone=data.get('phone', '')
        )
        db.session.add(user)
        db.session.flush()

        status = determine_status(hba1c, [], 100.0)

        patient = Patient(
            user_id=user.id,
            name=data['name'],
            age=age,
            gender=data['gender'],
            diabetes_type=data['diabetes_type'],
            phone=data.get('phone', ''),
            email=data['email'],
            blood_sugar=blood_sugar,
            hba1c=hba1c,
            status=status,
            adherence_rate=100,
            assigned_doctor_id=assigned_doctor_id
        )
        db.session.add(patient)
        db.session.flush()

        log_action(
            current_user_id,
            'Create Patient',
            f'Patient #{patient.id} — {data["name"]}',
            f'Registered new patient {data["name"]} ({data["diabetes_type"]}, age {age})',
            request
        )
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

    phone = data.get('phone', '')
    if phone:
        sms_account_created(
            full_name=data['name'],
            phone=phone,
            username=data['username'],
            password=data['password'],
            role='patient'
        )

    return jsonify({
        'message': 'Patient created successfully',
        'patient_id': patient.id,
        'user_id': user.id
    }), 201


# ─────────────────────────────────────────────
# UPDATE Patient (Admin / Doctor Only)
# ─────────────────────────────────────────────
@patients_bp.route('/<int:patient_id>', methods=['PUT'])
@jwt_required()
def update_patient(patient_id):
    current_user_id = int(get_jwt_identity())
    role = get_jwt().get('role')

    if role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    if role == 'doctor' and patient.assigned_doctor_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()

    allowed_fields = [
        'name', 'age', 'gender', 'diabetes_type',
        'phone', 'email', 'blood_sugar',
        'hba1c', 'last_visit', 'next_visit'
    ]

    for field in allowed_fields:
        if field in data:
            setattr(patient, field, data[field])

    if 'blood_sugar' in data or 'hba1c' in data:
        patient.adherence_rate = calculate_adherence(patient)
        patient.status = determine_status(float(patient.hba1c), [], patient.adherence_rate)

    patient.adherence_rate = calculate_adherence(patient)

    if patient.user_id:
        user = User.query.get(patient.user_id)

        if 'username' in data:
            existing = User.query.filter(
                User.username == data['username'],
                User.id != user.id
            ).first()
            if existing:
                return jsonify({'error': 'Username already exists'}), 409
            user.username = data['username']

        if 'email' in data:
            existing = User.query.filter(
                User.email == data['email'],
                User.id != user.id
            ).first()
            if existing:
                return jsonify({'error': 'Email already exists'}), 409
            user.email = data['email']

        if 'password' in data and data['password']:
            user.password_hash = bcrypt.hashpw(
                data['password'].encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')

        user.full_name = patient.name

    log_action(
        current_user_id,
        'Update Patient',
        f'Patient #{patient_id} — {patient.name}',
        f'Updated medical records for {patient.name}',
        request
    )
    db.session.commit()
    return jsonify({'message': 'Patient updated successfully'}), 200


# ─────────────────────────────────────────────
# DELETE Patient (Admin Only)
# ─────────────────────────────────────────────
@patients_bp.route('/<int:patient_id>', methods=['DELETE'])
@jwt_required()
def delete_patient(patient_id):
    current_user_id = int(get_jwt_identity())
    role = get_jwt().get('role')

    if role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    patient_name = patient.name

    log_action(
        current_user_id,
        'Delete Patient',
        f'Patient #{patient_id} — {patient_name}',
        f'Deleted patient record for {patient_name}',
        request
    )

    db.session.delete(patient)
    db.session.commit()
    return jsonify({'message': 'Patient deleted successfully'}), 200

# ─────────────────────────────────────────────
# REASSIGN Patient to Another Doctor (Admin Only)
# ─────────────────────────────────────────────
@patients_bp.route('/<int:patient_id>/reassign', methods=['PUT'])
@jwt_required()
def reassign_patient(patient_id):
    current_user_id = int(get_jwt_identity())
    role = get_jwt().get('role')

    if role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    patient = Patient.query.get(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    data = request.get_json()
    new_doctor_id = data.get('doctor_id')

    if new_doctor_id is None:
        return jsonify({'error': 'doctor_id is required'}), 400

    # Validate doctor exists and has doctor role
    doctor = User.query.get(new_doctor_id)
    if not doctor or doctor.role != 'doctor':
        return jsonify({'error': 'Invalid doctor — user not found or not a doctor'}), 404

    old_doctor = User.query.get(patient.assigned_doctor_id) if patient.assigned_doctor_id else None
    old_doctor_name = old_doctor.full_name if old_doctor else 'Unassigned'

    patient.assigned_doctor_id = new_doctor_id

    log_action(
        current_user_id,
        'Reassign Patient',
        f'Patient #{patient_id} — {patient.name}',
        f'Reassigned {patient.name} from {old_doctor_name} to Dr. {doctor.full_name}',
        request
    )

    # Notify the new doctor
    from models import Notification
    db.session.add(Notification(
        user_id=new_doctor_id,
        title='New Patient Assigned',
        message=f'{patient.name} has been reassigned to you by admin.',
        type='info'
    ))

    # Notify patient
    if patient.user_id:
        db.session.add(Notification(
            user_id=patient.user_id,
            title='Doctor Reassigned',
            message=f'Your care has been transferred to Dr. {doctor.full_name}.',
            type='info'
        ))

    db.session.commit()

    # SMS: notify patient and new doctor
    from config import Config
    if Config.SMS_ENABLED:
        from sms import sms_patient_reassigned, sms_doctor_new_patient
        if patient.phone:
            sms_patient_reassigned(
                patient_name=patient.name,
                phone=patient.phone,
                new_doctor_name=doctor.full_name,
                old_doctor_name=old_doctor_name
            )
        if doctor.phone:
            sms_doctor_new_patient(
                doctor_name=doctor.full_name,
                phone=doctor.phone,
                patient_name=patient.name,
                patient_age=patient.age,
                diabetes_type=patient.diabetes_type,
                old_doctor_name=old_doctor_name
            )

    return jsonify({
        'message': f'{patient.name} successfully reassigned to Dr. {doctor.full_name}',
        'patient': patient.to_dict()
    }), 200


# ─────────────────────────────────────────────
# BULK REASSIGN — move all patients from one doctor to another
# ─────────────────────────────────────────────
@patients_bp.route('/reassign-bulk', methods=['PUT'])
@jwt_required()
def reassign_bulk():
    current_user_id = int(get_jwt_identity())
    role = get_jwt().get('role')

    if role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    from_doctor_id = data.get('from_doctor_id')
    to_doctor_id   = data.get('to_doctor_id')

    if not from_doctor_id or not to_doctor_id:
        return jsonify({'error': 'from_doctor_id and to_doctor_id are required'}), 400

    if from_doctor_id == to_doctor_id:
        return jsonify({'error': 'Source and target doctor must be different'}), 400

    to_doctor = User.query.get(to_doctor_id)
    if not to_doctor or to_doctor.role != 'doctor':
        return jsonify({'error': 'Target doctor not found or not a doctor'}), 404

    from_doctor = User.query.get(from_doctor_id)
    from_doctor_name = from_doctor.full_name if from_doctor else f'Doctor #{from_doctor_id}'

    patients = Patient.query.filter_by(assigned_doctor_id=from_doctor_id).all()
    count = len(patients)

    from models import Notification
    for p in patients:
        p.assigned_doctor_id = to_doctor_id
        db.session.add(Notification(
            user_id=to_doctor_id,
            title='New Patient Assigned',
            message=f'{p.name} has been reassigned to you from Dr. {from_doctor_name}.',
            type='info'
        ))
        if p.user_id:
            db.session.add(Notification(
                user_id=p.user_id,
                title='Doctor Reassigned',
                message=f'Your care has been transferred to Dr. {to_doctor.full_name}.',
                type='info'
            ))

    log_action(
        current_user_id,
        'Bulk Reassign',
        f'{count} patients from Dr. {from_doctor_name}',
        f'Bulk reassigned {count} patients from Dr. {from_doctor_name} to Dr. {to_doctor.full_name}',
        request
    )

    db.session.commit()

    # SMS: notify each patient and the new doctor once
    from config import Config
    if Config.SMS_ENABLED:
        from sms import sms_patient_reassigned, sms_doctor_new_patient
        for p in patients:
            if p.phone:
                sms_patient_reassigned(
                    patient_name=p.name,
                    phone=p.phone,
                    new_doctor_name=to_doctor.full_name,
                    old_doctor_name=from_doctor_name
                )
        # Notify the new doctor once with a summary
        if to_doctor.phone and count > 0:
            from sms import send_sms
            send_sms(
                to_doctor.phone,
                f"Dear Dr. {to_doctor.full_name}, {count} patient(s) have been reassigned to you "
                f"from Dr. {from_doctor_name}. Please log in to DiabeCare to review them. - DiabeCare",
                category="doctor_bulk_reassign",
                recipient_name=to_doctor.full_name,
                recipient_role="doctor"
            )

    return jsonify({
        'message': f'{count} patient(s) reassigned to Dr. {to_doctor.full_name}',
        'count': count
    }), 200