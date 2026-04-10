import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { appointmentsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Clock, Stethoscope, CheckCircle2,
  Loader2, X, FileText, RefreshCcw, XCircle, Sparkles, Bell, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface AppointmentData {
  id: number;
  patient_name: string;
  patient_id: number;
  doctor_name: string;
  appointment_date: string;
  type: string;
  status: string;
  notes: string;
}

const STATUS_CONFIG = {
  scheduled: {
    bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20',
    dot: 'bg-primary', label: 'Scheduled', icon: CalendarDays,
  },
  completed: {
    bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200',
    dot: 'bg-emerald-500', label: 'Completed', icon: CheckCircle2,
  },
  cancelled: {
    bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-200',
    dot: 'bg-red-400', label: 'Cancelled', icon: XCircle,
  },
  requested: {
    bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200',
    dot: 'bg-amber-400', label: 'Requested', icon: Bell,
  },
  missed: {
    bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200',
    dot: 'bg-gray-400', label: 'Missed', icon: XCircle,
  },
  overdue: {
    bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200',
    dot: 'bg-orange-500', label: 'Overdue', icon: AlertTriangle,
  },
} as const;

// An appointment is overdue if it's still 'requested' and the date has passed
const isOverdue = (appt: AppointmentData): boolean => {
  return (
    (appt.status === 'requested' || appt.status === 'scheduled') &&
    new Date(appt.appointment_date) < new Date()
  );
};

// Returns effective display status — overdue requested appts show as 'overdue'
const effectiveStatus = (appt: AppointmentData): string =>
  isOverdue(appt) ? 'overdue' : appt.status;

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const AppointmentDetailModal = ({ appt, onClose }: { appt: AppointmentData; onClose: () => void }) => {
  const utcStr = appt.appointment_date.endsWith('Z') ? appt.appointment_date : appt.appointment_date + 'Z';
  const d = new Date(utcStr);
  const cfg = STATUS_CONFIG[appt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className={`relative px-6 pt-8 pb-6 ${cfg.bg}`}>
          <button onClick={onClose} className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md">
              <span className={`text-2xl font-black leading-none ${cfg.text}`}>{d.getDate()}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
              <span className="text-[9px] text-gray-300">{d.getFullYear()}</span>
            </div>
            <div className="flex-1 pt-1">
              <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${cfg.text}`}>{appt.type}</p>
              <h2 className="text-lg font-black text-gray-800 leading-tight">{appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'Your Doctor'}</h2>
              <div className="mt-2"><StatusBadge status={appt.status} /></div>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10"><Clock className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Time</p>
              <p className="text-sm font-bold text-gray-800">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
            </div>
          </div>
          {appt.doctor_name && (
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50"><Stethoscope className="h-4 w-4 text-indigo-500" /></div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Doctor</p>
                <p className="text-sm font-bold text-gray-800">{appt.doctor_name}</p>
              </div>
            </div>
          )}
          {appt.notes && (
            <div className="flex items-start gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 mt-0.5"><FileText className="h-4 w-4 text-amber-500" /></div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Notes</p>
                <p className="text-sm text-gray-700 leading-relaxed">{appt.notes}</p>
              </div>
            </div>
          )}
          {appt.status === 'requested' && (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <Bell className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">This appointment is pending confirmation from your doctor.</p>
            </div>
          )}
          {appt.status === 'scheduled' && (
            <div className="flex items-center gap-2 rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-primary font-medium">You'll receive an SMS reminder 48 hours before this appointment.</p>
            </div>
          )}
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full rounded-2xl bg-gray-100 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors">Close</button>
        </div>
      </motion.div>
    </div>
  );
};

const ManageModal = ({ appt, onClose, onUpdated }: { appt: AppointmentData; onClose: () => void; onUpdated: (updated: AppointmentData) => void }) => {
  const [newDate, setNewDate] = useState<Date>(() => {
    const utcStr = appt.appointment_date.endsWith('Z') ? appt.appointment_date : appt.appointment_date + 'Z';
    return new Date(utcStr);
  });
  const [notes, setNotes]     = useState(appt.notes || '');
  const [updating, setUpdating] = useState(false);
  const isRequested = appt.status === 'requested';

  const doUpdate = async (payload: any) => {
    setUpdating(true);
    try {
      // Always include the current notes value so the doctor's input is saved
      const finalPayload = { ...payload, notes };
      await appointmentsApi.update(appt.id, finalPayload);
      onUpdated({ ...appt, ...finalPayload });
      toast.success('Appointment updated');
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const d = new Date(appt.appointment_date.endsWith('Z') ? appt.appointment_date : appt.appointment_date + 'Z');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className={`relative px-6 pt-7 pb-5 flex-shrink-0 ${isRequested ? 'bg-gradient-to-br from-amber-600 to-amber-500' : 'bg-gradient-to-br from-slate-800 to-slate-700'}`}>
          <button onClick={onClose} className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">{isRequested ? '⏳ Pending Request' : 'Manage Appointment'}</p>
          <h2 className="text-xl font-black text-white">{appt.patient_name}</h2>
          <div className="flex items-center gap-3 mt-2 text-white/70 text-xs flex-wrap">
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            <StatusBadge status={appt.status} />
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {isRequested && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <Bell className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                <span className="font-bold">{appt.patient_name}</span> has requested this {appt.type} appointment. Accept to confirm or decline to cancel.
              </p>
            </div>
          )}

          {/* ── Notes field — always visible ───────────────────────────── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              <FileText className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add clinical notes, instructions, or follow-up details…"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white transition-all resize-none"
            />
            {appt.notes && appt.notes !== notes && (
              <button onClick={() => setNotes(appt.notes)} className="mt-1 text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2">
                Reset to original
              </button>
            )}
          </div>

          {isRequested && (
            <button onClick={() => doUpdate({ status: 'scheduled' })} disabled={updating}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-400 transition disabled:opacity-50">
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Accept & Confirm Appointment
            </button>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{isRequested ? 'Accept with Different Date' : 'Reschedule'}</p>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <DatePicker selected={newDate} onChange={(d: Date) => setNewDate(d)} showTimeSelect minDate={new Date()}
                dateFormat="MMM d, yyyy h:mm aa"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <button onClick={() => doUpdate({ appointment_date: newDate.toISOString(), ...(isRequested ? { status: 'scheduled' } : {}) })}
              disabled={updating}
              className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition disabled:opacity-50">
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {isRequested ? 'Accept with New Date' : 'Confirm Reschedule'}
            </button>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">or</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          <div className={`grid gap-3 ${isRequested ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {!isRequested && (
              <button onClick={() => doUpdate({ status: 'completed' })} disabled={updating || appt.status === 'completed'}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 transition disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" /> Complete
              </button>
            )}
            <button onClick={() => doUpdate({ status: 'cancelled' })} disabled={updating || appt.status === 'cancelled'}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400 transition disabled:opacity-40">
              <XCircle className="h-4 w-4" /> {isRequested ? 'Decline Request' : 'Cancel'}
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="w-full rounded-2xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 transition">Dismiss</button>
        </div>
      </motion.div>
    </div>
  );
};

const Appointments = () => {
  const { user } = useAuth();
  const storedUser = localStorage.getItem('diabecare_user');
  const role = user?.role ?? (storedUser ? JSON.parse(storedUser).role : 'admin');
  const isPatient = role === 'patient';
  const isDoctor = role === 'doctor';

  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled' | 'requested' | 'overdue' | 'missed'>('all');
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AppointmentData | null>(null);

  useEffect(() => {
    appointmentsApi.list()
      .then(setAppointments)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered  = appointments.filter(a =>
    filter === 'all'     ? true :
    filter === 'overdue' ? isOverdue(a) :
    filter === 'scheduled' ? (a.status === 'scheduled' && !isOverdue(a)) :
    filter === 'requested' ? (a.status === 'requested' && !isOverdue(a)) :
    a.status === filter
  );
  const scheduled = appointments.filter(a => a.status === 'scheduled' && !isOverdue(a)).length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  const requested = appointments.filter(a => a.status === 'requested' && !isOverdue(a)).length;
  const overdue   = appointments.filter(a => isOverdue(a)).length;

  const handleUpdated = (updated: AppointmentData) => {
    setAppointments(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    setSelected(null);
  };

  const filterTabs = isPatient
    ? (['all', 'scheduled', 'completed', 'cancelled'] as const)
    : (['all', 'overdue', 'requested', 'scheduled', 'completed', 'cancelled'] as const);

  return (
    <Layout title="Appointments" subtitle={isPatient ? 'Your upcoming visits' : `${appointments.length} total appointments`}>

      {!isPatient && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Requested', value: requested, cfg: STATUS_CONFIG.requested },
            { label: 'Overdue',   value: overdue,   cfg: STATUS_CONFIG.overdue },
            { label: 'Scheduled', value: scheduled, cfg: STATUS_CONFIG.scheduled },
            { label: 'Completed', value: completed, cfg: STATUS_CONFIG.completed },
            { label: 'Cancelled', value: cancelled, cfg: STATUS_CONFIG.cancelled },
          ].map((s) => {
            const Icon = s.cfg.icon;
            return (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => setFilter(s.label.toLowerCase() as any)}
                className={`flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card cursor-pointer hover:border-primary/30 transition-all ${
                  s.label === 'Requested' && requested > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-border'
                }`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.cfg.bg}`}>
                  <Icon className={`h-5 w-5 ${s.cfg.text}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold font-display text-foreground">{s.value}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {isDoctor && requested > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <Bell className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 font-medium flex-1">
            You have <span className="font-bold">{requested}</span> pending appointment {requested === 1 ? 'request' : 'requests'} awaiting confirmation.
          </p>
          <button onClick={() => setFilter('requested')} className="text-xs font-bold text-amber-600 hover:text-amber-800 underline underline-offset-2">View all</button>
        </motion.div>
      )}

      {!isPatient && overdue > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-3 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <p className="text-sm text-orange-700 font-medium flex-1">
            <span className="font-bold">{overdue}</span> appointment{overdue === 1 ? '' : 's'} {overdue === 1 ? 'has' : 'have'} passed their scheduled date without being completed, cancelled, or rescheduled.
          </p>
          <button onClick={() => setFilter('overdue')} className="text-xs font-bold text-orange-600 hover:text-orange-800 underline underline-offset-2">View all</button>
        </motion.div>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {filterTabs.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}>
            {f}
            {f === 'requested' && requested > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">{requested}</span>
            )}
            {f === 'overdue' && overdue > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-orange-500 text-white text-[9px] font-bold">{overdue}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <div className="py-16 text-center text-muted-foreground text-sm">No appointments found.</div>}
          {filtered.map((appt, i) => {
            const d = new Date(appt.appointment_date.endsWith('Z') ? appt.appointment_date : appt.appointment_date + 'Z');
            const effStatus = effectiveStatus(appt);
            const cfg = STATUS_CONFIG[effStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
            return (
              <motion.div key={appt.id} onClick={() => setSelected(appt)}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`group cursor-pointer flex items-center gap-3 sm:gap-4 rounded-xl border bg-card p-3 sm:p-4 shadow-card hover:border-primary/30 hover:shadow-md transition-all ${
                  effStatus === 'overdue'    ? 'border-orange-200 bg-orange-50/30' :
                  appt.status === 'requested' ? 'border-amber-200 bg-amber-50/30' : 'border-border'
                }`}>
                <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl ${cfg.bg} border ${cfg.border}`}>
                  <span className={`text-base font-black leading-none ${cfg.text}`}>{d.getDate()}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.text} opacity-70`}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{appt.patient_name}</p>
                    <StatusBadge status={effStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{appt.type}</p>
                </div>
                <div className="text-right shrink-0 max-w-[90px] sm:max-w-none">
                  <div className="flex items-center gap-1 text-xs font-medium text-foreground justify-end">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  {!isPatient && appt.doctor_name && (
                    <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 justify-end">
                      <Stethoscope className="h-3 w-3" />{appt.doctor_name}
                    </div>
                  )}
                  {appt.status === 'requested' && !isPatient && (
                    <span className={`text-[10px] font-bold mt-0.5 block ${effStatus === 'overdue' ? 'text-orange-500' : 'text-amber-500'}`}>
                      {effStatus === 'overdue' ? '⚠ Overdue' : 'Tap to review'}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && isPatient && <AppointmentDetailModal appt={selected} onClose={() => setSelected(null)} />}
        {selected && !isPatient && <ManageModal appt={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
      </AnimatePresence>
    </Layout>
  );
};

export default Appointments;