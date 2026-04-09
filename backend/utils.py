from extensions import db
from datetime import datetime
from zoneinfo import ZoneInfo


def _get_client_ip(request) -> str | None:
    """
    Extract the real client IP from a request that has passed through
    Render's reverse proxy stack.

    Render injects the real client IP as the FIRST value in
    X-Forwarded-For.  The header looks like:
        X-Forwarded-For: <client>, <proxy1>, <proxy2>

    ProxyFix in app.py (x_for=2) already rewrites request.remote_addr to
    the correct client IP, so we prefer that when it doesn't look like a
    loopback/private address.  We fall back to parsing X-Forwarded-For
    directly as a belt-and-suspenders measure.
    """
    if request is None:
        return None

    # ProxyFix should have resolved this already — use it if it looks real
    addr = getattr(request, 'remote_addr', None) or ''
    if addr and addr not in ('127.0.0.1', '::1', 'localhost'):
        return addr

    # Belt-and-suspenders: parse X-Forwarded-For directly
    forwarded_for = request.headers.get('X-Forwarded-For', '').strip()
    if forwarded_for:
        # Take the leftmost entry — that is always the original client
        client_ip = forwarded_for.split(',')[0].strip()
        if client_ip:
            return client_ip

    # Last resort — return whatever remote_addr says (may be 127.0.0.1 in dev)
    return addr or None


def log_action(user_id: int, action: str, target: str = '', description: str = '', request=None):
    from models import AuditLog
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target=target,
        description=description,
        ip_address=_get_client_ip(request),
        created_at=datetime.now(ZoneInfo("Africa/Nairobi")).replace(tzinfo=None),
    )
    db.session.add(entry)