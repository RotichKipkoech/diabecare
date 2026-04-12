import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { appointmentsApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import {
  CalendarDays, Clock, Stethoscope, FileText, Send,
  Loader2, CheckCircle2, ChevronRight, Sparkles, ArrowLeft, X,
} from 'lucide-react';

const APPOINTMENT_TYPES = [
  { id: 'Follow-up', icon: Stethoscope, desc: 'Regular check-in with your doctor' },
  { id: 'Consultation', icon: FileText, desc: 'Discuss symptoms or concerns' },
  { id: 'Blood Test', icon: Clock, desc: 'Lab work and blood glucose check' },
  { id: 'Review', icon: CalendarDays, desc: 'Medication or treatment review' },
];

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

// DateTime Picker Modal
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

const AppointmentRequest = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState('');
  const [requestedDate, setRequestedDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

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

          {/* Step 1: Appointment type */}
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

          {/* Step 2: Date & time with improved picker */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="mb-5">
                <h3 className="text-lg font-black text-foreground">When would you like to visit?</h3>
                <p className="text-sm text-muted-foreground mt-1">Choose your preferred date and time</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Preferred Date & Time
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(true)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-left text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all flex items-center justify-between"
                  >
                    <span className={requestedDate ? 'text-gray-800' : 'text-gray-400'}>
                      {requestedDate ? format(requestedDate, 'MMM d, yyyy h:mm aa') : 'Select date & time'}
                    </span>
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {requestedDate && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-xl bg-primary/6 border border-primary/15 px-4 py-3">
                    <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-primary">
                        {format(requestedDate, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        at {format(requestedDate, 'h:mm aa')} · {type}
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

          {/* Step 3: Notes & submit */}
          {step === 3 && (
            <motion.div key="step3"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="mb-5">
                <h3 className="text-lg font-black text-foreground">Any additional notes?</h3>
                <p className="text-sm text-muted-foreground mt-1">Help your doctor prepare for your visit</p>
              </div>

              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary/60 mb-3">Appointment Summary</p>
                <div className="flex items-center gap-2 text-sm">
                  <Stethoscope className="h-3.5 w-3.5 text-primary" />
                  <span className="font-bold text-foreground">{type}</span>
                </div>
                {requestedDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground">
                      {format(requestedDate, 'EEEE, MMMM d, yyyy')} at {format(requestedDate, 'h:mm aa')}
                    </span>
                  </div>
                )}
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
                  maxLength={500}
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

      {/* DateTime Picker Modal */}
      <AnimatePresence>
        {showDatePicker && (
          <DateTimePickerModal
            selected={requestedDate}
            onChange={setRequestedDate}
            onClose={() => setShowDatePicker(false)}
            title="Select Preferred Date & Time"
          />
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default AppointmentRequest;