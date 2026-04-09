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
  RefreshCcw, Wifi, WifiOff, AlertTriangle, AlertCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Medication } from '@/types/patient';
import { toast } from 'sonner';

const POLL_INTERVAL = 30_000;

// ── Status config ──────────────────────────────────────────────────────────
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

// ── Read-only appointment detail modal ────────────────────────────────────
const AppointmentDetailModal = ({ appt, onClose }: { appt: any; onClose: () => void }) => {
  const d = new Date(appt.appointment_date);
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

// ── Live badge ─────────────────────────────────────────────────────────────
const LiveBadge = ({ lastUpdated, isLive }: { lastUpdated: Date | null; isLive: boolean }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
    {isLive ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-destructive" />}
    {lastUpdated
      ? <>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
      : 'Waiting...'}
    {isLive && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
  </div>
);

// ── Main dashboard ─────────────────────────────────────────────────────────
const PatientDashboard = () => {
  const { user } = useAuth();
  const { isEnabled } = useFeatures();

  const [loading, setLoading]           = useState(true);
  const [patientData, setPatientData]   = useState<any>(null);
  const [medications, setMedications]   = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats]               = useState<any>(null);
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  // Per-medication toggle loading state to give instant feedback
  const [togglingMeds, setTogglingMeds] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [isLive, setIsLive]             = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          .filter((m: any) => !m.completed)   // exclude completed medication courses
          .map((m: any) => ({
            id: String(m.id),
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            time: m.time,
            taken_today: Boolean(m.taken_today),   // ← always boolean
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

  // ── Optimistic toggle — updates UI instantly, rolls back on error ────────
  const handleToggleMed = async (medId: string, taken: boolean) => {
    // 1. Immediately flip the UI
    setMedications(prev => prev.map(m => m.id === medId ? { ...m, taken_today: taken } : m));
    setTogglingMeds(prev => ({ ...prev, [medId]: true }));

    try {
      await medicationsApi.markTaken(Number(medId), taken);
    } catch (e: any) {
      // Roll back on failure
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
  const bs         = p?.blood_sugar ?? 0;
  const hba1c      = p?.hba1c ?? 0;
  const adh        = p?.adherence_rate ?? 0;
  // ✅ use taken_today consistently
  const takenMeds  = medications.filter(m => m.taken_today).length;
  const totalMeds  = medications.length;
  const upcomingAppts     = appointments.filter(a => a.status === 'scheduled' && !a.is_overdue);
  const missedOverdueAppts = appointments.filter(a =>
    a.status === 'missed' ||
    (a.status === 'requested' && a.is_overdue) ||
    (a.status === 'scheduled' && a.is_overdue)
  ).sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());

  return (
    <Layout title="My Dashboard" subtitle="Your health overview and medication schedule">

      {/* ── Stat Cards ── */}
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

            {/* ── Upcoming ── */}
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
                const d = new Date(appt.appointment_date);
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

            {/* ── Missed / Overdue ── */}
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
                    const d = new Date(appt.appointment_date);
                    const isMissed = appt.status === 'missed';
                    const isOverdue = appt.is_overdue;
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

      {/* Medication List */}
      {isEnabled('Medication Schedule') && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-3">
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

    </Layout>
  );
};

export default PatientDashboard;