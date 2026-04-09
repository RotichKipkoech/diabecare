from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from extensions import db
from models import DashboardFeature
from utils import log_action

features_bp = Blueprint('features', __name__)
features_bp.strict_slashes = False


@features_bp.before_request
def allow_preflight():
    if request.method == "OPTIONS":
        return '', 200


def _admin_only():
    if get_jwt().get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    return None


# ─────────────────────────────────────────────
# GET all features (admin + doctor + patient)
# ─────────────────────────────────────────────
@features_bp.route('', methods=['GET'])
@features_bp.route('/', methods=['GET'])
@jwt_required()
def get_features():
    role = get_jwt().get('role', 'patient')
    if role == 'admin':
        features = DashboardFeature.query.order_by(DashboardFeature.id).all()
    elif role == 'doctor':
        features = DashboardFeature.query.filter_by(target_role='doctor').all()
    else:
        features = DashboardFeature.query.filter_by(target_role='patient').all()
    return jsonify([f.to_dict() for f in features]), 200


# ─────────────────────────────────────────────
# CREATE feature (admin only)
# ─────────────────────────────────────────────
@features_bp.route('', methods=['POST'])
@features_bp.route('/', methods=['POST'])
@jwt_required()
def create_feature():
    err = _admin_only()
    if err: return err

    data = request.get_json()
    for field in ['title', 'description', 'type', 'targetRole']:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    feature = DashboardFeature(
        title=data['title'],
        description=data['description'],
        type=data['type'],
        target_role=data['targetRole'],
        enabled=data.get('enabled', True),
        value=data.get('value', ''),
        unit=data.get('unit', ''),
        is_builtin=False
    )
    db.session.add(feature)
    log_action(int(get_jwt_identity()), 'Create Feature', feature.title,
               f'Added dashboard feature "{feature.title}" for {feature.target_role}', request)
    db.session.commit()
    return jsonify({'message': 'Feature created', 'feature': feature.to_dict()}), 201


# ─────────────────────────────────────────────
# UPDATE feature (admin only)
# ─────────────────────────────────────────────
@features_bp.route('/<int:feature_id>', methods=['PUT'])
@jwt_required()
def update_feature(feature_id):
    err = _admin_only()
    if err: return err

    feature = DashboardFeature.query.get(feature_id)
    if not feature:
        return jsonify({'error': 'Feature not found'}), 404

    data = request.get_json()
    # Built-in features: only allow toggling enabled, not renaming
    if not feature.is_builtin:
        for field in ['description', 'type', 'value', 'unit']:
            if field in data:
                setattr(feature, field, data[field])
        if 'targetRole' in data:
            feature.target_role = data['targetRole']
        if 'title' in data:
            feature.title = data['title']

    if 'enabled' in data:
        feature.enabled = bool(data['enabled'])

    log_action(int(get_jwt_identity()), 'Update Feature', feature.title,
               f'Updated dashboard feature "{feature.title}"', request)
    db.session.commit()
    return jsonify({'message': 'Feature updated', 'feature': feature.to_dict()}), 200


# ─────────────────────────────────────────────
# TOGGLE enabled (admin only)
# ─────────────────────────────────────────────
@features_bp.route('/<int:feature_id>/toggle', methods=['PUT'])
@jwt_required()
def toggle_feature(feature_id):
    err = _admin_only()
    if err: return err

    feature = DashboardFeature.query.get(feature_id)
    if not feature:
        return jsonify({'error': 'Feature not found'}), 404

    feature.enabled = not feature.enabled
    log_action(int(get_jwt_identity()), 'Toggle Feature', feature.title,
               f'{"Enabled" if feature.enabled else "Disabled"} feature "{feature.title}"', request)
    db.session.commit()
    return jsonify({'message': 'Feature toggled', 'feature': feature.to_dict()}), 200


# ─────────────────────────────────────────────
# DELETE feature (admin only, non-builtin only)
# ─────────────────────────────────────────────
@features_bp.route('/<int:feature_id>', methods=['DELETE'])
@jwt_required()
def delete_feature(feature_id):
    err = _admin_only()
    if err: return err

    feature = DashboardFeature.query.get(feature_id)
    if not feature:
        return jsonify({'error': 'Feature not found'}), 404

    if feature.is_builtin:
        return jsonify({'error': 'Built-in features cannot be deleted — disable them instead'}), 400

    log_action(int(get_jwt_identity()), 'Delete Feature', feature.title,
               f'Deleted dashboard feature "{feature.title}"', request)
    db.session.delete(feature)
    db.session.commit()
    return jsonify({'message': 'Feature deleted'}), 200