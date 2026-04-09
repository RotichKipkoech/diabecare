"""
DiabeCare Scheduler - APScheduler background jobs
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import logging

logger = logging.getLogger(__name__)
NAIROBI = ZoneInfo("Africa/Nairobi")


def send_reminders(app):
    """Sends SMS reminders for appointments happening in ~24 hours. Requires SMS_ENABLED."""
    with app.app_context():
        try:
            from models import Appointment
            from config import Config
            if not Config.SMS_ENABLED:
                logger.info("[Scheduler] send_reminders skipped — SMS disabled")
                return
            from sms import sms_appointment_reminder
            now = datetime.now(NAIROBI)
            window_start = now + timedelta(hours=23)
            window_end = now + timedelta(hours=25)
            upcoming = Appointment.query.filter(
                Appointment.status == "scheduled",
                Appointment.appointment_date >= window_start,
                Appointment.appointment_date <= window_end
            ).all()
            logger.info(f"[Scheduler] send_reminders: {len(upcoming)} appointments in window")
            for appt in upcoming:
                patient = appt.patient
                phone = patient.phone if patient else None
                if not phone:
                    logger.info(f"[Scheduler] Skipping appt #{appt.id} — no phone")
                    continue
                doctor = appt.doctor
                doctor_name = doctor.full_name if doctor else "your doctor"
                sms_appointment_reminder(
                    patient_name=patient.name,
                    phone=phone,
                    appointment_date=appt.appointment_date,
                    doctor_name=doctor_name,
                    appt_type=appt.type
                )
                logger.info(f"[Scheduler] Reminder sent for appt #{appt.id} to {patient.name}")
        except Exception as e:
            logger.error(f"[Scheduler] send_reminders error: {e}")


def send_missed_phase1(app):
    """
    Phase 1 — runs at 6:00 PM daily.
    Catches appointments missed earlier that same day (1h–8h ago) and sends first SMS.
    Window is kept tight (1h–8h) so the 10 AM job doesn't double-send.
    """
    with app.app_context():
        try:
            from models import Appointment, Notification, db
            from config import Config
            now = datetime.now(NAIROBI)
            sms_ok = Config.SMS_ENABLED

            newly_missed = Appointment.query.filter(
                Appointment.status == "scheduled",
                Appointment.appointment_date < now - timedelta(hours=2),
                Appointment.appointment_date >= now - timedelta(hours=9)
            ).all()

            for appt in newly_missed:
                appt.status = "missed"
                patient = appt.patient
                logger.info(f"[Scheduler] Phase1 (6PM): marked appt #{appt.id} missed ({patient.name if patient else '?'})")
                if patient:
                    if sms_ok and patient.phone:
                        from sms import sms_appointment_missed
                        doctor_name = appt.doctor.full_name if appt.doctor else "your doctor"
                        sms_appointment_missed(
                            patient_name=patient.name,
                            phone=patient.phone,
                            appointment_date=appt.appointment_date,
                            doctor_name=doctor_name
                        )
                        logger.info(f"[Scheduler] Phase1 SMS sent to {patient.name}")
                    db.session.add(Notification(
                        user_id=patient.user_id,
                        title="Missed Appointment",
                        message=f"You missed your {appt.type} appointment today. Please reschedule as soon as possible.",
                        type="alert"
                    ))

            db.session.commit()
            logger.info(f"[Scheduler] Phase1 (6PM): {len(newly_missed)} appointments marked missed")
        except Exception as e:
            logger.error(f"[Scheduler] send_missed_phase1 error: {e}")


def send_missed_phase1_late(app):
    """
    Phase 1 Late — runs at 9:00 PM daily.
    Catches afternoon/evening appointments missed after the 6 PM run (1h–4h ago).
    Covers appointments between ~5:00 PM and 8:00 PM.
    """
    with app.app_context():
        try:
            from models import Appointment, Notification, db
            from config import Config
            now = datetime.now(NAIROBI)
            sms_ok = Config.SMS_ENABLED

            newly_missed = Appointment.query.filter(
                Appointment.status == "scheduled",
                Appointment.appointment_date < now - timedelta(hours=1),
                Appointment.appointment_date >= now - timedelta(hours=4)
            ).all()

            for appt in newly_missed:
                appt.status = "missed"
                patient = appt.patient
                logger.info(f"[Scheduler] Phase1-Late (9PM): marked appt #{appt.id} missed ({patient.name if patient else '?'})")
                if patient:
                    if sms_ok and patient.phone:
                        from sms import sms_appointment_missed
                        doctor_name = appt.doctor.full_name if appt.doctor else "your doctor"
                        sms_appointment_missed(
                            patient_name=patient.name,
                            phone=patient.phone,
                            appointment_date=appt.appointment_date,
                            doctor_name=doctor_name
                        )
                        logger.info(f"[Scheduler] Phase1-Late SMS sent to {patient.name}")
                    db.session.add(Notification(
                        user_id=patient.user_id,
                        title="Missed Appointment",
                        message=f"You missed your {appt.type} appointment today. Please reschedule as soon as possible.",
                        type="alert"
                    ))

            db.session.commit()
            logger.info(f"[Scheduler] Phase1-Late (9PM): {len(newly_missed)} appointments marked missed")
        except Exception as e:
            logger.error(f"[Scheduler] send_missed_phase1_late error: {e}")


def detect_missed_appointments(app):
    """
    Phases 2 & 3 of missed appointment handler. Runs daily at 10:00 AM.
    Phase 1 (same-day detection) runs separately at 6:00 PM via send_missed_phase1().

    Phase 2 — Day 1 (missed since yesterday, still not rescheduled):
        Send FINAL WARNING: reschedule today or appointment will be cancelled.

    Phase 3 — Day 2 (missed 2+ days ago, no action taken):
        Auto-cancel the appointment. Send cancellation SMS.
    """
    with app.app_context():
        try:
            from models import Appointment, Notification, User, db
            from config import Config
            now = datetime.now(NAIROBI)
            today = now.date()
            sms_ok = Config.SMS_ENABLED

            # ── Phase 2: missed 24–48h ago → final warning SMS ──────────────
            phase2 = Appointment.query.filter(
                Appointment.status == "missed",
                Appointment.appointment_date < now - timedelta(hours=24),
                Appointment.appointment_date >= now - timedelta(hours=48)
            ).all()
            for appt in phase2:
                patient = appt.patient
                if not patient:
                    continue
                # Only send once per day — check notification sent today
                already_warned = Notification.query.filter(
                    Notification.user_id == patient.user_id,
                    Notification.title == f"Final Reschedule Warning — {appt.type}",
                    db.func.date(Notification.created_at) == today
                ).first()
                if already_warned:
                    continue
                logger.info(f"[Scheduler] Phase2: final warning for appt #{appt.id} ({patient.name})")
                if sms_ok and patient.phone:
                    from sms import sms_appointment_missed_final
                    doctor_name = appt.doctor.full_name if appt.doctor else "your doctor"
                    sms_appointment_missed_final(
                        patient_name=patient.name,
                        phone=patient.phone,
                        appointment_date=appt.appointment_date,
                        doctor_name=doctor_name,
                        appt_type=appt.type
                    )
                    logger.info(f"[Scheduler] Phase2 final warning SMS sent to {patient.name}")
                db.session.add(Notification(
                    user_id=patient.user_id,
                    title=f"Final Reschedule Warning — {appt.type}",
                    message=f"FINAL NOTICE: Your missed {appt.type} appointment will be automatically cancelled tomorrow if you do not reschedule.",
                    type="alert"
                ))

            # ── Phase 3: missed 48h+ ago → auto-cancel ──────────────────────
            phase3 = Appointment.query.filter(
                Appointment.status == "missed",
                Appointment.appointment_date < now - timedelta(hours=48)
            ).all()
            for appt in phase3:
                appt.status = "cancelled"
                patient = appt.patient
                logger.info(f"[Scheduler] Phase3: auto-cancelled appt #{appt.id} ({patient.name if patient else 'unknown'})")
                if patient:
                    if sms_ok and patient.phone:
                        from sms import sms_appointment_auto_cancelled
                        doctor_name = appt.doctor.full_name if appt.doctor else "your doctor"
                        sms_appointment_auto_cancelled(
                            patient_name=patient.name,
                            phone=patient.phone,
                            appointment_date=appt.appointment_date,
                            doctor_name=doctor_name,
                            appt_type=appt.type
                        )
                        logger.info(f"[Scheduler] Phase3 auto-cancel SMS sent to {patient.name}")
                    db.session.add(Notification(
                        user_id=patient.user_id,
                        title="Appointment Auto-Cancelled",
                        message=f"Your {appt.type} appointment has been automatically cancelled due to non-attendance. Please contact DiabeCare to book a new appointment.",
                        type="alert"
                    ))
                # Notify admin
                admins = User.query.filter_by(role='admin').all()
                for admin in admins:
                    db.session.add(Notification(
                        user_id=admin.id,
                        title=f"Auto-Cancelled — {patient.name if patient else 'Patient'}",
                        message=f"{patient.name if patient else 'A patient'}'s {appt.type} appointment was auto-cancelled after 48h of no reschedule.",
                        type="info"
                    ))

            db.session.commit()
            logger.info(f"[Scheduler] detect_missed (10AM): P2={len(phase2)}, P3={len(phase3)}")
        except Exception as e:
            logger.error(f"[Scheduler] detect_missed_appointments error: {e}")


def send_refill_reminders(app):
    """Sends SMS refill reminders for medications due in 2 days AND 1 day ahead.
    Runs daily at 9am Kenya time. Requires SMS_ENABLED."""
    with app.app_context():
        try:
            from models import Medication
            from config import Config
            if not Config.SMS_ENABLED:
                logger.info("[Scheduler] send_refill_reminders skipped — SMS disabled")
                return
            from sms import sms_refill_reminder
            today = datetime.now(NAIROBI).date()

            for days_ahead in [2, 1]:
                reminder_date = today + timedelta(days=days_ahead)
                due_meds = Medication.query.filter(
                    Medication.refill_date == reminder_date,
                    Medication.completed == False
                ).all()
                label = f"{days_ahead} day{'s' if days_ahead > 1 else ''}"
                logger.info(f"[Scheduler] send_refill_reminders ({label}): {len(due_meds)} medications")
                for med in due_meds:
                    patient = med.patient
                    if not patient or not patient.phone:
                        continue
                    sms_refill_reminder(
                        patient_name=patient.name,
                        phone=patient.phone,
                        medication_name=med.name,
                        dosage=med.dosage,
                        refill_date=med.refill_date
                    )
                    logger.info(f"[Scheduler] Refill reminder ({label}) sent for {med.name} to {patient.name}")
        except Exception as e:
            logger.error(f"[Scheduler] send_refill_reminders error: {e}")




def notify_overdue_requests(app):
    """
    Find requested appointments whose date has passed (overdue).
    Send in-app notifications to admins and assigned doctor.
    Does NOT change the status — stays 'requested' so admin can still act.
    """
    with app.app_context():
        try:
            from models import Appointment, Notification, User, db
            from config import Config
            now = datetime.now(NAIROBI)

            overdue = Appointment.query.filter(
                Appointment.status.in_(['requested', 'scheduled']),
                Appointment.appointment_date < now
            ).all()

            for appt in overdue:
                patient = appt.patient
                if not patient:
                    continue

                date_str = appt.appointment_date.strftime('%b %d, %Y at %I:%M %p')

                # Notify admins
                admins = User.query.filter_by(role='admin').all()
                for admin in admins:
                    # Avoid duplicate notifications — check if one was sent today
                    from datetime import date as _date
                    existing = Notification.query.filter(
                        Notification.user_id == admin.id,
                        Notification.title == f'Overdue Request — {patient.name}',
                        db.func.date(Notification.created_at) == _date.today()
                    ).first()
                    if not existing:
                        db.session.add(Notification(
                            user_id=admin.id,
                            title=f'Overdue Request — {patient.name}',
                            message=f"{patient.name}'s {appt.type} appointment ({appt.status}) scheduled for {date_str} has passed without being completed or rescheduled.",
                            type='alert'
                        ))
                        logger.info(f"[Scheduler] Overdue notification sent for appt #{appt.id}")

                # Notify assigned doctor
                if patient.assigned_doctor_id:
                    existing_doc = Notification.query.filter(
                        Notification.user_id == patient.assigned_doctor_id,
                        Notification.title == f'Overdue Request — {patient.name}',
                        db.func.date(Notification.created_at) == _date.today()
                    ).first()
                    if not existing_doc:
                        db.session.add(Notification(
                            user_id=patient.assigned_doctor_id,
                            title=f'Overdue Request — {patient.name}',
                            message=f"{patient.name}'s {appt.type} appointment ({appt.status}) for {date_str} is overdue — please complete or reschedule it.",
                            type='alert'
                        ))
                        # SMS the doctor about the overdue request
                        if Config.SMS_ENABLED:
                            from sms import sms_overdue_request_doctor
                            doctor = User.query.get(patient.assigned_doctor_id)
                            if doctor and doctor.phone:
                                sms_overdue_request_doctor(
                                    doctor_name=doctor.full_name,
                                    phone=doctor.phone,
                                    patient_name=patient.name,
                                    appointment_date=appt.appointment_date,
                                    appt_type=appt.type
                                )
                                logger.info(f"[Scheduler] Overdue SMS sent to Dr. {doctor.full_name} for appt #{appt.id}")

            db.session.commit()
        except Exception as e:
            logger.error(f"[Scheduler] notify_overdue_requests error: {e}")



def handle_overdue_medications(app):
    """
    Runs daily at 7:00 AM.
    Finds active medications whose refill_date has passed by 3–4+ days
    and have NOT been marked completed or refilled.

    Action:
    - Marks medication as completed=True (removes from active patient view)
    - Sends in-app notification to patient (SMS if enabled)
    - Sends in-app notification to assigned doctor
    """
    with app.app_context():
        try:
            from models import Medication, Notification, Patient, User, db
            from config import Config
            from datetime import date as _date

            today      = _date.today()
            cutoff     = today - timedelta(days=3)   # overdue by 3+ days

            overdue_meds = Medication.query.filter(
                Medication.completed == False,
                Medication.refill_date != None,
                Medication.refill_date <= cutoff
            ).all()

            logger.info(f"[Scheduler] handle_overdue_medications: {len(overdue_meds)} overdue meds found")

            for med in overdue_meds:
                patient = med.patient
                if not patient:
                    continue

                days_overdue = (today - med.refill_date).days
                logger.info(
                    f"[Scheduler] Auto-removing {med.name} for {patient.name} "
                    f"({days_overdue}d overdue)"
                )

                # ── Mark as completed (removes from active view) ──────
                med.completed = True

                # ── In-app notification → patient ─────────────────────
                if patient.user_id:
                    db.session.add(Notification(
                        user_id=patient.user_id,
                        title=f'Medication Removed — {med.name}',
                        message=(
                            f'Your medication {med.name} {med.dosage} has been removed '
                            f'from your active list as the refill date passed {days_overdue} '
                            f'day{"s" if days_overdue != 1 else ""} ago. '
                            f'Please contact your doctor if you still require it.'
                        ),
                        type='alert'
                    ))

                # ── SMS → patient (if enabled) ────────────────────────
                if Config.SMS_ENABLED and patient.phone:
                    from sms import sms_medication_overdue_removed
                    sms_medication_overdue_removed(
                        patient_name=patient.name,
                        phone=patient.phone,
                        medication_name=med.name,
                        dosage=med.dosage,
                        days_overdue=days_overdue
                    )

                # ── In-app notification → assigned doctor ─────────────
                if patient.assigned_doctor_id:
                    db.session.add(Notification(
                        user_id=patient.assigned_doctor_id,
                        title=f'Overdue Medication Auto-Removed — {patient.name}',
                        message=(
                            f'{med.name} {med.dosage} prescribed to {patient.name} '
                            f'was automatically removed after being {days_overdue} '
                            f'day{"s" if days_overdue != 1 else ""} past its refill date '
                            f'without a refill or completion. Please review and re-prescribe if needed.'
                        ),
                        type='alert'
                    ))

            db.session.commit()
            logger.info(f"[Scheduler] handle_overdue_medications: {len(overdue_meds)} medications processed")
        except Exception as e:
            logger.error(f"[Scheduler] handle_overdue_medications error: {e}")

def auto_mark_medications_missed(app):
    """
    Runs daily at 22:59 (Africa/Nairobi).

    For every active (non-completed) medication, if the patient has NOT
    logged a taken/missed entry for today, automatically create a
    MedicationLog with taken=False (missed).

    After logging, recalculates adherence_rate and updates patient status
    for every affected patient so dashboards stay accurate overnight.

    No SMS or in-app notification is sent here — this is a silent data
    housekeeping job. Patients already receive morning reminders separately.
    """
    with app.app_context():
        try:
            from models import Medication, MedicationLog, Patient, db
            from datetime import date as _date

            today = datetime.now(NAIROBI).date()  # use Kenya date, not server UTC

            # Fetch all active medications in one query
            active_meds = Medication.query.filter(
                Medication.completed == False
            ).all()

            if not active_meds:
                logger.info("[Scheduler] auto_mark_missed: no active medications found")
                return

            # Build a set of (medication_id, patient_id) pairs already logged today
            # — single query is much cheaper than N individual lookups
            existing_logs = MedicationLog.query.filter(
                MedicationLog.date == today
            ).all()
            logged_today = {(log.medication_id, log.patient_id) for log in existing_logs}

            # Collect ALL patients with active meds for recalculation
            # (not just newly-missed — patients who clicked manually also need updating)
            all_patient_ids: dict[int, Patient] = {}
            new_logs = 0

            for med in active_meds:
                # Track every patient with active meds
                if med.patient_id not in all_patient_ids and med.patient:
                    all_patient_ids[med.patient_id] = med.patient

                key = (med.id, med.patient_id)
                if key in logged_today:
                    continue  # already logged (taken or missed) — skip

                # Create a missed log for unlogged medication
                db.session.add(MedicationLog(
                    medication_id=med.id,
                    patient_id=med.patient_id,
                    date=today,
                    taken=False
                ))
                new_logs += 1

            logger.info(
                f"[Scheduler] auto_mark_missed: {new_logs} new missed logs created "
                f"— recalculating adherence for {len(all_patient_ids)} patients"
            )

            # Flush so the new missed logs are visible in the adherence query
            db.session.flush()

            # Recalculate adherence + status for ALL patients with active meds
            # Using Kenya date to stay consistent with MedicationLog.date entries
            from datetime import timedelta as _td
            nairobi_today = datetime.now(NAIROBI).date()
            start_date    = nairobi_today - _td(days=30)

            for patient in all_patient_ids.values():
                # Only count logs for active (non-completed) medications
                active_med_ids = [
                    m.id for m in patient.medications if not m.completed
                ]
                if not active_med_ids:
                    patient.adherence_rate = 100.0
                else:
                    logs_30d = MedicationLog.query.filter(
                        MedicationLog.patient_id == patient.id,
                        MedicationLog.medication_id.in_(active_med_ids),
                        MedicationLog.date >= start_date
                    ).all()

                    if logs_30d:
                        taken_count = sum(1 for l in logs_30d if l.taken)
                        patient.adherence_rate = round((taken_count / len(logs_30d)) * 100, 2)
                    else:
                        patient.adherence_rate = 100.0

                adherence = float(patient.adherence_rate)
                if adherence >= 80:
                    patient.status = "stable"
                elif adherence >= 50:
                    patient.status = "warning"
                else:
                    patient.status = "critical"

                logger.info(
                    f"[Scheduler] auto_mark_missed: {patient.name} → "
                    f"adherence={patient.adherence_rate}% status={patient.status}"
                )

            db.session.commit()
            logger.info("[Scheduler] auto_mark_missed: committed successfully")

        except Exception as e:
            logger.error(f"[Scheduler] auto_mark_medications_missed error: {e}")


def start_scheduler(app):
    scheduler = BackgroundScheduler(timezone=NAIROBI)
    scheduler.add_job(
        func=lambda: send_reminders(app),
        trigger=CronTrigger(hour=8, minute=0, timezone=NAIROBI),
        id="appointment_reminders",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: send_missed_phase1(app),
        trigger=CronTrigger(hour=18, minute=0, timezone=NAIROBI),
        id="missed_phase1_evening",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: send_missed_phase1_late(app),
        trigger=CronTrigger(hour=21, minute=0, timezone=NAIROBI),
        id="missed_phase1_night",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: detect_missed_appointments(app),
        trigger=CronTrigger(hour=10, minute=0, timezone=NAIROBI),
        id="missed_phase2_3",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: send_refill_reminders(app),
        trigger=CronTrigger(hour=9, minute=0, timezone=NAIROBI),
        id="refill_reminders",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: notify_overdue_requests(app),
        trigger=CronTrigger(hour=11, minute=0, timezone=NAIROBI),
        id="overdue_requests",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: handle_overdue_medications(app),
        trigger=CronTrigger(hour=7, minute=0, timezone=NAIROBI),
        id="overdue_medications",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: auto_mark_medications_missed(app),
        trigger=CronTrigger(hour=22, minute=59, timezone=NAIROBI),
        id="auto_mark_medications_missed",
        replace_existing=True
    )
    scheduler.start()
    logger.info("[Scheduler] Started")
    return scheduler