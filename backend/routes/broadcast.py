"""
DiabeCare Broadcast Messaging
POST /api/broadcast         — Send message to filtered recipients
POST /api/broadcast/preview — Preview recipients without sending

Filters (admin):
  role:           all | admin | doctor | patient
  health_status:  stable | warning | critical  (patients only)
  diabetes_type:  Type 1 | Type 2 | Gestational (patients only)
  user_ids:       [int, ...]  — specific individuals

Filters (doctor):
  user_ids / health_status / diabetes_type — among assigned patients only

Delivery channels: ['in_app'] | ['sms'] | ['in_app', 'sms']
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from extensions import db
from models import User, Patient, Notification
from sms import send_sms

broadcast_bp = Blueprint('broadcast', __name__)
broadcast_bp.strict_slashes = False


@broadcast_bp.before_request
def allow_preflight():
    if request.method == 'OPTIONS':
        return '', 200


def _resolve_recipients(data: dict, caller_role: str, caller_id: int):
    """Return list of dicts: {user_id, name, phone, role}"""
    recipients = []

    # ── Specific user IDs ──────────────────────────────────────────
    if data.get('user_ids'):
        users = User.query.filter(User.id.in_(data['user_ids'])).all()
        for u in users:
            if caller_role == 'doctor':
                patient = Patient.query.filter_by(
                    user_id=u.id, assigned_doctor_id=caller_id
                ).first()
                if not patient:
                    continue
            recipients.append({
                'user_id': u.id, 'name': u.full_name,
                'phone': u.phone, 'role': u.role,
            })
        return recipients

    health_status = data.get('health_status')
    diabetes_type = data.get('diabetes_type')

    # ── Doctor: always targets own patients only ───────────────────
    if caller_role == 'doctor':
        q = Patient.query.filter_by(assigned_doctor_id=caller_id)
        if health_status:
            q = q.filter_by(status=health_status)
        if diabetes_type:
            q = q.filter_by(diabetes_type=diabetes_type)
        for p in q.all():
            if p.user_id:
                u = User.query.get(p.user_id)
                if u:
                    recipients.append({
                        'user_id': u.id, 'name': u.full_name,
                        'phone': u.phone, 'role': 'patient',
                    })
        return recipients

    # ── Admin: role + optional patient filters ─────────────────────
    role_filter = data.get('role', 'all')

    if role_filter in ('patient', 'all') and (health_status or diabetes_type):
        pq = Patient.query
        if health_status:
            pq = pq.filter_by(status=health_status)
        if diabetes_type:
            pq = pq.filter_by(diabetes_type=diabetes_type)
        for p in pq.all():
            if p.user_id:
                u = User.query.get(p.user_id)
                if u:
                    recipients.append({
                        'user_id': u.id, 'name': u.full_name,
                        'phone': u.phone, 'role': 'patient',
                    })
        if role_filter == 'all':
            for u in User.query.filter(User.role.in_(['admin', 'doctor'])).all():
                recipients.append({
                    'user_id': u.id, 'name': u.full_name,
                    'phone': u.phone, 'role': u.role,
                })
    else:
        q = User.query
        if role_filter != 'all':
            q = q.filter_by(role=role_filter)
        for u in q.all():
            recipients.append({
                'user_id': u.id, 'name': u.full_name,
                'phone': u.phone, 'role': u.role,
            })

    return recipients


@broadcast_bp.route('', methods=['POST'])
@broadcast_bp.route('/', methods=['POST'])
@jwt_required()
def send_broadcast():
    caller_role = get_jwt().get('role')
    caller_id   = int(get_jwt_identity())

    if caller_role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    data     = request.get_json() or {}
    title    = (data.get('title') or '').strip()
    message  = (data.get('message') or '').strip()
    channels = data.get('channels', ['in_app'])

    if not title or not message:
        return jsonify({'error': 'title and message are required'}), 400
    if not channels:
        return jsonify({'error': 'At least one channel required'}), 400

    recipients = _resolve_recipients(data, caller_role, caller_id)
    if not recipients:
        return jsonify({'error': 'No recipients found for the given filters'}), 400

    sent_app = 0
    sent_sms = 0
    failed   = 0

    for r in recipients:
        if 'in_app' in channels:
            try:
                db.session.add(Notification(
                    user_id=r['user_id'],
                    title=title,
                    message=message,
                    type='info',
                ))
                sent_app += 1
            except Exception:
                failed += 1

        if 'sms' in channels and r.get('phone'):
            try:
                send_sms(
                    phone=r['phone'],
                    message=f"{title}\n{message} - DiabeCare",
                    category='broadcast',
                    recipient_name=r['name'],
                    recipient_role=r['role'],
                )
                sent_sms += 1
            except Exception:
                failed += 1

    db.session.commit()

    return jsonify({
        'message':    'Broadcast sent',
        'recipients': len(recipients),
        'sent_app':   sent_app,
        'sent_sms':   sent_sms,
        'failed':     failed,
    }), 200


@broadcast_bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_recipients():
    caller_role = get_jwt().get('role')
    caller_id   = int(get_jwt_identity())

    if caller_role not in ('admin', 'doctor'):
        return jsonify({'error': 'Unauthorized'}), 403

    data       = request.get_json() or {}
    recipients = _resolve_recipients(data, caller_role, caller_id)

    return jsonify({
        'count':      len(recipients),
        'recipients': [{'name': r['name'], 'role': r['role']} for r in recipients],
    }), 200