from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
import bcrypt
from extensions import db
from models import User, Patient, AuditLog, SystemConfig, TokenBlocklist
from sqlalchemy import func
from sms import sms_account_created
from utils import log_action

auth_bp = Blueprint('auth', __name__)


# ------------------------------------------------------------------
# Login
# POST /api/auth/login
# ------------------------------------------------------------------
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({'error': 'Invalid username or password'}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'name': user.full_name}
    )

    log_action(user.id, 'Login', 'Auth', f'{user.full_name} logged in as {user.role}', request)
    db.session.commit()

    return jsonify({
        'token': access_token,
        'user': user.to_dict()
    }), 200


# ------------------------------------------------------------------
# Logout — blacklists the current JWT token
# POST /api/auth/logout
# ------------------------------------------------------------------
@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    jti     = get_jwt().get('jti')
    user_id = int(get_jwt_identity())
    user    = User.query.get(user_id)

    if jti:
        db.session.add(TokenBlocklist(jti=jti))

    if user:
        reason = request.get_json(silent=True) or {}
        cause  = reason.get('reason', 'manual')   # 'manual' | 'inactivity'
        log_action(
            user_id, 'Logout', 'Auth',
            f'{user.full_name} logged out ({cause})',
            request
        )

    db.session.commit()
    return jsonify({'message': 'Logged out successfully'}), 200


# ------------------------------------------------------------------
# Register User (Admin only)
# POST /api/auth/register
# ------------------------------------------------------------------
@auth_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    requester = User.query.get(int(get_jwt_identity()))
    if not requester or requester.role != 'admin':
        return jsonify({'error': 'Only admins can register users'}), 403

    data = request.get_json()

    for field in ['username', 'email', 'password', 'role', 'full_name']:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    if data['role'] not in ('admin', 'doctor', 'patient'):
        return jsonify({'error': 'Invalid role'}), 400

    password_hash = bcrypt.hashpw(
        data['password'].encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    try:
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=password_hash,
            role=data['role'],
            full_name=data.get('full_name', ''),
            phone=data.get('phone', '')
        )
        db.session.add(user)
        db.session.flush()

        if data['role'] == 'patient':
            if not data.get('age'):
                return jsonify({'error': 'Age is required for patients'}), 400

            try:
                age = int(data['age'])
                blood_sugar = float(data.get('blood_sugar', 0))
                hba1c = float(data.get('hba1c', 0))
            except ValueError:
                return jsonify({'error': 'Invalid numeric values'}), 400

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

            patient = Patient(
                user_id=user.id,
                name=data['username'],
                age=age,
                gender=data.get('gender', 'Male'),
                diabetes_type=data.get('diabetes_type', 'Type 2'),
                phone=data.get('phone', ''),
                email=data['email'],
                blood_sugar=blood_sugar,
                hba1c=hba1c,
                status='stable',
                assigned_doctor_id=assigned_doctor_id
            )
            db.session.add(patient)

        log_action(
            requester.id,
            'Register User',
            f'{data["role"].capitalize()} — {data["username"]}',
            f'Admin created new {data["role"]} account for {data.get("full_name", data["username"])}',
            request
        )
        db.session.commit()

    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Username or email already exists'}), 409

    phone = data.get('phone', '')
    if phone:
        sms_account_created(
            full_name=data.get('full_name', data['username']),
            phone=phone,
            username=data['username'],
            password=data['password'],
            role=data['role']
        )

    return jsonify({
        'message': 'User registered successfully',
        'user_id': user.id
    }), 201


# ------------------------------------------------------------------
# List Users (Admin only)
# GET /api/auth/users
# ------------------------------------------------------------------
@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    requester = User.query.get(int(get_jwt_identity()))
    if not requester or requester.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users]), 200


# ------------------------------------------------------------------
# Update User (Admin only)
# PUT /api/auth/users/<id>
# ------------------------------------------------------------------
@auth_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    requester = User.query.get(int(get_jwt_identity()))
    if not requester or requester.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    for field in ['username', 'email', 'full_name', 'phone', 'role']:
        if field in data and data[field]:
            setattr(user, field, data[field])

    if 'password' in data and data['password']:
        user.password_hash = bcrypt.hashpw(
            data['password'].encode('utf-8'), bcrypt.gensalt()
        ).decode('utf-8')

    try:
        log_action(
            requester.id,
            'Update User',
            f'User #{user_id} — {user.full_name}',
            f'Admin updated account details for {user.full_name} ({user.role})',
            request
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Update failed — username or email may already exist'}), 409

    return jsonify({'message': 'User updated successfully'}), 200


# ------------------------------------------------------------------
# Delete User (Admin only)
# DELETE /api/auth/users/<id>
# ------------------------------------------------------------------
@auth_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    requester_id = int(get_jwt_identity())
    requester = User.query.get(requester_id)
    if not requester or requester.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    if user_id == requester_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user.role == 'admin':
        admin_count = User.query.filter_by(role='admin').count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot delete the last admin'}), 400

    deleted_name = user.full_name
    deleted_role = user.role

    try:
        # ── Handle related records before deleting the user ──────────────────

        if user.role == 'patient':
            # Delete the patient record entirely — this cascades automatically
            # to medications, appointments, and medication_logs via the
            # 'all, delete-orphan' relationships defined on Patient.
            patient = Patient.query.filter_by(user_id=user_id).first()
            if patient:
                db.session.delete(patient)
                db.session.flush()   # process cascade deletes before removing user
        else:
            # For doctors/admins: keep patient records but unlink the user reference
            Patient.query.filter_by(user_id=user_id).update(
                {'user_id': None}, synchronize_session=False
            )

        # Patients assigned to this doctor → unassign (keep the patient record)
        Patient.query.filter_by(assigned_doctor_id=user_id).update(
            {'assigned_doctor_id': None}, synchronize_session=False
        )

        # audit_logs → SET NULL (preserve history, just unlink the user)
        from models import AuditLog
        AuditLog.query.filter_by(user_id=user_id).update(
            {'user_id': None}, synchronize_session=False
        )

        # notifications → delete the user's own notifications
        from models import Notification
        Notification.query.filter_by(user_id=user_id).delete(
            synchronize_session=False
        )

        log_action(
            requester_id,
            'Delete User',
            f'User #{user_id} — {deleted_name}',
            f'Admin deleted {deleted_role} account: {deleted_name}',
            request
        )

        db.session.delete(user)
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Delete failed: {str(e)}'}), 500

    return jsonify({'message': 'User deleted successfully'}), 200


# ------------------------------------------------------------------
# Get Current User
# GET /api/auth/me
# ------------------------------------------------------------------
@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200


# ------------------------------------------------------------------
# Change Password
# POST /api/auth/change-password
# ------------------------------------------------------------------
@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'error': 'current_password and new_password are required'}), 400

    if not bcrypt.checkpw(current_password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({'error': 'Current password is incorrect'}), 401

    if len(new_password) < 8:
        return jsonify({'error': 'New password must be at least 8 characters'}), 400

    user.password_hash = bcrypt.hashpw(
        new_password.encode('utf-8'), bcrypt.gensalt()
    ).decode('utf-8')

    log_action(user_id, 'Change Password', 'Auth', f'{user.full_name} changed their password', request)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'}), 200


# ------------------------------------------------------------------
# Update Profile
# PUT /api/auth/profile
# ------------------------------------------------------------------
@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    allowed = ['full_name', 'email', 'phone']
    for field in allowed:
        if field in data and data[field] is not None:
            setattr(user, field, data[field])

    log_action(user_id, 'Update Profile', 'Auth', f'{user.full_name} updated their profile', request)
    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': user.to_dict()}), 200


# ------------------------------------------------------------------
# Activity Log (Admin only)
# GET /api/auth/activity-log
# ------------------------------------------------------------------
@auth_bp.route('/activity-log', methods=['GET'])
@jwt_required()
def activity_log():
    if get_jwt().get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return jsonify([l.to_dict() for l in logs]), 200

# ------------------------------------------------------------------
# Upload Avatar
# POST /api/auth/avatar
# ------------------------------------------------------------------
@auth_bp.route('/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    avatar_data = data.get('avatar_url', '')  

    
    if avatar_data and not avatar_data.startswith('data:image/'):
        return jsonify({'error': 'Invalid format — must be a base64 image data-URI'}), 400

    
    if len(avatar_data) > 2_800_000:
        return jsonify({'error': 'Image too large — please use an image under 2 MB'}), 413

    user.avatar_url = avatar_data or None
    log_action(user_id, 'Update Avatar', 'Auth',
               f'{user.full_name} {"updated" if avatar_data else "removed"} their profile photo', request)
    db.session.commit()
    return jsonify({'message': 'Avatar updated', 'avatar_url': user.avatar_url}), 200

# ------------------------------------------------------------------
# GET Maintenance State (public — called on login)
# GET /api/auth/maintenance
# ------------------------------------------------------------------
@auth_bp.route('/maintenance', methods=['GET'])
def get_maintenance():
    import json
    raw = SystemConfig.get('maintenance')
    if not raw:
        return jsonify({'pages': {}, 'message': '', 'estimatedTime': ''}), 200
    try:
        return jsonify(json.loads(raw)), 200
    except Exception:
        return jsonify({'pages': {}, 'message': '', 'estimatedTime': ''}), 200


# ------------------------------------------------------------------
# SET Maintenance State (Admin only)
# POST /api/auth/maintenance
# ------------------------------------------------------------------
@auth_bp.route('/maintenance', methods=['POST'])
@jwt_required()
def set_maintenance():
    import json
    if get_jwt().get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json() or {}
    # Expecting: { pages: {id: bool}, message: str, estimatedTime: str }
    payload = {
        'pages':         data.get('pages', {}),
        'message':       data.get('message', ''),
        'estimatedTime': data.get('estimatedTime', ''),
    }

    SystemConfig.set('maintenance', json.dumps(payload))
    db.session.commit()

    active = [k for k, v in payload['pages'].items() if v]
    log_action(
        int(get_jwt_identity()),
        'Update Maintenance',
        'System Config',
        f'Admin set {len(active)} page(s) under maintenance: {", ".join(active) or "none"}',
        request
    )
    db.session.commit()
    return jsonify({'message': 'Maintenance settings saved', 'data': payload}), 200