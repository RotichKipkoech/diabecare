from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from extensions import db
from models import Medication, MedicationLog, Patient, Notification, User
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from utils import log_action
from sms import sms_refill_reminder

medications_bp = Blueprint('medications', __name__)
medications_bp.strict_slashes = False


@medications_bp.before_request
def allow_preflight():
    if request.method == "OPTIONS":
        return '', 200


# ─────────────────────────────────────────────
# Helper: Calculate Adherence (30-day rolling)
# ─────────────────────────────────────────────
def calculate_adherence(patient, days=30):
    kenya_now = datetime.now(ZoneInfo("Africa/Nairobi"))
    start_date = kenya_now.date() - timedelta(days=days)

    # Only count logs for active (non-completed) medications
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
# Helper: Update Patient Status
# ─────────────────────────────────────────────
def update_patient_status(patient):
    adherence = float(patient.adherence_rate)
    if adherence >= 80:
        patient.status = "stable"
    elif adherence >= 50:
        patient.status = "warning"
    else:
        patient.status = "critical"


# ─────────────────────────────────────────────
# GET Medications for a Patient
# ─────────────────────────────────────────────
@medications_bp.route('/patientf/<int:patient_id>', methods=['GET'])
@jwt_required()
def get_medications(patient_id):
    today  = datetime.now(ZoneInfo("Africa/Nairobi")).date()
    cutoff = today - timedelta(days=3)   # only remove meds 3+ days past refill date

    # ── Find overdue medications (strictly 3+ days past refill_date) ──────────
    overdue = Medication.query.filter(
        Medication.patient_id == patient_id,
        Medication.completed == False,
        Medication.refill_date != None,
        Medication.refill_date <= cutoff        # ≤ means 3 or more days ago
    ).all()

    if overdue:
        try:
            from config import Config
            patient = Patient.query.get(patient_id)

            for med in overdue:
                days_overdue = (today - med.refill_date).days
                med.completed = True

            # ── Deduplicate patient notification ─────────────────────────────
            already_patient = patient and patient.user_id and Notification.query.filter(
                Notification.user_id == patient.user_id,
                Notification.title == f'Medication Removed — {med.name}',
                db.func.date(Notification.created_at) == today
            ).first()

            if not already_patient:
                if patient and patient.user_id:
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
                if Config.SMS_ENABLED and patient and patient.phone:
                    from sms import sms_medication_overdue_removed
                    sms_medication_overdue_removed(
                        patient_name=patient.name,
                        phone=patient.phone,
                        medication_name=med.name,
                        dosage=med.dosage,
                        days_overdue=days_overdue
                    )

            # ── Deduplicate doctor notification ──────────────────────────────
            already_doctor = patient and patient.assigned_doctor_id and Notification.query.filter(
                Notification.user_id == patient.assigned_doctor_id,
                Notification.title == f'Overdue Medication Auto-Removed — {patient.name}',
                db.func.date(Notification.created_at) == today
            ).first()

            if not already_doctor and patient and patient.assigned_doctor_id:
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

            db.session.flush()   # persist completed=True before adherence re-query

            # ── Recalculate adherence from DB (not stale ORM list) ───────────────
            if patient:
                active_med_ids = [
                    m.id for m in
                    Medication.query.filter(
                        Medication.patient_id == patient_id,
                        Medication.completed.is_(False)
                    ).all()
                ]
                start_date = today - timedelta(days=30)
                if not active_med_ids:
                    patient.adherence_rate = 100.0
                else:
                    logs = MedicationLog.query.filter(
                        MedicationLog.patient_id == patient_id,
                        MedicationLog.medication_id.in_(active_med_ids),
                        MedicationLog.date >= start_date
                    ).all()
                    if logs:
                        taken_count = sum(1 for l in logs if l.taken)
                        patient.adherence_rate = round((taken_count / len(logs)) * 100, 2)
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
        except Exception as _med_err:
            import logging as _log
            _log.getLogger(__name__).error(f'[medications] overdue cleanup error: {_med_err}')
            db.session.rollback()

    # ── Return only active (non-completed) medications ────────────────────────
    meds = Medication.query.filter(
        Medication.patient_id == patient_id,
        Medication.completed.is_(False)
    ).all()

    result = []
    for med in meds:
        log = MedicationLog.query.filter_by(
            medication_id=med.id,
            patient_id=patient_id,
            date=today
        ).first()
        med_dict = med.to_dict()
        med_dict['taken_today'] = log.taken if log else False
        result.append(med_dict)

    return jsonify(result), 200


# ─────────────────────────────────────────────
# CREATE Medication (Doctor/Admin)
# ─────────────────────────────────────────────
@medications_bp.route('', methods=['POST'])
@medications_bp.route('/', methods=['POST'])
@jwt_required()
def create_medication():
    role = get_jwt().get('role')
    user_id = int(get_jwt_identity())

    if role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    for field in ['patient_id', 'name', 'dosage', 'frequency']:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    refill_date = None
    if data.get('refill_date'):
        try:
            refill_date = datetime.fromisoformat(
                data['refill_date'].replace('Z', '+00:00')
            ).date()
        except ValueError:
            return jsonify({'error': 'Invalid refill_date format'}), 400

    patient = Patient.query.get(data['patient_id'])
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    med = Medication(
        patient_id=data['patient_id'],
        name=data['name'],
        dosage=data['dosage'],
        frequency=data['frequency'],
        time=data.get('time', ''),
        refill_date=refill_date,
        prescribed_by=user_id
    )

    db.session.add(med)
    db.session.flush()

    log_action(
        user_id,
        'Prescribe Medication',
        f'{data["name"]} — Patient #{data["patient_id"]}',
        f'Prescribed {data["name"]} {data["dosage"]} ({data["frequency"]}) to {patient.name}',
        request
    )

    db.session.commit()
    return jsonify({'message': 'Medication prescribed', 'id': med.id}), 201


# ─────────────────────────────────────────────
# MARK Medication Taken / Missed (Patient Only)
# ─────────────────────────────────────────────
@medications_bp.route('/<int:med_id>/toggle', methods=['PUT', 'OPTIONS'])
@jwt_required()
def toggle_medication(med_id):
    role = get_jwt().get('role')
    user_id = int(get_jwt_identity())

    if role != 'patient':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    taken = data.get("taken")
    if taken is None:
        return jsonify({'error': 'taken value required'}), 400

    med = Medication.query.get(med_id)
    if not med:
        return jsonify({'error': 'Medication not found'}), 404

    patient = Patient.query.filter_by(user_id=user_id).first()
    if not patient or med.patient_id != patient.id:
        return jsonify({'error': 'Unauthorized'}), 403

    today = datetime.now(ZoneInfo("Africa/Nairobi")).date()

    log = MedicationLog.query.filter_by(
        medication_id=med.id,
        patient_id=patient.id,
        date=today
    ).first()

    if log:
        log.taken = taken
    else:
        log = MedicationLog(
            medication_id=med.id,
            patient_id=patient.id,
            date=today,
            taken=taken
        )
        db.session.add(log)

    patient.adherence_rate = calculate_adherence(patient)
    update_patient_status(patient)

    db.session.commit()

    return jsonify({
        "message": "Medication updated",
        "taken_today": log.taken,
        "adherence_rate": float(patient.adherence_rate)
    }), 200


# ─────────────────────────────────────────────
# DELETE Medication (Doctor/Admin Only)
# ─────────────────────────────────────────────
@medications_bp.route('/<int:med_id>', methods=['DELETE'])
@jwt_required()
def delete_medication(med_id):
    role = get_jwt().get('role')
    user_id = int(get_jwt_identity())

    if role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    med = Medication.query.get(med_id)
    if not med:
        return jsonify({'error': 'Medication not found'}), 404

    patient = Patient.query.get(med.patient_id)
    patient_name = patient.name if patient else f'Patient #{med.patient_id}'

    log_action(
        user_id,
        'Delete Medication',
        f'{med.name} — {patient_name}',
        f'Removed {med.name} {med.dosage} from {patient_name}',
        request
    )

    db.session.delete(med)
    db.session.commit()
    return jsonify({'message': 'Medication deleted'}), 200

# ─────────────────────────────────────────────
# UPDATE Medication (refill_date, complete)
# PUT /api/medications/<id>
# ─────────────────────────────────────────────
@medications_bp.route('/<int:med_id>', methods=['PUT'])
@jwt_required()
def update_medication(med_id):
    role = get_jwt().get('role')
    user_id = int(get_jwt_identity())

    if role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    med = Medication.query.get(med_id)
    if not med:
        return jsonify({'error': 'Medication not found'}), 404

    data = request.get_json()

    # ── Update refill date ───────────────────────────────────────────
    if 'refill_date' in data:
        if data['refill_date']:
            try:
                med.refill_date = datetime.fromisoformat(
                    data['refill_date'].replace('Z', '+00:00')
                ).date()
            except ValueError:
                return jsonify({'error': 'Invalid refill_date format (use YYYY-MM-DD)'}), 400
        else:
            med.refill_date = None

    patient = Patient.query.get(med.patient_id)
    patient_name = patient.name if patient else f'Patient #{med.patient_id}'

    # ── Mark complete ─────────────────────────────────────────────────
    if data.get('completed'):
        med.completed = True
        log_action(user_id, 'Complete Medication',
                   f'{med.name} — {patient_name}',
                   f'Marked {med.name} {med.dosage} as completed for {patient_name}',
                   request)
        # Notify the patient
        if patient and patient.user_id:
            db.session.add(Notification(
                user_id=patient.user_id,
                title='Medication Course Completed',
                message=f'Your prescription for {med.name} {med.dosage} has been marked as completed by your doctor.',
                type='medication'
            ))
        # Confirm to the doctor / admin
        db.session.add(Notification(
            user_id=user_id,
            title='Medication Marked Complete',
            message=f'{med.name} {med.dosage} for {patient_name} has been successfully completed.',
            type='info'
        ))

    # ── Update refill date ───────────────────────────────────────────
    elif 'refill_date' in data:
        new_date = med.refill_date.isoformat() if med.refill_date else None
        log_action(user_id, 'Update Refill Date',
                   f'{med.name} — {patient_name}',
                   f'Updated refill date for {med.name} ({patient_name}) to {new_date or "cleared"}',
                   request)
        if patient and patient.user_id:
            if new_date:
                from datetime import date as _date
                days_left = (med.refill_date - _date.today()).days
                if days_left <= 0:
                    urgency = 'Your refill is overdue — please collect your medication as soon as possible.'
                elif days_left <= 7:
                    urgency = f'Your refill is due in {days_left} day{"s" if days_left != 1 else ""} — collect it soon.'
                else:
                    urgency = f'Your next refill is scheduled for {med.refill_date.strftime("%B %d, %Y")}.'
                db.session.add(Notification(
                    user_id=patient.user_id,
                    title=f'Refill Date Updated — {med.name}',
                    message=urgency,
                    type='medication'
                ))
                # Send SMS immediately if refill is due within 2 days
                if days_left <= 2 and patient.phone:
                    sms_refill_reminder(
                        patient_name=patient.name,
                        phone=patient.phone,
                        medication_name=med.name,
                        dosage=med.dosage,
                        refill_date=med.refill_date
                    )
            else:
                db.session.add(Notification(
                    user_id=patient.user_id,
                    title=f'Refill Date Cleared — {med.name}',
                    message=f'The refill date for {med.name} {med.dosage} has been removed by your doctor.',
                    type='info'
                ))

    db.session.commit()
    return jsonify({'message': 'Medication updated', 'medication': med.to_dict()}), 200