"""
DiabeCare SMS Service — TalkSasa
Handles all outbound SMS notifications via the TalkSasa Bulk SMS REST API.
SMS can be toggled on/off via the SMS_ENABLED config flag.

Provider : TalkSasa
Endpoint : https://bulksms.talksasa.com/api/v3/sms/send
Auth     : Bearer token in Authorization header
"""

import logging
import requests
from config import Config

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# TalkSasa credentials (loaded from Config / .env)
#
# Add these to your .env:
#   TALKSASA_API_KEY=2711|2Nu2K9QiPqmhwKD4bpauQ6uFm71zPMGpweAJfFMPd2bf6714
#   TALKSASA_SENDER_ID=PROCALL
#   TALKSASA_URL=https://bulksms.talksasa.com/api/v3/sms/send
# ─────────────────────────────────────────────────────────────────────────────

TALKSASA_URL       = getattr(Config, "TALKSASA_URL",       "https://bulksms.talksasa.com/api/v3/sms/send")
TALKSASA_API_KEY   = getattr(Config, "TALKSASA_API_KEY",   "2711|2Nu2K9QiPqmhwKD4bpauQ6uFm71zPMGpweAJfFMPd2bf6714")
TALKSASA_SENDER_ID = getattr(Config, "TALKSASA_SENDER_ID", "PROCALL")


def _normalize_phone(phone: str) -> str:
    """
    Convert phone numbers to the format TalkSasa expects: 2547XXXXXXXX (no +).
    Handles: 07XXXXXXXX, 7XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX
    """
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+254"):
        return phone[1:]          # strip leading +  → 2547XXXXXXXX
    if phone.startswith("254"):
        return phone              # already correct
    if phone.startswith("0"):
        return f"254{phone[1:]}"  # 07XX → 2547XX
    if phone.startswith("7") or phone.startswith("1"):
        return f"254{phone}"      # 7XX  → 2547XX
    return phone


def _log_sms(phone: str, message: str, category: str = 'general',
             status: str = 'sent', recipient_name: str = '',
             recipient_role: str = 'patient', error: str = '') -> None:
    """Persist an SMS log entry. Silently ignores DB errors."""
    try:
        from extensions import db
        from models import SmsLog
        db.session.add(SmsLog(
            recipient=phone, message=message, category=category,
            status=status, recipient_name=recipient_name or None,
            recipient_role=recipient_role or 'patient',
            error=error or None,
        ))
        db.session.commit()
    except Exception as e:
        logger.warning(f"[SMS] Log write failed: {e}")


def send_sms(phone: str, message: str, category: str = 'general',
             recipient_name: str = '', recipient_role: str = 'patient') -> bool:
    """
    Send a single SMS via TalkSasa Bulk SMS API.
    Returns True on success, False on failure.
    Respects the global SMS_ENABLED flag in Config.

    TalkSasa API contract:
      POST https://bulksms.talksasa.com/api/v3/sms/send
      Authorization: Bearer <api_key>
      Content-Type:  application/json
      Body: { "recipient": "2547XXXXXXXX", "sender_id": "PROCALL", "message": "..." }

    Success response: HTTP 200 with JSON containing "status": "success"
                   or HTTP 200 with JSON containing "data": { "status": "queued"|"sent" }
    """
    if not Config.SMS_ENABLED:
        logger.info(f"[SMS DISABLED] Would send to {phone}: {message}")
        _log_sms(phone, message, category, 'disabled', recipient_name, recipient_role)
        return False

    if not phone or phone.strip() in ("", "null", "None"):
        logger.warning("[SMS] Skipping — no phone number provided")
        return False

    try:
        normalized = _normalize_phone(phone)
        logger.info(f"[SMS] Attempting send to {normalized}")
        logger.info(f"[SMS] SenderID={TALKSASA_SENDER_ID}")
        logger.info(f"[SMS] Message: {message[:80]}...")

        payload = {
            "recipient":  normalized,
            "sender_id":  TALKSASA_SENDER_ID,
            "message":    message,
        }

        response = requests.post(
            TALKSASA_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {TALKSASA_API_KEY}",
                "Content-Type":  "application/json",
                "Accept":        "application/json",
            },
            timeout=15,
        )

        logger.info(f"[SMS] HTTP {response.status_code} | Response: {response.text[:300]}")

        if response.status_code in (200, 201):
            data = response.json()
            logger.info(f"[SMS] Parsed response: {data}")

            # ── TalkSasa success detection ──────────────────────────────────
            # TalkSasa returns one of:
            #   { "status": "success", ... }
            #   { "data": { "status": "queued" | "sent", ... } }
            #   { "message": "success", ... }
            top_status = str(data.get("status", "")).lower()
            top_message = str(data.get("message", "")).lower()
            nested = data.get("data") or {}
            nested_status = str(nested.get("status", "")).lower() if isinstance(nested, dict) else ""

            SUCCESS_VALUES = {"success", "queued", "sent", "ok", "200"}

            if (top_status in SUCCESS_VALUES
                    or top_message in SUCCESS_VALUES
                    or nested_status in SUCCESS_VALUES):
                logger.info(f"[SMS] Delivered to {normalized} ✓")
                _log_sms(phone, message, category, 'sent', recipient_name, recipient_role)
                return True
            else:
                err = f"Unexpected response: {data}"
                logger.warning(f"[SMS] {err}")
                _log_sms(phone, message, category, 'failed', recipient_name, recipient_role, str(err)[:200])
                return False

        else:
            # Try to extract a meaningful error message from the response body
            try:
                err_body = response.json()
                err_msg = (
                    err_body.get("message")
                    or err_body.get("error")
                    or err_body.get("detail")
                    or response.text[:200]
                )
            except Exception:
                err_msg = response.text[:200]
            err = f"HTTP {response.status_code}: {err_msg}"
            logger.error(f"[SMS] {err}")
            _log_sms(phone, message, category, 'failed', recipient_name, recipient_role, err)
            return False

    except Exception as e:
        err = f"{type(e).__name__}: {e}"
        logger.error(f"[SMS] EXCEPTION sending to {phone}: {err}")
        import traceback
        logger.error(traceback.format_exc())
        _log_sms(phone, message, category, 'failed', recipient_name, recipient_role, err)
        return False


# ─────────────────────────────────────────────
# SMS Templates
# ─────────────────────────────────────────────

def sms_appointment_created(patient_name: str, phone: str, appointment_date, doctor_name: str, appt_type: str):
    date_str = appointment_date.strftime("%A, %d %B %Y at %I:%M %p")
    message = (
        f"Dear {patient_name}, your {appt_type} appointment has been scheduled "
        f"for {date_str} with {doctor_name}. "
        f"Please arrive 10 minutes early. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_created", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_rescheduled(patient_name: str, phone: str, new_date, appt_type: str):
    date_str = new_date.strftime("%A, %d %B %Y at %I:%M %p")
    message = (
        f"Dear {patient_name}, your {appt_type} appointment has been rescheduled "
        f"to {date_str}. Please update your calendar. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_rescheduled", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_cancelled(patient_name: str, phone: str, appointment_date, appt_type: str):
    date_str = appointment_date.strftime("%A, %d %B %Y at %I:%M %p")
    message = (
        f"Dear {patient_name}, your {appt_type} appointment scheduled for "
        f"{date_str} has been cancelled. Please contact your doctor to reschedule. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_cancelled", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_reminder(patient_name: str, phone: str, appointment_date, doctor_name: str, appt_type: str):
    date_str = appointment_date.strftime("%A, %d %B %Y at %I:%M %p")
    message = (
        f"Reminder: Dear {patient_name}, you have a {appt_type} appointment "
        f"TOMORROW ({date_str}) with {doctor_name}. "
        f"Please do not miss it. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_reminder", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_missed(patient_name: str, phone: str, appointment_date, doctor_name: str):
    date_str = appointment_date.strftime("%d %B %Y")
    message = (
        f"Dear {patient_name}, you missed your appointment on {date_str} "
        f"with {doctor_name}. Please call us to reschedule as soon as possible. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_missed", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_missed_final(patient_name: str, phone: str, appointment_date, doctor_name: str, appt_type: str):
    """Final reminder — sent on day 1. Warns appointment will be cancelled."""
    date_str = appointment_date.strftime("%d %B %Y")
    message = (
        f"FINAL REMINDER: Dear {patient_name}, you missed your {appt_type} appointment "
        f"on {date_str} with {doctor_name}. "
        f"If you do not reschedule today, this appointment will be automatically cancelled. "
        f"Please contact us immediately. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_missed_final", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_auto_cancelled(patient_name: str, phone: str, appointment_date, doctor_name: str, appt_type: str):
    """Sent on day 2 when appointment is auto-cancelled after no reschedule."""
    date_str = appointment_date.strftime("%d %B %Y")
    message = (
        f"Dear {patient_name}, your {appt_type} appointment on {date_str} "
        f"with {doctor_name} has been automatically cancelled due to non-attendance. "
        f"Please contact DiabeCare to book a new appointment. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_auto_cancelled", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_completed(patient_name: str, phone: str, appointment_date, doctor_name: str, appt_type: str):
    date_str = appointment_date.strftime("%d %B %Y")
    message = (
        f"Dear {patient_name}, your {appt_type} appointment on {date_str} "
        f"with {doctor_name} has been marked as completed. "
        f"Thank you for attending. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_completed", recipient_name=patient_name, recipient_role="patient")


def sms_refill_reminder(patient_name: str, phone: str, medication_name: str, dosage: str, refill_date):
    date_str = refill_date.strftime("%A, %d %B %Y")
    message = (
        f"Dear {patient_name}, this is a reminder that your medication "
        f"{medication_name} {dosage} is due for a refill on {date_str}. "
        f"Please collect your refill to avoid missing doses. - DiabeCare"
    )
    send_sms(phone, message, category="refill_reminder", recipient_name=patient_name, recipient_role="patient")


def sms_appointment_requested_doctor(doctor_name: str, phone: str, patient_name: str,
                                      appointment_date, appt_type: str):
    date_str = appointment_date.strftime("%A, %d %B %Y at %I:%M %p")
    message = (
        f"Dear Dr. {doctor_name}, your patient {patient_name} has requested "
        f"a {appt_type} appointment on {date_str}. "
        f"Please log in to DiabeCare to confirm or reschedule. - DiabeCare"
    )
    send_sms(phone, message, category="appointment_request_doctor", recipient_name=doctor_name, recipient_role="doctor")


def sms_overdue_request_doctor(doctor_name: str, phone: str, patient_name: str,
                                appointment_date, appt_type: str):
    date_str = appointment_date.strftime("%A, %d %B %Y at %I:%M %p")
    message = (
        f"Dear Dr. {doctor_name}, the appointment request from {patient_name} "
        f"({appt_type} on {date_str}) is now overdue and still unconfirmed. "
        f"Please action it on DiabeCare immediately. - DiabeCare"
    )
    send_sms(phone, message, category="overdue_request_doctor", recipient_name=doctor_name, recipient_role="doctor")


def sms_account_created(full_name: str, phone: str, username: str, password: str, role: str):
    role_label = role.capitalize()
    message = (
        f"Welcome to DiabeCare! Your {role_label} account has been created.\n"
        f"Username: {username}\n"
        f"Password: {password}\n"
        f"Login at: https://daibecare.netlify.app/\n"
        f"Please change your password after first login. - DiabeCare"
    )
    send_sms(phone, message)

def sms_patient_reassigned(patient_name: str, phone: str, new_doctor_name: str,
                            old_doctor_name: str):
    """Sent to patient when they are reassigned to a new doctor."""
    message = (
        f"Dear {patient_name}, your care has been transferred to Dr. {new_doctor_name}. "
        f"Dr. {new_doctor_name} is now your assigned doctor and will be responsible for your treatment. "
        f"For any queries, please contact DiabeCare. - DiabeCare"
    )
    send_sms(phone, message, category="patient_reassigned",
             recipient_name=patient_name, recipient_role="patient")


def sms_doctor_new_patient(doctor_name: str, phone: str, patient_name: str,
                            patient_age: int, diabetes_type: str, old_doctor_name: str):
    """Sent to doctor when a new patient is reassigned to them."""
    message = (
        f"Dear Dr. {doctor_name}, a new patient has been assigned to you. "
        f"Patient: {patient_name}, Age: {patient_age}, Condition: {diabetes_type}. "
        f"Previously under Dr. {old_doctor_name}. "
        f"Please log in to DiabeCare to review their profile. - DiabeCare"
    )
    send_sms(phone, message, category="doctor_new_patient",
             recipient_name=doctor_name, recipient_role="doctor")

def sms_medication_overdue_removed(patient_name: str, phone: str,
                                    medication_name: str, dosage: str,
                                    days_overdue: int,
                                    reason: str = ''):
    """
    Sent to patient when an overdue medication is auto-removed.

    `reason` is an optional plain-English clause describing why it was removed.
    When omitted, the default refill-date wording is used.
    """
    if reason:
        detail = reason
    else:
        detail = (
            f"the refill date passed "
            f"{days_overdue} day{'s' if days_overdue != 1 else ''} ago "
            f"without a refill or completion"
        )
    message = (
        f"Dear {patient_name}, your medication {medication_name} {dosage} "
        f"has been removed from your active list because {detail}. "
        f"Please contact your doctor if you still need this medication. - DiabeCare"
    )
    send_sms(phone, message, category="medication_overdue_removed",
             recipient_name=patient_name, recipient_role="patient")