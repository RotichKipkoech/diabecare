from extensions import db
from datetime import datetime, timezone


def _get_client_ip(request) -> str | None:
    """
    Extract the real client IP address.

    On Render (and most cloud hosts) all traffic passes through a reverse
    proxy, so request.remote_addr is always 127.0.0.1 (the proxy itself).
    The real IP is in the X-Forwarded-For header as a comma-separated list
    where the FIRST entry is the original client.

    Falls back to remote_addr when the header is absent (local dev).
    """
    if request is None:
        return None
    forwarded_for = request.headers.get('X-Forwarded-For', '')
    if forwarded_for:
        # "client, proxy1, proxy2" — take the leftmost (original client)
        return forwarded_for.split(',')[0].strip()
    return request.remote_addr or None


def log_action(user_id: int, action: str, target: str = '', description: str = '', request=None):
    from models import AuditLog
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target=target,
        description=description,
        ip_address=_get_client_ip(request),
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.session.add(entry)