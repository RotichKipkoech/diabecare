from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Notification
from extensions import db

# ✅ Blueprint (no trailing slash in url_prefix)
# notifications_bp = Blueprint("notifications", __name__)

notifications_bp = Blueprint('notifications', __name__)
notifications_bp.strict_slashes = False

@notifications_bp.before_request
def allow_preflight():
    if request.method == "OPTIONS":
        return '', 200

# ------------------------------------------------------------------
# Get My Notifications
# Supports both /api/notifications and /api/notifications/
# ------------------------------------------------------------------
@notifications_bp.route("", methods=["GET"])
@notifications_bp.route("/", methods=["GET"])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()  # already an int

    notifications = (
        Notification.query
        .filter_by(user_id=user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    return jsonify([n.to_dict() for n in notifications]), 200


# ------------------------------------------------------------------
# Mark Single Notification As Read
# PUT /api/notifications/<id>/read
# ------------------------------------------------------------------
@notifications_bp.route("/<int:note_id>/read", methods=["PUT"])
@jwt_required()
def mark_read(note_id):
    user_id = get_jwt_identity()

    notification = Notification.query.filter_by(id=note_id, user_id=user_id).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.read = True
    db.session.commit()

    return jsonify({"message": "Marked as read"}), 200


# ------------------------------------------------------------------
# Mark ALL Notifications As Read
# PUT /api/notifications/mark-all-read
# ------------------------------------------------------------------
@notifications_bp.route("/mark-all-read", methods=["PUT"])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()

    Notification.query.filter_by(user_id=user_id, read=False).update({"read": True})
    db.session.commit()

    return jsonify({"message": "All notifications marked as read"}), 200


# ------------------------------------------------------------------
# Delete Notification
# DELETE /api/notifications/<id>
# ------------------------------------------------------------------
@notifications_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(note_id):
    user_id = get_jwt_identity()

    notification = Notification.query.filter_by(id=note_id, user_id=user_id).first()
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    db.session.delete(notification)
    db.session.commit()

    return jsonify({"message": "Notification deleted"}), 200