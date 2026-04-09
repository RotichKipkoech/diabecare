import bcrypt
from datetime import date, datetime
from app import create_app
from extensions import db
from models import User, Patient, Medication, Appointment


def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def seed():
    app = create_app()
    with app.app_context():
        if User.query.first():
            print("Database already seeded — skipping.")
            return

        # ── Users ──────────────────────────────────────────────
        admin = User(username='admin', email='admin@diabecare.com', password_hash=hash_pw('admin123'),
                     role='admin', full_name='System Administrator', phone='+1 (555) 000-0000')

        doctor1 = User(username='dr.wilson', email='wilson@diabecare.com', password_hash=hash_pw('doctor123'),
                       role='doctor', full_name='Dr. Sarah Wilson', phone='+1 (555) 111-0000')

        doctor2 = User(username='dr.khan', email='khan@diabecare.com', password_hash=hash_pw('doctor123'),
                       role='doctor', full_name='Dr. Ahmed Khan', phone='+1 (555) 111-0001')

        p_users = [
            User(username='sarah.j', email='sarah.j@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Sarah Johnson', phone='+1 (555) 123-4567'),
            User(username='mchen', email='mchen@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Michael Chen', phone='+1 (555) 234-5678'),
            User(username='emily.r', email='emily.r@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Emily Rodriguez', phone='+1 (555) 345-6789'),
            User(username='jwilliams', email='jwilliams@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='James Williams', phone='+1 (555) 456-7890'),
            User(username='priya.p', email='priya.p@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Priya Patel', phone='+1 (555) 567-8901'),
            User(username='rdavis', email='rdavis@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Robert Davis', phone='+1 (555) 678-9012'),
            User(username='lisa.t', email='lisa.t@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Lisa Thompson', phone='+1 (555) 789-0123'),
            User(username='dkim', email='dkim@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='David Kim', phone='+1 (555) 890-1234'),
            User(username='anna.m', email='anna.m@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Anna Martinez', phone='+1 (555) 901-2345'),
            User(username='rjohnson', email='rjohnson@email.com', password_hash=hash_pw('patient123'),
                 role='patient', full_name='Robert Johnson', phone='+1 (555) 012-3456'),
        ]

        users = [admin, doctor1, doctor2] + p_users
        db.session.add_all(users)
        db.session.flush()

        # ── Patients ──────────────────────────────────────────
        patients_data = [
            dict(user=p_users[0], name='Sarah Johnson', age=54, gender='Female',
                 dtype='Type 2', bs=142, hba1c=7.2, adh=92, status='stable',
                 last=date(2026, 2, 10), nxt=date(2026, 3, 10), doc=doctor1),
            dict(user=p_users[1], name='Michael Chen', age=62, gender='Male',
                 dtype='Type 2', bs=198, hba1c=8.9, adh=61, status='critical',
                 last=date(2026, 2, 5), nxt=date(2026, 2, 20), doc=doctor1),
            dict(user=p_users[2], name='Emily Rodriguez', age=45, gender='Female',
                 dtype='Type 1', bs=118, hba1c=6.5, adh=97, status='stable',
                 last=date(2026, 2, 14), nxt=date(2026, 3, 14), doc=doctor1),
            dict(user=p_users[3], name='James Williams', age=58, gender='Male',
                 dtype='Type 2', bs=167, hba1c=7.8, adh=74, status='warning',
                 last=date(2026, 1, 28), nxt=date(2026, 2, 28), doc=doctor1),
            dict(user=p_users[4], name='Priya Patel', age=38, gender='Female',
                 dtype='Gestational', bs=130, hba1c=6.8, adh=88, status='stable',
                 last=date(2026, 2, 16), nxt=date(2026, 2, 23), doc=doctor2),
            dict(user=p_users[5], name='Robert Davis', age=71, gender='Male',
                 dtype='Type 2', bs=210, hba1c=9.3, adh=52, status='critical',
                 last=date(2026, 2, 1), nxt=date(2026, 2, 19), doc=doctor2),
            dict(user=p_users[6], name='Lisa Thompson', age=49, gender='Female',
                 dtype='Type 2', bs=155, hba1c=7.5, adh=80, status='warning',
                 last=date(2026, 2, 12), nxt=date(2026, 3, 5), doc=doctor1),
            dict(user=p_users[7], name='David Kim', age=35, gender='Male',
                 dtype='Type 1', bs=125, hba1c=6.9, adh=91, status='stable',
                 last=date(2026, 2, 18), nxt=date(2026, 3, 18), doc=doctor2),
            dict(user=p_users[8], name='Anna Martinez', age=60, gender='Female',
                 dtype='Type 2', bs=185, hba1c=8.4, adh=65, status='warning',
                 last=date(2026, 2, 8), nxt=date(2026, 2, 25), doc=doctor2),
            dict(user=p_users[9], name='Robert Johnson', age=67, gender='Male',
                 dtype='Type 2', bs=220, hba1c=9.6, adh=48, status='critical',
                 last=date(2026, 1, 30), nxt=date(2026, 2, 18), doc=doctor1),
        ]

        patients = []
        for d in patients_data:
            p = Patient(
                user_id=d['user'].id, name=d['name'], age=d['age'], gender=d['gender'],
                diabetes_type=d['dtype'], phone=d['user'].phone, email=d['user'].email,
                blood_sugar=d['bs'], hba1c=d['hba1c'], adherence_rate=d['adh'],
                status=d['status'], last_visit=d['last'], next_visit=d['nxt'],
                assigned_doctor_id=d['doc'].id,
            )
            patients.append(p)
        db.session.add_all(patients)
        db.session.flush()

        # ── Medications ───────────────────────────────────────
        def med(pi, name, dosage, freq, time, taken, refill, doc):
            return Medication(patient_id=patients[pi].id, name=name, dosage=dosage,
                              frequency=freq, time=time, taken=taken,
                              refill_date=refill, prescribed_by=doc.id)

        meds = [
            # Sarah Johnson (0)
            med(0, 'Metformin', '500mg', 'Twice daily', '08:00 AM, 08:00 PM', True, date(2026, 3, 1), doctor1),
            med(0, 'Glipizide', '5mg', 'Once daily', '08:00 AM', True, date(2026, 3, 15), doctor1),
            med(0, 'Lisinopril', '10mg', 'Once daily', '09:00 AM', False, date(2026, 2, 28), doctor1),
            # Michael Chen (1)
            med(1, 'Insulin Glargine', '20 units', 'Once daily', '10:00 PM', False, date(2026, 2, 25), doctor1),
            med(1, 'Metformin', '1000mg', 'Twice daily', '08:00 AM, 08:00 PM', True, date(2026, 3, 10), doctor1),
            med(1, 'Losartan', '50mg', 'Once daily', '09:00 AM', False, date(2026, 3, 5), doctor1),
            # Emily Rodriguez (2)
            med(2, 'Insulin Lispro', '10 units', 'Three times daily', '07:30 AM, 12:30 PM, 06:30 PM', True, date(2026, 3, 5), doctor1),
            med(2, 'Insulin Glargine', '15 units', 'Once daily', '10:00 PM', True, date(2026, 3, 5), doctor1),
            # James Williams (3)
            med(3, 'Metformin', '850mg', 'Twice daily', '08:00 AM, 08:00 PM', True, date(2026, 3, 1), doctor1),
            med(3, 'Sitagliptin', '100mg', 'Once daily', '08:00 AM', False, date(2026, 2, 20), doctor1),
            med(3, 'Atorvastatin', '20mg', 'Once daily', '09:00 PM', True, date(2026, 3, 10), doctor1),
            # Priya Patel (4)
            med(4, 'Insulin Aspart', '8 units', 'Three times daily', '07:00 AM, 12:00 PM, 06:00 PM', True, date(2026, 3, 1), doctor2),
            med(4, 'Folic Acid', '400mcg', 'Once daily', '08:00 AM', True, date(2026, 3, 20), doctor2),
            # Robert Davis (5)
            med(5, 'Insulin Glargine', '30 units', 'Once daily', '10:00 PM', False, date(2026, 2, 22), doctor2),
            med(5, 'Metformin', '1000mg', 'Twice daily', '08:00 AM, 08:00 PM', False, date(2026, 2, 22), doctor2),
            med(5, 'Empagliflozin', '25mg', 'Once daily', '08:00 AM', True, date(2026, 3, 1), doctor2),
            # Lisa Thompson (6)
            med(6, 'Metformin', '750mg', 'Twice daily', '08:00 AM, 08:00 PM', True, date(2026, 3, 8), doctor1),
            med(6, 'Pioglitazone', '15mg', 'Once daily', '08:00 AM', False, date(2026, 3, 1), doctor1),
            # David Kim (7)
            med(7, 'Insulin Lispro', '8 units', 'Three times daily', '07:00 AM, 12:00 PM, 06:00 PM', True, date(2026, 3, 12), doctor2),
            med(7, 'Insulin Detemir', '12 units', 'Once daily', '10:00 PM', True, date(2026, 3, 12), doctor2),
            # Anna Martinez (8)
            med(8, 'Metformin', '1000mg', 'Twice daily', '08:00 AM, 08:00 PM', True, date(2026, 3, 5), doctor2),
            med(8, 'Glimepiride', '2mg', 'Once daily', '08:00 AM', False, date(2026, 2, 28), doctor2),
            med(8, 'Amlodipine', '5mg', 'Once daily', '09:00 AM', True, date(2026, 3, 10), doctor2),
            # Robert Johnson (9)
            med(9, 'Insulin Glargine', '35 units', 'Once daily', '10:00 PM', False, date(2026, 2, 20), doctor1),
            med(9, 'Metformin', '1000mg', 'Twice daily', '08:00 AM, 08:00 PM', False, date(2026, 2, 20), doctor1),
            med(9, 'Dapagliflozin', '10mg', 'Once daily', '08:00 AM', False, date(2026, 2, 25), doctor1),
            med(9, 'Lisinopril', '20mg', 'Once daily', '09:00 AM', True, date(2026, 3, 5), doctor1),
        ]
        db.session.add_all(meds)

        # ── Appointments ──────────────────────────────────────
        appts = [
            Appointment(patient_id=patients[0].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 3, 10, 9, 30), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[1].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 2, 20, 10, 0), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[2].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 3, 14, 8, 0), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[3].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 2, 28, 11, 30), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[4].id, doctor_id=doctor2.id,
                        appointment_date=datetime(2026, 2, 23, 14, 0), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[5].id, doctor_id=doctor2.id,
                        appointment_date=datetime(2026, 2, 19, 15, 30), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[6].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 3, 5, 9, 0), type='Lab Review', status='scheduled'),
            Appointment(patient_id=patients[7].id, doctor_id=doctor2.id,
                        appointment_date=datetime(2026, 3, 18, 10, 30), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[8].id, doctor_id=doctor2.id,
                        appointment_date=datetime(2026, 2, 25, 13, 0), type='Follow-up', status='scheduled'),
            Appointment(patient_id=patients[9].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 2, 18, 8, 30), type='Urgent', status='scheduled'),
            # Some completed/cancelled for variety
            Appointment(patient_id=patients[0].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 2, 10, 9, 0), type='Follow-up', status='completed'),
            Appointment(patient_id=patients[1].id, doctor_id=doctor1.id,
                        appointment_date=datetime(2026, 2, 5, 10, 0), type='Follow-up', status='completed'),
            Appointment(patient_id=patients[5].id, doctor_id=doctor2.id,
                        appointment_date=datetime(2026, 2, 1, 14, 0), type='Follow-up', status='cancelled'),
        ]
        db.session.add_all(appts)

        db.session.commit()
        print("Database seeded successfully!")
        print(f"  Users: {len(users)} (admin/admin123, dr.wilson/doctor123, dr.khan/doctor123, patients/patient123)")
        print(f"  Patients: {len(patients)}")
        print(f"  Medications: {len(meds)}")
        print(f"  Appointments: {len(appts)}")


if __name__ == '__main__':
    seed()
