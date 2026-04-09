from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models import SmsLog
from extensions import db
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def _friendly_reason(error: str, status: str) -> str:
    """Convert raw error codes/strings into human-readable failure reasons."""
    if status == 'disabled':
        return 'SMS is currently disabled in system settings'
    if not error:
        return ''
    e = error.lower()
    if 'http 401' in e or 'unauthorized' in e:
        return 'Invalid API credentials'
    if 'http 402' in e or '402' in e or 'insufficient' in e or 'balance' in e or 'units' in e or 'credit' in e:
        return 'Insufficient SMS units — please top up your account'
    if 'http 403' in e or 'forbidden' in e:
        return 'Access denied by SMS provider — account may be suspended'
    if 'http 400' in e or 'bad request' in e:
        return 'Invalid request sent to SMS provider — check phone number format'
    if 'http 429' in e or 'too many' in e or 'rate limit' in e:
        return 'Rate limit exceeded — too many SMS sent in a short time'
    if 'http 5' in e or 'server error' in e or 'service unavailable' in e:
        return 'SMS provider server error — try again later'
    if 'timeout' in e or 'timed out' in e or 'connectionerror' in e or 'connection' in e:
        return 'Network error — could not reach SMS provider'
    if 'non-success code' in e:
        # Extract the code from "Non-success code: XYZ"
        try:
            code = error.split(':')[-1].strip()
            return f'SMS provider rejected the request (code: {code})'
        except Exception:
            return 'SMS provider rejected the request'
    if 'no phone' in e or 'phone' in e:
        return 'No phone number on record for this patient'
    if 'null' in e or 'none' in e:
        return 'Phone number is missing or invalid'
    # Fallback — return cleaned version of raw error
    return error[:120] if len(error) > 120 else error

sms_logs_bp = Blueprint('sms_logs', __name__)
sms_logs_bp.strict_slashes = False


@sms_logs_bp.before_request
def allow_preflight():
    if request.method == 'OPTIONS':
        return '', 200


def _admin_only():
    if get_jwt().get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    return None


# ── GET logs (paginated, filterable) ─────────────────────────────────────────
@sms_logs_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    err = _admin_only()
    if err: return err

    page     = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    status   = request.args.get('status')        
    category = request.args.get('category')      
    search   = request.args.get('search', '').strip()

    q = SmsLog.query

    if status:
        q = q.filter(SmsLog.status == status)
    if category:
        q = q.filter(SmsLog.category == category)
    if search:
        q = q.filter(
            (SmsLog.recipient.ilike(f'%{search}%')) |
            (SmsLog.recipient_name.ilike(f'%{search}%')) |
            (SmsLog.message.ilike(f'%{search}%'))
        )

    total  = q.count()
    logs   = q.order_by(SmsLog.created_at.desc()) \
              .offset((page - 1) * per_page) \
              .limit(per_page) \
              .all()

    def enrich(log):
        d = log.to_dict()
        d['failure_reason'] = _friendly_reason(d.get('error', ''), d.get('status', ''))
        return d

    return jsonify({
        'logs':       [enrich(l) for l in logs],
        'total':      total,
        'page':       page,
        'per_page':   per_page,
        'pages':      (total + per_page - 1) // per_page,
    }), 200


# ── GET stats ────────────────────────────────────────────────────────────────
@sms_logs_bp.route('/logs/stats', methods=['GET'])
@jwt_required()
def get_stats():
    err = _admin_only()
    if err: return err

    total    = SmsLog.query.count()
    sent     = SmsLog.query.filter_by(status='sent').count()
    failed   = SmsLog.query.filter_by(status='failed').count()
    disabled = SmsLog.query.filter_by(status='disabled').count()

    # Last 7 days daily breakdown
    nairobi = ZoneInfo("Africa/Nairobi")
    today   = datetime.now(nairobi).date()
    daily   = []
    for i in range(6, -1, -1):
        day   = today - timedelta(days=i)
        count = SmsLog.query.filter(
            db.func.date(SmsLog.created_at) == day
        ).count()
        daily.append({'date': day.isoformat(), 'count': count})

    # By category
    from sqlalchemy import func
    categories = db.session.query(
        SmsLog.category, func.count(SmsLog.id)
    ).group_by(SmsLog.category).all()

    return jsonify({
        'total':      total,
        'sent':       sent,
        'failed':     failed,
        'disabled':   disabled,
        'success_rate': round((sent / total * 100), 1) if total else 0,
        'daily':      daily,
        'by_category': [{'category': c, 'count': n} for c, n in categories],
    }), 200


# ── RETRY a failed SMS ───────────────────────────────────────────────────────
@sms_logs_bp.route('/logs/<int:log_id>/retry', methods=['POST'])
@jwt_required()
def retry_sms(log_id):
    err = _admin_only()
    if err: return err

    log = SmsLog.query.get(log_id)
    if not log:
        return jsonify({'error': 'Log entry not found'}), 404

    if log.status not in ('failed', 'disabled'):
        return jsonify({'error': 'Only failed or disabled messages can be retried'}), 400

    if not log.recipient or log.recipient.strip() in ('', 'null', 'None'):
        return jsonify({'error': 'No valid phone number to retry'}), 400

    from sms import send_sms
    success = send_sms(
        phone=log.recipient,
        message=log.message,
        category=log.category or 'retry',
        recipient_name=log.recipient_name or '',
        recipient_role=log.recipient_role or 'patient',
    )

    if success:
        # Update the original failed log to 'sent' so it disappears from the failed list
        log.status = 'sent'
        log.error  = None
        db.session.commit()
        return jsonify({'message': 'SMS resent successfully', 'status': 'sent'}), 200
    else:
        return jsonify({'message': 'Retry attempted but failed again', 'status': 'failed'}), 200


# ── DELETE all logs ───────────────────────────────────────────────────────────
@sms_logs_bp.route('/logs', methods=['DELETE'])
@jwt_required()
def clear_logs():
    err = _admin_only()
    if err: return err

    deleted = SmsLog.query.delete()
    db.session.commit()
    return jsonify({'message': f'Cleared {deleted} SMS log entries'}), 200