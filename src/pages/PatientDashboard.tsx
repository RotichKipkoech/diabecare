import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import MedicationList from '@/components/MedicationList';
import { patientsApi, medicationsApi, appointmentsApi, statsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import {
  Activity, Pill, CalendarDays, Droplets, Heart, Clock,
  Loader2, X, Stethoscope, FileText, Sparkles, XCircle, CheckCircle2,
  RefreshCcw, Wifi, WifiOff, AlertTriangle, AlertCircle, History,
  ChevronRight, Calendar, User, Phone, Mail, MapPin,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Medication } from '@/types/patient';
import { toast } from 'sonner';

const POLL_INTERVAL = 30_000;

// Status config
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
  missed: {
    bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200',
    dot: 'bg-orange-500', label: 'Missed', icon: AlertTriangle,
  },
  requested: {
    bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200',
    dot: 'bg-amber-400', label: 'Requested', icon: AlertCircle,
  },
} as const;

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// Helper function to parse Kenya date
const parseKenyaDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  if (dateString.includes('Z') || dateString.includes('+')) {
    return new Date(dateString);
  }
  return new Date(dateString + '+03:00');
};

// Read-only appointment detail modal
const AppointmentDetailModal = ({ appt, onClose }: { appt: any; onClose: () => void }) => {
  const d = parseKenyaDate(appt.appointment_date);
  const cfg = STATUS_CONFIG[appt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className={`relative px-6 pt-8 pb-6 ${cfg.bg}`}>
          <button onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-gray-400 hover:text-gray-700 transition-colors">
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
              <h2 className="text-lg font-black text-gray-800 leading-tight">
                {appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'Your Doctor'}
              </h2>
              <div className="mt-2"><StatusBadge status={appt.status} /></div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Time</p>
              <p className="text-sm font-bold text-gray-800">
                {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {appt.doctor_name && (
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50">
                <Stethoscope className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Doctor</p>
                <p className="text-sm font-bold text-gray-800">{appt.doctor_name}</p>
              </div>
            </div>
          )}

          {appt.notes && (
            <div className="flex items-start gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 mt-0.5">
                <FileText className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Notes</p>
                <p className="text-sm text-gray-700 leading-relaxed">{appt.notes}</p>
              </div>
            </div>
          )}

          {appt.status === 'scheduled' && (
            <div className="flex items-center gap-2 rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-primary font-medium">
                You'll receive an SMS reminder 48 hours before this appointment.
              </p>
            </div>
          )}
          {(appt.status === 'missed' || appt.is_overdue) && (
            <div className="flex items-center gap-2 rounded-2xl bg-orange-50 border border-orange-200 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <p className="text-xs text-orange-700 font-medium">
                This appointment was missed. Please contact your doctor to reschedule as soon as possible.
              </p>
            </div>
          )}
          {appt.status === 'requested' && !appt.is_overdue && (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                Your appointment request is pending confirmation from your doctor.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full rounded-2xl bg-gray-100 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Live badge
const LiveBadge = ({ lastUpdated, isLive }: { lastUpdated: Date | null; isLive: boolean }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
    {isLive ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-destructive" />}
    {lastUpdated
      ? <>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
      : 'Waiting...'}
    {isLive && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
  </div>
);

// Main dashboard
const PatientDashboard = () => {
  const { user } = useAuth();
  const { isEnabled } = useFeatures();

  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<any>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [togglingMeds, setTogglingMeds] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // History slide-over state
  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'appointments' | 'medications'>('appointments');

  const refreshStats = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const sData = await statsApi.dashboard();
      setStats(sData);
      setLastUpdated(new Date());
      setIsLive(true);
    } catch {
      setIsLive(false);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [pList, appts] = await Promise.all([patientsApi.list(), appointmentsApi.list()]);
      const myPatient = pList[0];
      setPatientData(myPatient);
      setAppointments(appts);

      if (myPatient) {
        const meds = await medicationsApi.listByPatient(Number(myPatient.id));
        setMedications(meds
          .filter((m: any) => !m.completed)
          .map((m: any) => ({
            id: String(m.id),
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            time: m.time,
            taken_today: Boolean(m.taken_today),
            refill_date: m.refill_date,
          })));
      }

      await refreshStats(true);
    } catch (e: any) {
      toast.error(e.message);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [refreshStats]);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(() => refreshStats(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll, refreshStats]);

  // Optimistic toggle — updates UI instantly, rolls back on error
  const handleToggleMed = async (medId: string, taken: boolean) => {
    setMedications(prev => prev.map(m => m.id === medId ? { ...m, taken_today: taken } : m));
    setTogglingMeds(prev => ({ ...prev, [medId]: true }));

    try {
      await medicationsApi.markTaken(Number(medId), taken);
    } catch (e: any) {
      setMedications(prev => prev.map(m => m.id === medId ? { ...m, taken_today: !taken } : m));
      toast.error(e.message);
    } finally {
      setTogglingMeds(prev => ({ ...prev, [medId]: false }));
    }
  };

  if (loading) return (
    <Layout title="My Dashboard">
      <div className="py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </Layout>
  );

  const p = patientData;
  const bs = p?.blood_sugar ?? 0;
  const hba1c = p?.hba1c ?? 0;
  const adh = p?.adherence_rate ?? 0;
  const takenMeds = medications.filter(m => m.taken_today).length;
  const totalMeds = medications.length;
  const upcomingAppts = appointments.filter(a => a.status === 'scheduled' && !a.is_overdue);
  const missedOverdueAppts = appointments.filter(a =>
    a.status === 'missed' ||
    (a.status === 'requested' && a.is_overdue) ||
    (a.status === 'scheduled' && a.is_overdue)
  ).sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());

  return (
    <Layout title="My Dashboard" subtitle="Your health overview and medication schedule">
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isEnabled('Blood Sugar Level') && (
          <StatCard title="Blood Sugar" value={`${bs} mg/dL`} icon={Droplets}
            trend={bs > 140 ? 'Above target' : 'In range'} trendUp={bs <= 140}
            variant={bs > 180 ? 'danger' : bs > 140 ? 'warning' : 'success'} delay={0} />
        )}
        {isEnabled('HbA1c Reading') && (
          <StatCard title="HbA1c" value={`${hba1c}%`} icon={Activity}
            trend={hba1c < 7 ? 'Good control' : 'Needs improvement'} trendUp={hba1c < 7}
            variant={hba1c > 8 ? 'danger' : 'success'} delay={0.05} />
        )}
        <StatCard title="Adherence" value={`${adh}%`} icon={Heart}
          trend="This month" trendUp={adh >= 80} variant="primary" delay={0.1} />
        {isEnabled('Medication Schedule') && (
          <StatCard
            title="Meds Today"
            value={`${takenMeds}/${totalMeds}`}
            icon={Pill}
            trend={takenMeds === totalMeds && totalMeds > 0 ? 'All taken! 🎉' : `${totalMeds - takenMeds} remaining`}
            trendUp={takenMeds === totalMeds && totalMeds > 0}
            delay={0.15}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Blood Sugar Chart */}
        {isEnabled('Blood Sugar Trend Chart') && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold font-display text-foreground">My Blood Sugar This Week</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Last 7 days · mg/dL</p>
              </div>
              <div className="flex items-center gap-2">
                <LiveBadge lastUpdated={lastUpdated} isLive={isLive} />
                <button onClick={() => refreshStats(false)} disabled={refreshing}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.bloodSugarTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 20%, 90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(210, 12%, 50%)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[80, 200]} tick={{ fontSize: 12, fill: 'hsl(210, 12%, 50%)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(200, 20%, 90%)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: any) => [`${v} mg/dL`, 'Blood Sugar']}
                />
                <Bar dataKey="avg" fill="hsl(174, 62%, 38%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Appointments — Upcoming + Missed/Overdue */}
        {isEnabled('Upcoming Appointments') && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card">

            {/* Upcoming */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold font-display text-foreground">Upcoming Appointments</h3>
              {upcomingAppts.length > 0 && (
                <span className="rounded-full bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5">
                  {upcomingAppts.length}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {upcomingAppts.slice(0, 3).map((appt) => {
                const d = parseKenyaDate(appt.appointment_date);
                return (
                  <button key={appt.id} onClick={() => setSelectedAppt(appt)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 p-3 transition-all text-left">
                    <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-white shadow-sm border border-primary/10">
                      <span className="text-sm font-black leading-none text-primary">{d.getDate()}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-primary/60">
                        {d.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'Doctor'}
                      </p>
                      <p className="text-xs text-muted-foreground">{appt.type}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary font-semibold flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </button>
                );
              })}
              {upcomingAppts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CalendarDays className="h-7 w-7 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Your doctor will schedule one for you.</p>
                </div>
              )}
            </div>

            {/* Missed / Overdue */}
            {missedOverdueAppts.length > 0 && (
              <div className="mt-5 pt-4 border-t border-orange-100">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-orange-600">
                    Missed / Overdue
                  </h4>
                  <span className="ml-auto rounded-full bg-orange-100 text-orange-600 text-[11px] font-bold px-2 py-0.5">
                    {missedOverdueAppts.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {missedOverdueAppts.slice(0, 3).map((appt) => {
                    const d = parseKenyaDate(appt.appointment_date);
                    const isMissed = appt.status === 'missed';
                    return (
                      <button key={appt.id} onClick={() => setSelectedAppt(appt)}
                        className="w-full flex items-center gap-3 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 p-3 transition-all text-left">
                        <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-white shadow-sm border border-orange-200">
                          <span className="text-sm font-black leading-none text-orange-500">{d.getDate()}</span>
                          <span className="text-[8px] font-bold uppercase tracking-wider text-orange-400">
                            {d.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'Doctor'}
                          </p>
                          <p className="text-xs text-muted-foreground">{appt.type}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            isMissed
                              ? 'bg-orange-50 text-orange-600 border-orange-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>
                            {isMissed ? <AlertTriangle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                            {isMissed ? 'Missed' : 'Overdue'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {missedOverdueAppts.length > 3 && (
                    <p className="text-center text-[11px] text-orange-500 font-medium pt-1">
                      +{missedOverdueAppts.length - 3} more — contact your doctor
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Medication List with History Button */}
      {isEnabled('Medication Schedule') && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold font-display text-foreground">My Medications</h3>
              {totalMeds > 0 && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  takenMeds === totalMeds
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/10 text-warning'
                }`}>
                  {takenMeds}/{totalMeds} taken today
                </span>
              )}
            </div>
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:from-primary/20 hover:to-primary/10 transition-all"
            >
              <History className="h-3.5 w-3.5" />
              View Full History
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <MedicationList
            medications={medications}
            onToggle={handleToggleMed}
            role="patient"
            togglingIds={togglingMeds}
          />
        </motion.div>
      )}

      {/* Appointment detail modal */}
      <AnimatePresence>
        {selectedAppt && (
          <AppointmentDetailModal appt={selectedAppt} onClose={() => setSelectedAppt(null)} />
        )}
      </AnimatePresence>

      {/* Health History Slide-over Panel */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-gradient-to-b from-white to-gray-50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-primary to-primary/80 px-6 py-5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                      <History className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/80">My Health Journey</p>
                      <p className="text-lg font-black text-white">Complete History</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white/70 hover:bg-white/30 hover:text-white transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-white/70 mt-3 ml-13">
                  Your complete medical record at a glance
                </p>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50/50 border-b border-gray-100 flex-shrink-0">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Appointments</p>
                  <p className="text-2xl font-bold text-primary">{appointments.length}</p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Medications</p>
                  <p className="text-2xl font-bold text-primary">{medications.length}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
                {(['appointments', 'medications'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setHistoryTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-all ${
                      historyTab === tab
                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                        : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'appointments' ? <CalendarDays className="h-4 w-4" /> : <Pill className="h-4 w-4" />}
                    {tab}
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      historyTab === tab ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab === 'appointments' ? appointments.length : medications.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {historyTab === 'appointments' && (
                  appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No appointments yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Your appointment history will appear here</p>
                    </div>
                  ) : (
                    appointments.map((appt: any) => {
                      const d = parseKenyaDate(appt.appointment_date);
                      const cfg = STATUS_CONFIG[appt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.scheduled;
                      return (
                        <motion.button
                          key={appt.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => { setShowHistory(false); setSelectedAppt(appt); }}
                          className={`w-full flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                            appt.status === 'completed' ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50' :
                            appt.status === 'cancelled' ? 'border-red-200 bg-red-50/30 hover:bg-red-50' :
                            appt.status === 'missed' ? 'border-orange-200 bg-orange-50/30 hover:bg-orange-50' :
                            'border-primary/20 bg-primary/5 hover:bg-primary/10'
                          }`}
                        >
                          <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm border-2 ${
                            appt.status === 'completed' ? 'border-emerald-200' :
                            appt.status === 'cancelled' ? 'border-red-200' :
                            appt.status === 'missed' ? 'border-orange-200' :
                            'border-primary/20'
                          }`}>
                            <span className={`text-base font-black leading-none ${
                              appt.status === 'completed' ? 'text-emerald-600' :
                              appt.status === 'cancelled' ? 'text-red-500' :
                              appt.status === 'missed' ? 'text-orange-500' :
                              'text-primary'
                            }`}>{d.getDate()}</span>
                            <span className="text-[8px] font-bold uppercase text-muted-foreground">
                              {d.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-bold text-foreground">{appt.type}</p>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                appt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                appt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                appt.status === 'missed' ? 'bg-orange-100 text-orange-700' :
                                'bg-primary/10 text-primary'
                              }`}>
                                {appt.status === 'completed' && <CheckCircle2 className="h-2.5 w-2.5" />}
                                {appt.status === 'cancelled' && <XCircle className="h-2.5 w-2.5" />}
                                {appt.status}
                              </span>
                            </div>
                            {appt.doctor_name && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" />
                                Dr. {appt.doctor_name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                            {appt.notes && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                <span className="font-semibold">Note:</span> {appt.notes}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-2" />
                        </motion.button>
                      );
                    })
                  )
                )}

                {historyTab === 'medications' && (
                  medications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Pill className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No medications yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Your medication history will appear here</p>
                    </div>
                  ) : (
                    medications.map((med: any, idx: number) => (
                      <motion.div
                        key={med.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`rounded-xl border-2 p-4 ${
                          med.completed
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : med.taken_today
                            ? 'border-success/30 bg-success/5'
                            : 'border-destructive/30 bg-destructive/5'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 ${
                            med.completed
                              ? 'bg-emerald-100 text-emerald-600'
                              : med.taken_today
                              ? 'bg-success/20 text-success'
                              : 'bg-destructive/20 text-destructive'
                          }`}>
                            <Pill className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                              <p className={`font-bold ${
                                med.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                              }`}>{med.name}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                med.completed
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : med.taken_today
                                  ? 'bg-success/10 text-success'
                                  : 'bg-destructive/10 text-destructive'
                              }`}>
                                {med.completed ? 'Completed' : med.taken_today ? 'Taken Today' : 'Pending'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{med.dosage} · {med.frequency}</p>
                            {med.time && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {med.time}
                              </p>
                            )}
                            {med.refill_date && (
                              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                Refill: {new Date(med.refill_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
                <p className="text-[11px] text-center text-muted-foreground">
                  Showing your complete health history • Last updated {new Date().toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </Layout>
  );
};

export default PatientDashboard;