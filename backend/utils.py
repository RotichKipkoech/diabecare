from extensions import db
from datetime import datetime
from zoneinfo import ZoneInfo


def log_action(user_id: int, action: str, target: str = '', description: str = '', request=None):
    
    from models import AuditLog
    ip = None
    if request:
        ip = request.remote_addr
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target=target,
        description=description,
        ip_address=ip,
        created_at=datetime.now(ZoneInfo("Africa/Nairobi"))
    )
    db.session.add(entry)