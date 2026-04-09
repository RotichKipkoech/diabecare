from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from extensions import db
from models import Appointment, Notification, Patient, User
from datetime import datetime
from zoneinfo import ZoneInfo
from sms import (
    sms_appointment_created, sms_appointment_rescheduled,
    sms_appointment_cancelled, sms_appointment_completed, sms_appointment_missed,
    sms_appointment_requested_doctor,
)
from utils import log_action


appointments_bp = Blueprint('appointments', __name__)
appointments_bp.strict_slashes = False


@appointments_bp.before_request
def allow_preflight():
    if request.method == "OPTIONS":
        return '', 200


# ─────────────────────────────────────────────
# GET APPOINTMENTS
# ─────────────────────────────────────────────
@appointments_bp.route('', methods=['GET'])
@appointments_bp.route('/', methods=['GET'])
@jwt_required()
def get_appointments():
    user_id = int(get_jwt_identity())
    role = get_jwt().get('role', 'patient')

    if role == 'admin':
        appts = Appointment.query.order_by(Appointment.appointment_date.desc()).all()
    elif role == 'doctor':
        appts = Appointment.query.filter_by(
            doctor_id=user_id
        ).order_by(Appointment.appointment_date.desc()).all()
    else:  # patient
        appts = (
            Appointment.query
            .join(Appointment.patient)
            .filter_by(user_id=user_id)
            .order_by(Appointment.appointment_date.desc())
            .all()
        )

    now = datetime.now(ZoneInfo("Africa/Nairobi")).replace(tzinfo=None)
    result = []
    for a in appts:
        d = a.to_dict()
        d['is_overdue'] = (
            a.status in ('requested', 'scheduled') and
            a.appointment_date < now
        )
        result.append(d)
    return jsonify(result), 200


# ─────────────────────────────────────────────
# CREATE APPOINTMENT
# ─────────────────────────────────────────────
@appointments_bp.route('', methods=['POST'])
@appointments_bp.route('/', methods=['POST'])
@jwt_required()
def create_appointment():
    role = get_jwt().get('role')
    creator_id = int(get_jwt_identity())

    if role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()

    for field in ['patient_id', 'appointment_date']:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    try:
        appointment_date = datetime.fromisoformat(
            data['appointment_date'].replace('Z', '+00:00')
        ).astimezone(ZoneInfo("Africa/Nairobi"))
    except Exception:
        return jsonify({'error': 'Invalid appointment_date format'}), 400

    patient = Patient.query.get(data['patient_id'])
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404

    appt = Appointment(
        patient_id=data['patient_id'],
        doctor_id=data.get('doctor_id') or creator_id,
        appointment_date=appointment_date,
        type=data.get('type', 'Follow-up'),
        notes=data.get('notes', ''),
        status='scheduled'
    )

    db.session.add(appt)
    db.session.flush()

    # Update patient's next_visit
    patient.next_visit = appointment_date.date()

    # Notify Patient
    db.session.add(Notification(
        user_id=patient.user_id,
        title="New Appointment Scheduled",
        message=f"You have a new appointment on {appointment_date}.",
        type="appointment"
    ))

    # Notify Admins if created by doctor
    if role == "doctor":
        admins = User.query.filter_by(role="admin").all()
        for admin in admins:
            db.session.add(Notification(
                user_id=admin.id,
                title="Appointment Created",
                message=f"Doctor scheduled appointment for {patient.name}.",
                type="info"
            ))

    # Notify Doctor if assigned by admin
    if role == "admin" and appt.doctor_id:
        db.session.add(Notification(
            user_id=appt.doctor_id,
            title="New Appointment Assigned",
            message=f"You have been assigned an appointment with {patient.name}.",
            type="appointment"
        ))

    log_action(
        creator_id,
        'Schedule Appointment',
        f'Appt #{appt.id} — {patient.name}',
        f'Scheduled {appt.type} appointment for {patient.name} on {appointment_date.strftime("%b %d, %Y at %I:%M %p")}',
        request
    )

    db.session.commit()

    # SMS after commit
    if patient.phone:
        doctor = User.query.get(appt.doctor_id)
        doctor_name = doctor.full_name if doctor else 'your doctor'
        sms_appointment_created(
            patient_name=patient.name,
            phone=patient.phone,
            appointment_date=appointment_date,
            doctor_name=doctor_name,
            appt_type=appt.type
        )

    return jsonify({'message': 'Appointment scheduled', 'id': appt.id}), 201


# ─────────────────────────────────────────────
# UPDATE APPOINTMENT (Reschedule / Cancel / Complete)
# ─────────────────────────────────────────────
@appointments_bp.route('/<int:appt_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appt_id):
    appt = Appointment.query.get(appt_id)
    if not appt:
        return jsonify({'error': 'Appointment not found'}), 404

    role = get_jwt().get('role')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    allowed = ['appointment_date', 'type', 'status', 'notes']
    updated = False

    for field in allowed:
        if field in data:
            if field == "appointment_date":
                try:
                    parsed_date = datetime.fromisoformat(
                        data['appointment_date'].replace('Z', '+00:00')
                    ).astimezone(ZoneInfo("Africa/Nairobi"))
                    appt.appointment_date = parsed_date
                except Exception:
                    return jsonify({'error': 'Invalid appointment_date format'}), 400
            else:
                setattr(appt, field, data[field])
            updated = True

    if not updated:
        return jsonify({'error': 'No fields to update'}), 400

    # RESCHEDULED
    if "appointment_date" in data:
        appt.patient.next_visit = appt.appointment_date.date()
        db.session.add(Notification(
            user_id=appt.patient.user_id,
            title="Appointment Rescheduled",
            message=f"Your appointment has been moved to {appt.appointment_date}.",
            type="appointment"
        ))
        log_action(
            user_id,
            'Reschedule Appointment',
            f'Appt #{appt_id} — {appt.patient.name}',
            f'Rescheduled {appt.type} appointment for {appt.patient.name} to {appt.appointment_date.strftime("%b %d, %Y at %I:%M %p")}',
            request
        )

    # CANCELLED
    if "status" in data and data["status"] == "cancelled":
        db.session.add(Notification(
            user_id=appt.patient.user_id,
            title="Appointment Cancelled",
            message="Your appointment has been cancelled.",
            type="alert"
        ))
        log_action(
            user_id,
            'Cancel Appointment',
            f'Appt #{appt_id} — {appt.patient.name}',
            f'Cancelled {appt.type} appointment for {appt.patient.name}',
            request
        )

    # COMPLETED
    if "status" in data and data["status"] == "completed":
        appt.patient.last_visit = appt.appointment_date.date()
        appt.patient.next_visit = None
        db.session.add(Notification(
            user_id=appt.patient.user_id,
            title="Appointment Completed",
            message="Your visit has been completed.",
            type="info"
        ))
        log_action(
            user_id,
            'Complete Appointment',
            f'Appt #{appt_id} — {appt.patient.name}',
            f'Marked {appt.type} appointment as completed for {appt.patient.name}',
            request
        )

    db.session.commit()

    # SMS after commit
    if appt.patient.phone:
        if 'appointment_date' in data:
            sms_appointment_rescheduled(
                patient_name=appt.patient.name,
                phone=appt.patient.phone,
                new_date=appt.appointment_date,
                appt_type=appt.type
            )
        if 'status' in data and data['status'] == 'cancelled':
            sms_appointment_cancelled(
                patient_name=appt.patient.name,
                phone=appt.patient.phone,
                appointment_date=appt.appointment_date,
                appt_type=appt.type
            )
        if 'status' in data and data['status'] == 'completed':
            doctor = User.query.get(appt.doctor_id)
            doctor_name = doctor.full_name if doctor else 'your doctor'
            sms_appointment_completed(
                patient_name=appt.patient.name,
                phone=appt.patient.phone,
                appointment_date=appt.appointment_date,
                doctor_name=doctor_name,
                appt_type=appt.type
            )
        if 'status' in data and data['status'] == 'missed':
            doctor = User.query.get(appt.doctor_id)
            doctor_name = doctor.full_name if doctor else 'your doctor'
            sms_appointment_missed(
                patient_name=appt.patient.name,
                phone=appt.patient.phone,
                appointment_date=appt.appointment_date,
                doctor_name=doctor_name
            )

    return jsonify({'message': 'Appointment updated'}), 200


# ─────────────────────────────────────────────
# Patient Appointment Request
# ─────────────────────────────────────────────
@appointments_bp.route('/request', methods=['POST'])
@jwt_required()
def request_appointment():
    user_id = int(get_jwt_identity())
    role = get_jwt().get('role', 'patient')

    if role != 'patient':
        return jsonify({'error': 'Only patients can request appointments'}), 403

    data = request.get_json()
    if not data.get('requested_date') or not data.get('type'):
        return jsonify({'error': 'requested_date and type are required'}), 400

    try:
        requested_date = datetime.fromisoformat(
            data['requested_date'].replace('Z', '+00:00')
        ).astimezone(ZoneInfo("Africa/Nairobi"))
    except Exception:
        return jsonify({'error': 'Invalid requested_date format'}), 400

    patient = Patient.query.filter_by(user_id=user_id).first()
    if not patient:
        return jsonify({'error': 'Patient record not found'}), 404

    appt = Appointment(
        patient_id=patient.id,
        doctor_id=patient.assigned_doctor_id,  # fixed
        appointment_date=requested_date,
        type=data.get('type', 'Follow-up'),
        notes=data.get('notes', ''),
        status='requested'
    )
    db.session.add(appt)

    admins = User.query.filter_by(role='admin').all()
    for admin in admins:
        db.session.add(Notification(
            user_id=admin.id,
            title='Appointment Requested',
            message=f'{patient.name} requested a {appt.type} appointment on {requested_date.strftime("%b %d, %Y at %I:%M %p")}.',
            type='appointment'
        ))

    if patient.assigned_doctor_id:  
        db.session.add(Notification(
            user_id=patient.assigned_doctor_id,  
            title='Patient Appointment Request',
            message=f'{patient.name} wants to schedule a {appt.type}. Please confirm.',
            type='appointment'
        ))

    log_action(
        user_id,
        'Request Appointment',
        f'Patient — {patient.name}',
        f'{patient.name} requested a {appt.type} appointment on {requested_date.strftime("%b %d, %Y at %I:%M %p")}',
        request
    )

    db.session.commit()

    # SMS the assigned doctor about the new request
    if patient.assigned_doctor_id:
        doctor = User.query.get(patient.assigned_doctor_id)
        if doctor and doctor.phone:
            sms_appointment_requested_doctor(
                doctor_name=doctor.full_name,
                phone=doctor.phone,
                patient_name=patient.name,
                appointment_date=requested_date,
                appt_type=appt.type
            )

    return jsonify({'message': 'Appointment request submitted', 'id': appt.id}), 201