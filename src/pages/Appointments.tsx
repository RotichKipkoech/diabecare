import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import { appointmentsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Clock, Stethoscope, CheckCircle2,
  Loader2, X, FileText, RefreshCcw, XCircle, Sparkles, Bell, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

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

// Parse a Kenya-time datetime string from the backend.
// Backend stores naive datetimes in EAT (UTC+3). We append +03:00 so JS
// knows the correct timezone — then display WITHOUT any timeZone conversion
// (the Date object already holds the correct wall-clock time).
function parseKenyaDate(dateString: string): Date {
  if (!dateString) return new Date();
  // Already has explicit timezone — use as-is
  if (dateString.includes('Z') || dateString.includes('+')) {
    return new Date(dateString);
  }
  // Naive string from backend → label it as EAT so no conversion occurs
  const d = new Date(dateString + '+03:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

// Format a Kenya date for display — no timeZone option needed because
// parseKenyaDate already encoded the correct offset into the Date object.
function formatKenyaDate(date: Date): string {
  return date.toLocaleString('en-US', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

// Time picker component
const TimePicker = ({ value, onChange, className }: { value: Date | null; onChange: (date: Date) => void; className?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const times = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 30) {
      const hour = i.toString().padStart(2, '0');
      const minute = j.toString().padStart(2, '0');
      times.push(`${hour}:${minute}`);
    }
  }

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm aa');
  };

  const selectedTime = value ? format(value, 'h:mm aa') : '';

  const handleTimeSelect = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const newDate = value || new Date();
    newDate.setHours(parseInt(hours), parseInt(minutes));
    onChange(newDate);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-left text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all flex items-center justify-between"
      >
        <span className={selectedTime ? 'text-gray-800' : 'text-gray-400'}>
          {selectedTime || 'Select time'}
        </span>
        <Clock className="h-4 w-4 text-gray-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
          >
            <div className="p-2 space-y-1">
              {times.map((time) => (
                <button
                  key={time}
                  onClick={() => handleTimeSelect(time)}
                  className={`w-full px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                    selectedTime === formatTime(time)
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {formatTime(time)}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// DateTime Picker Modal for appointments
const DateTimePickerModal = ({ 
  selected, 
  onChange, 
  onClose, 
  title = "Select Date & Time"
}: { 
  selected: Date | null; 
  onChange: (date: Date) => void; 
  onClose: () => void;
  title?: string;
}) => {
  const [tempDate, setTempDate] = useState<Date | null>(selected);
  const [step, setStep] = useState<'date' | 'time'>('date');

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const newDate = new Date(date);
      if (tempDate) {
        newDate.setHours(tempDate.getHours(), tempDate.getMinutes());
      }
      setTempDate(newDate);
      setStep('time');
    }
  };

  const handleTimeSelect = (timeDate: Date) => {
    if (tempDate) {
      const combined = new Date(tempDate);
      combined.setHours(timeDate.getHours(), timeDate.getMinutes());
      setTempDate(combined);
      onChange(combined);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-primary to-primary/80 px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
          <button
            onClick={onClose}
            className="absolute right-3 sm:right-4 top-3 sm:top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white/70 hover:text-white hover:bg-white/30 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <p className="text-white/70 text-sm mt-1">
            {step === 'date' ? 'Choose a date' : 'Choose a time'}
          </p>
        </div>

        <div className="p-4 sm:p-6">
          {step === 'date' && (
            <>
              <Calendar
                mode="single"
                selected={tempDate || undefined}
                onSelect={handleDateSelect}
                disabled={{ before: new Date() }}
                className="rounded-xl border"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {step === 'time' && (
            <>
              <div className="space-y-3">
                {tempDate && (
                  <div className="rounded-xl bg-primary/5 p-3 border border-primary/10 mb-4">
                    <p className="text-sm text-primary font-medium">
                      Selected date: {format(tempDate, 'EEEE, MMMM d, yyyy')}
                    </p>
                  </div>
                )}
                <label className="text-sm font-semibold text-gray-700">
                  Select Time
                </label>
                <TimePicker value={tempDate} onChange={handleTimeSelect} />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep('date')}
                  className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// Helper to get Kenya time for comparison
function getKenyaNow(): Date {
  // Create a date in Kenya timezone
  const now = new Date();
  const kenyaOffset = 3 * 60 * 60 * 1000; // UTC+3 in milliseconds
  return new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + kenyaOffset);
}

// An appointment is overdue if it's still 'requested' and the date has passed
const isOverdue = (appt: AppointmentData): boolean => {
  const apptDate = parseKenyaDate(appt.appointment_date);
  const now = getKenyaNow();
  return (
    (appt.status === 'requested' || appt.status === 'scheduled') &&
    apptDate < now
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
  const d = parseKenyaDate(appt.appointment_date);
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                {d.toLocaleDateString('en-US', { month: 'short' })}
              </span>
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
              <p className="text-sm font-bold text-gray-800">
                {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
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
    return parseKenyaDate(appt.appointment_date);
  });
  const [notes, setNotes] = useState(appt.notes || '');
  const [updating, setUpdating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isRequested = appt.status === 'requested';

  const doUpdate = async (payload: any) => {
    setUpdating(true);
    try {
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

  const d = parseKenyaDate(appt.appointment_date);

  return (
    <>
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
              <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />
                {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />
                {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              <StatusBadge status={appt.status} />
            </div>
          </div>

          {/* Scrollable body */}
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* ... rest of the modal content remains the same ... */}
            {isRequested && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                <Bell className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  <span className="font-bold">{appt.patient_name}</span> has requested this {appt.type} appointment. Accept to confirm or decline to cancel.
                </p>
              </div>
            )}

            {/* Notes field */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                <FileText className="h-3.5 w-3.5" />
                Clinical Notes
              </label>
              {appt.notes && appt.notes !== notes && (
                <div className="mb-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">Previously Saved</p>
                  <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">{appt.notes}</p>
                  <button onClick={() => setNotes(appt.notes)} className="mt-1.5 text-[11px] text-amber-600 hover:text-amber-800 font-semibold underline underline-offset-2">
                    Restore original
                  </button>
                </div>
              )}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Add clinical notes, preparation instructions, or follow-up details…"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white transition-all resize-none"
              />
              <p className="text-[11px] text-gray-300 text-right mt-1">{notes.length}/1000</p>
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
              <button
                type="button"
                onClick={() => setShowDatePicker(true)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-left text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all flex items-center justify-between"
              >
                <span className={newDate ? 'text-gray-800' : 'text-gray-400'}>
                  {newDate ? format(newDate, 'MMM d, yyyy h:mm aa') : 'Select date & time'}
                </span>
                <CalendarDays className="h-4 w-4 text-gray-400" />
              </button>
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

      {/* DateTime Picker Modal */}
      <AnimatePresence>
        {showDatePicker && (
          <DateTimePickerModal
            selected={newDate}
            onChange={setNewDate}
            onClose={() => setShowDatePicker(false)}
            title={isRequested ? "Select New Date & Time" : "Reschedule Appointment"}
          />
        )}
      </AnimatePresence>
    </>
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
      .then(data => {
        // Parse dates to ensure they're correct
        const parsedData = data.map((appt: any) => ({
          ...appt,
          // Keep the original date string as is - we'll parse it when displaying
        }));
        setAppointments(parsedData);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = appointments.filter(a =>
    filter === 'all' ? true :
    filter === 'overdue' ? isOverdue(a) :
    filter === 'scheduled' ? (a.status === 'scheduled' && !isOverdue(a)) :
    filter === 'requested' ? (a.status === 'requested' && !isOverdue(a)) :
    a.status === filter
  );
  const scheduled = appointments.filter(a => a.status === 'scheduled' && !isOverdue(a)).length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  const requested = appointments.filter(a => a.status === 'requested' && !isOverdue(a)).length;
  const overdue = appointments.filter(a => isOverdue(a)).length;

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
            { label: 'Overdue', value: overdue, cfg: STATUS_CONFIG.overdue },
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
            const d = parseKenyaDate(appt.appointment_date);
            const effStatus = effectiveStatus(appt);
            const cfg = STATUS_CONFIG[effStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
            return (
              <motion.div key={appt.id} onClick={() => setSelected(appt)}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`group cursor-pointer flex items-center gap-3 sm:gap-4 rounded-xl border bg-card p-3 sm:p-4 shadow-card hover:border-primary/30 hover:shadow-md transition-all ${
                  effStatus === 'overdue' ? 'border-orange-200 bg-orange-50/30' :
                  appt.status === 'requested' ? 'border-amber-200 bg-amber-50/30' : 'border-border'
                }`}>
                <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl ${cfg.bg} border ${cfg.border}`}>
                  <span className={`text-base font-black leading-none ${cfg.text}`}>{d.getDate()}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.text} opacity-70`}>
                    {d.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
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
                    <span className="truncate">
                      {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
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