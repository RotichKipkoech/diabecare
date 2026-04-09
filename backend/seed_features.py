from app import create_app
from extensions import db
from models import DashboardFeature

BUILTIN_FEATURES = [
    # ── Doctor dashboard ─────────────────────────────────────────────
    { 'title': 'My Patients Count',      'description': 'Total assigned patients stat card',          'type': 'stat',  'target_role': 'doctor' },
    { 'title': 'Patient Adherence Trend','description': '6-month medication adherence area chart',     'type': 'chart', 'target_role': 'doctor' },
    { 'title': 'Critical Patients Alert','description': 'Alert banner for critical-status patients',   'type': 'alert', 'target_role': 'doctor' },
    { 'title': "Today's Appointments",   'description': "Count of today's scheduled appointments",     'type': 'stat',  'target_role': 'doctor' },
    { 'title': 'Avg Blood Sugar Chart',  'description': '7-day average blood sugar trend chart',       'type': 'chart', 'target_role': 'doctor' },
    # ── Patient dashboard ────────────────────────────────────────────
    { 'title': 'Blood Sugar Level',      'description': 'Current blood sugar stat card',               'type': 'stat',  'target_role': 'patient' },
    { 'title': 'HbA1c Reading',          'description': 'Latest HbA1c percentage stat card',           'type': 'stat',  'target_role': 'patient' },
    { 'title': 'Medication Schedule',    'description': 'Today\'s medication list with taken/missed toggle', 'type': 'list', 'target_role': 'patient' },
    { 'title': 'Blood Sugar Trend Chart','description': '7-day personal blood sugar trend chart',      'type': 'chart', 'target_role': 'patient' },
    { 'title': 'Upcoming Appointments',  'description': 'List of upcoming scheduled appointments',     'type': 'list',  'target_role': 'patient' },
]

def seed():
    app = create_app()
    with app.app_context():
        added = 0
        for f in BUILTIN_FEATURES:
            exists = DashboardFeature.query.filter_by(title=f['title']).first()
            if not exists:
                db.session.add(DashboardFeature(
                    title=f['title'],
                    description=f['description'],
                    type=f['type'],
                    target_role=f['target_role'],
                    enabled=True,
                    is_builtin=True
                ))
                added += 1
        db.session.commit()
        print(f"Seeded {added} built-in features ({len(BUILTIN_FEATURES) - added} already existed).")

if __name__ == '__main__':
    seed()