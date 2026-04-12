from datetime import datetime, date
from zoneinfo import ZoneInfo
from extensions import db

def _kenya_now():
    """Return current Kenya time (EAT = UTC+3) as a naive datetime.

    Render servers run on UTC. Storing naive Kenya-local datetimes means
    every timestamp displayed to users is already in the correct timezone
    without any frontend conversion.  All scheduler jobs already use
    NAIROBI = ZoneInfo("Africa/Nairobi") so this stays consistent.
    """
    return datetime.now(ZoneInfo("Africa/Nairobi")).replace(tzinfo=None)

# Alias kept so any remaining references to _utcnow still work
_utcnow = _kenya_now


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('admin', 'doctor', 'patient', name='user_role'), nullable=False, default='patient')
    full_name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20), default='')
    avatar_url = db.Column(db.Text, nullable=True)   # base64 data-URI or external URL
    created_at = db.Column(db.DateTime, default=_utcnow)

    # Relationships
    patient_record = db.relationship('Patient', backref='user', foreign_keys='Patient.user_id', lazy=True)
    assigned_patients = db.relationship('Patient', backref='doctor', foreign_keys='Patient.assigned_doctor_id', lazy=True)
    

    def to_dict(self, include_hash=False):
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'full_name': self.full_name,
            'phone': self.phone or '',
            'avatar_url': self.avatar_url or None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_hash:
            data['password_hash'] = self.password_hash
        return data


class Patient(db.Model):
    __tablename__ = 'patients'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    name = db.Column(db.String(200), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.Enum('Male', 'Female', name='gender_enum'), nullable=False)
    diabetes_type = db.Column(db.Enum('Type 1', 'Type 2', 'Gestational', name='diabetes_type_enum'), nullable=False)
    phone = db.Column(db.String(20), default='')
    email = db.Column(db.String(255), default='')
    blood_sugar = db.Column(db.Numeric(6, 2), default=0)
    hba1c = db.Column(db.Numeric(4, 2), default=0)
    adherence_rate = db.Column(db.Numeric(5, 2), default=0)
    status = db.Column(db.Enum('stable', 'warning', 'critical', name='patient_status_enum'), default='stable')
    last_visit = db.Column(db.Date, nullable=True)
    next_visit = db.Column(db.Date, nullable=True)
    assigned_doctor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    assigned_doctor = db.relationship('User',foreign_keys=[assigned_doctor_id],lazy='joined')
    created_at = db.Column(db.DateTime, default=_utcnow)

    # Relationships
    medications = db.relationship('Medication', backref='patient', cascade='all, delete-orphan', lazy=True)
    appointments = db.relationship('Appointment', backref='patient', cascade='all, delete-orphan', lazy=True)
    

    def to_dict(self, include_medications=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'age': self.age,
            'gender': self.gender,
            'diabetes_type': self.diabetes_type,
            'phone': self.phone or '',
            'email': self.email or '',
            'blood_sugar': float(self.blood_sugar) if self.blood_sugar else 0,
            'hba1c': float(self.hba1c) if self.hba1c else 0,
            'adherence_rate': float(self.adherence_rate) if self.adherence_rate else 0,
            'status': self.status,
            'last_visit': self.last_visit.isoformat() if self.last_visit else None,
            'next_visit': self.next_visit.isoformat() if self.next_visit else None,
            'assigned_doctor_id': self.assigned_doctor_id,
            'assigned_doctor_name': self.assigned_doctor.full_name if self.assigned_doctor else None,
            'assigned_doctor_phone': self.assigned_doctor.phone if self.assigned_doctor else None,
            'avatar_url': self.user.avatar_url if self.user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_medications:
            data['medications'] = [m.to_dict() for m in self.medications if not m.completed]
        return data


class Medication(db.Model):
    __tablename__ = 'medications'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    dosage = db.Column(db.String(100), nullable=False)
    frequency = db.Column(db.String(100), nullable=False)
    time = db.Column(db.String(100), default='')
    refill_date = db.Column(db.Date, nullable=True)
    prescribed_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    completed = db.Column(db.Boolean, default=False) 
    created_at = db.Column(db.DateTime, default=_utcnow)

    logs = db.relationship('MedicationLog', backref='medication', cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'name': self.name,
            'dosage': self.dosage,
            'frequency': self.frequency,
            'time': self.time or '',
            'refill_date': self.refill_date.isoformat() if self.refill_date else None,
            'prescribed_by': self.prescribed_by,
            'completed': self.completed or False,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'taken_today': getattr(self, 'taken_today', False),
        }


class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    appointment_date = db.Column(db.DateTime, nullable=False)
    type = db.Column(db.String(100), default='Follow-up')
    status = db.Column(db.Enum('scheduled', 'completed', 'cancelled', 'requested', 'missed', name='appointment_status_enum'), default='scheduled')
    notes = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=_utcnow)

    # Relationship to doctor
    doctor = db.relationship('User', foreign_keys=[doctor_id], lazy=True)

    def to_dict(self):
        # FIXED: Return the appointment date as a naive ISO string WITHOUT +03:00
        # The date is stored in Kenya time, and we want the frontend to display it as-is.
        # By not adding a timezone, the frontend will treat it as UTC and then convert to local time.
        # Since the user is in Kenya (UTC+3), adding 3 hours to UTC will give the correct local time.
        appointment_date_str = None
        if self.appointment_date:
            # Return the ISO string without any timezone modification
            # This will be "2024-01-15T14:30:00" which JavaScript will parse as UTC
            # When displayed with toLocaleString(), it will convert to Kenya time (+3 hours)
            # giving the correct wall-clock time of 17:30 (5:30 PM) for a 2:30 PM appointment
            appointment_date_str = self.appointment_date.isoformat()
        
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'doctor_id': self.doctor_id,
            'appointment_date': appointment_date_str,
            'type': self.type,
            'status': self.status,
            'notes': self.notes or '',
            'patient_name': self.patient.name if self.patient else None,
            'doctor_name': self.doctor.full_name if self.doctor else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default="info") 
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_utcnow)

    user = db.relationship("User", backref="notifications")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "read": self.read,
            "created_at": self.created_at.isoformat(),
        }
    

class MedicationLog(db.Model):
    __tablename__ = 'medication_logs'

    id = db.Column(db.Integer, primary_key=True)
    medication_id = db.Column(db.Integer, db.ForeignKey('medications.id', ondelete='CASCADE'), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    taken = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_utcnow)

    patient = db.relationship('Patient', backref='medication_logs')

    def to_dict(self):
        return {
            "id": self.id,
            "medication_id": self.medication_id,
            "patient_id": self.patient_id,
            "date": self.date.isoformat(),
            "taken": self.taken,
            "created_at": self.created_at.isoformat(),
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    target = db.Column(db.String(200), default='')
    description = db.Column(db.Text, default='')
    ip_address = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)

    user = db.relationship('User', backref='audit_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'user_name': self.user.full_name if self.user else 'System',
            'user_role': self.user.role if self.user else 'system',
            'action': self.action,
            'target': self.target or '',
            'description': self.description or '',
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat(),
        }


class SystemConfig(db.Model):
    """Key-value store for system-wide settings like maintenance state."""
    __tablename__ = 'system_config'

    id    = db.Column(db.Integer, primary_key=True, autoincrement=True)
    key   = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)

    @staticmethod
    def get(key: str, default=None):
        row = SystemConfig.query.filter_by(key=key).first()
        return row.value if row else default

    @staticmethod
    def set(key: str, value: str):
        row = SystemConfig.query.filter_by(key=key).first()
        if row:
            row.value = value
        else:
            row = SystemConfig(key=key, value=value)
            db.session.add(row)
        # caller must commit


class TokenBlocklist(db.Model):
    """Stores revoked JWT tokens so they cannot be reused after logout."""
    __tablename__ = 'token_blocklist'

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    jti        = db.Column(db.String(36), nullable=False, unique=True, index=True)  # JWT ID
    created_at = db.Column(db.DateTime, default=_utcnow)

    @staticmethod
    def is_blocked(jti: str) -> bool:
        return db.session.query(
            TokenBlocklist.query.filter_by(jti=jti).exists()
        ).scalar()


class DashboardFeature(db.Model):
    """Stores dashboard feature toggles — admin configures, dashboards consume."""
    __tablename__ = 'dashboard_features'

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title       = db.Column(db.String(200), nullable=False, unique=True)
    description = db.Column(db.String(500), default='')
    type        = db.Column(db.Enum('stat', 'chart', 'list', 'alert', name='feature_type_enum'), nullable=False, default='stat')
    target_role = db.Column(db.Enum('doctor', 'patient', name='feature_target_role_enum'), nullable=False)
    enabled     = db.Column(db.Boolean, default=True)
    value       = db.Column(db.String(100), default='')
    unit        = db.Column(db.String(50), default='')
    is_builtin  = db.Column(db.Boolean, default=False)  
    created_at  = db.Column(db.DateTime, default=_utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'title':       self.title,
            'description': self.description,
            'type':        self.type,
            'targetRole':  self.target_role,
            'enabled':     self.enabled,
            'value':       self.value or '',
            'unit':        self.unit or '',
            'isBuiltin':   self.is_builtin,
        }


class SmsLog(db.Model):
    """Tracks every SMS send attempt — success and failure."""
    __tablename__ = 'sms_logs'

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    recipient    = db.Column(db.String(20), nullable=False)
    recipient_name = db.Column(db.String(200), nullable=True)
    recipient_role = db.Column(db.String(20),  nullable=True)
    message      = db.Column(db.Text, nullable=False)
    category     = db.Column(db.String(100), default='general')
    status       = db.Column(db.Enum('sent', 'failed', 'disabled', name='sms_status_enum'), default='sent')
    error        = db.Column(db.Text, nullable=True)
    created_at   = db.Column(db.DateTime, default=_utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'recipient':    self.recipient,
            'recipient_name': self.recipient_name or '—',
            'recipient_role': self.recipient_role or 'patient',
            'message':      self.message,
            'category':     self.category,
            'status':       self.status,
            'error':        self.error or '',
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }