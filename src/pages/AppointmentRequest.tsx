import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { appointmentsApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  CalendarDays, Clock, Stethoscope, FileText, Send,
  Loader2, CheckCircle2, ChevronRight, Sparkles, ArrowLeft,
} from 'lucide-react';

const APPOINTMENT_TYPES = [
  { id: 'Follow-up',     icon: Stethoscope, desc: 'Regular check-in with your doctor' },
  { id: 'Consultation',  icon: FileText,    desc: 'Discuss symptoms or concerns' },
  { id: 'Blood Test',    icon: Clock,       desc: 'Lab work and blood glucose check' },
  { id: 'Review',        icon: CalendarDays, desc: 'Medication or treatment review' },
];

const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

// DatePicker popper styles
const DatePickerStyles = () => (
  <style>{`
    .req-picker .react-datepicker-popper { z-index: 9999 !important; }
    .req-picker .react-datepicker {
      font-family: inherit !important;
      border: 1px solid hsl(200,20%,88%) !important;
      border-radius: 14px !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.15) !important;
      overflow: hidden;
    }
    .req-picker .react-datepicker__header {
      background: linear-gradient(135deg, hsl(174,62%,38%), hsl(174,55%,30%)) !important;
      border-bottom: none !important; padding-top: 12px !important;
    }
    .req-picker .react-datepicker__current-month { font-size: 13px !important; font-weight: 700 !important; color: #fff !important; margin-bottom: 8px !important; }
    .req-picker .react-datepicker__day-name { font-size: 11px !important; color: rgba(255,255,255,0.7) !important; width: 2rem !important; line-height: 2rem !important; }
    .req-picker .react-datepicker__day { width: 2rem !important; line-height: 2rem !important; font-size: 12px !important; border-radius: 8px !important; }
    .req-picker .react-datepicker__day--selected { background: hsl(174,62%,38%) !important; color: #fff !important; }
    .req-picker .react-datepicker__day:hover { background: hsl(174,62%,90%) !important; }
    .req-picker .react-datepicker__day--disabled { color: hsl(210,12%,78%) !important; }
    .req-picker .react-datepicker__navigation-icon::before { border-color: rgba(255,255,255,0.8) !important; }
    .req-picker .react-datepicker__time-container { width: 90px !important; }
    .req-picker .react-datepicker__time-box { width: 90px !important; }
    .req-picker .react-datepicker__time-list-item { font-size: 12px !important; white-space: nowrap !important; }
    .req-picker .react-datepicker__time-list-item--selected { background: hsl(174,62%,38%) !important; }
    .req-picker .react-datepicker__input-container, .req-picker .react-datepicker__input-container input { width: 100% !important; }
  `}</style>
);

const AppointmentRequest = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType]           = useState('');
  const [requestedDate, setRequestedDate] = useState<Date | null>(null);
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canNext1 = !!type;
  const canNext2 = !!requestedDate;
  const canSubmit = canNext1 && canNext2;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await appointmentsApi.request({
        requested_date: requestedDate!.toISOString(),
        type,
        notes,
      });
      setSubmitted(true);
      toast.success('Appointment request submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout title="Request Appointment" subtitle="Schedule a visit with your doctor">
        <div className="max-w-md mx-auto flex flex-col items-center text-center py-16">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-2xl font-black text-foreground mb-2">Request Submitted!</h2>
            <p className="text-muted-foreground text-sm mb-2">
              Your appointment request for a <span className="font-bold text-foreground">{type}</span> has been sent to your doctor.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Preferred date: <span className="font-bold text-foreground">
                {requestedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </p>
            <div className="flex flex-col gap-3 w-full">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/appointments')}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/25">
                <CalendarDays className="h-4 w-4" />
                View My Appointments
              </motion.button>
              <button onClick={() => { setSubmitted(false); setStep(1); setType(''); setRequestedDate(null); setNotes(''); }}
                className="rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                Submit Another Request
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Request Appointment" subtitle="Schedule a visit with your doctor">
      <DatePickerStyles />
      <div className="max-w-lg mx-auto">

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-all flex-shrink-0 ${
                step > s ? 'bg-emerald-500 text-white' :
                step === s ? 'bg-primary text-white ring-4 ring-primary/20' :
                'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
              </div>
              <p className={`text-xs font-semibold hidden sm:block ${step >= s ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Type' : s === 2 ? 'Date & Time' : 'Notes'}
              </p>
              {s < 3 && <div className={`flex-1 h-0.5 rounded ${step > s ? 'bg-emerald-500' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Appointment type ── */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="mb-5">
                <h3 className="text-lg font-black text-foreground">What type of appointment?</h3>
                <p className="text-sm text-muted-foreground mt-1">Select the purpose of your visit</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {APPOINTMENT_TYPES.map(t => (
                  <motion.button key={t.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => setType(t.id)}
                    className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                      type === t.id
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                        : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'
                    }`}>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0 ${
                      type === t.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <t.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-foreground">{t.id}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    </div>
                    {type === t.id && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                disabled={!canNext1} onClick={() => setStep(2)}
                className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-primary/90">
                Continue <ChevronRight className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 2: Date & time ── */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="mb-5">
                <h3 className="text-lg font-black text-foreground">When would you like to visit?</h3>
                <p className="text-sm text-muted-foreground mt-1">Choose your preferred date and time</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-4 req-picker">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Preferred Date & Time</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 z-10" />
                    <DatePicker
                      selected={requestedDate}
                      onChange={(d: Date) => setRequestedDate(d)}
                      showTimeSelect
                      minDate={new Date(Date.now() + 86400000)} // tomorrow minimum
                      dateFormat="MMMM d, yyyy h:mm aa"
                      placeholderText="Select preferred date and time"
                      popperPlacement="bottom-start"
                      popperProps={{ strategy: 'fixed' }}
                      wrapperClassName="w-full"
                      timeIntervals={30}
                      className="w-full rounded-xl border border-input bg-background pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                </div>

                {requestedDate && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-xl bg-primary/6 border border-primary/15 px-4 py-3">
                    <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-primary">
                        {requestedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        at {requestedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {type}
                      </p>
                    </div>
                  </motion.div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  This is your preferred time. Your doctor will confirm the final appointment date.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  disabled={!canNext2} onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 disabled:opacity-40 transition-all hover:bg-primary/90">
                  Continue <ChevronRight className="h-4 w-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Notes & submit ── */}
          {step === 3 && (
            <motion.div key="step3"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="mb-5">
                <h3 className="text-lg font-black text-foreground">Any additional notes?</h3>
                <p className="text-sm text-muted-foreground mt-1">Help your doctor prepare for your visit</p>
              </div>

              {/* Summary card */}
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary/60 mb-3">Appointment Summary</p>
                <div className="flex items-center gap-2 text-sm">
                  <Stethoscope className="h-3.5 w-3.5 text-primary" />
                  <span className="font-bold text-foreground">{type}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground">
                    {requestedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    {' at '}
                    {requestedDate?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Notes <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Describe your symptoms or what you'd like to discuss…"
                  rows={4}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-none transition-all"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">{notes.length}/500 characters</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={handleSubmit} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-50 transition-all">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default AppointmentRequest;