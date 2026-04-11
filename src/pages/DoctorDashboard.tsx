import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import {
  Users, Activity, AlertTriangle, CalendarDays, Search, Loader2,
  Pill, Clock, RefreshCcw, X, User, Wifi, WifiOff, ChevronRight,
  Stethoscope, Heart, TrendingUp, Droplets, Sparkles, FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { patientsApi, statsApi, appointmentsApi, medicationsApi } from '@/services/api';
import { Patient, Appointment } from '@/types/patient';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useNavigate } from 'react-router-dom';

const POLL_INTERVAL = 30_000;

interface DoctorStats {
  avgAdherence: number;
  adherenceTrend: { month: string; rate: number }[];
  bloodSugarTrend: { day: string; avg: number }[];
}

// ── DatePicker global styles ───────────────────────────────────────────────
const DatePickerStyles = () => (
  <style>{`
    .react-datepicker-popper { z-index: 9999 !important; }
    .react-datepicker {
      font-family: inherit !important;
      border: 1px solid hsl(200,20%,88%) !important;
      border-radius: 14px !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.15) !important;
      overflow: hidden;
    }
    .react-datepicker__header {
      background: linear-gradient(135deg, hsl(174,62%,38%), hsl(174,55%,30%)) !important;
      border-bottom: none !important;
      padding-top: 12px !important;
      padding-bottom: 8px !important;
    }
    .react-datepicker__current-month {
      font-size: 13px !important; font-weight: 700 !important;
      color: #fff !important; margin-bottom: 8px !important;
    }
    .react-datepicker__day-name {
      font-size: 11px !important; font-weight: 600 !important;
      color: rgba(255,255,255,0.7) !important;
      width: 2rem !important; line-height: 2rem !important;
    }
    .react-datepicker__day {
      width: 2rem !important; line-height: 2rem !important;
      font-size: 12px !important; border-radius: 8px !important;
      color: hsl(210,12%,20%) !important;
      transition: all 0.15s !important;
    }
    .react-datepicker__day:hover {
      background: hsl(174,62%,90%) !important;
      color: hsl(174,62%,25%) !important;
    }
    .react-datepicker__day--selected,
    .react-datepicker__day--keyboard-selected {
      background: hsl(174,62%,38%) !important;
      color: #fff !important; font-weight: 700 !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
    }
    .react-datepicker__day--today {
      font-weight: 700 !important;
      color: hsl(174,62%,35%) !important;
    }
    .react-datepicker__day--disabled { color: hsl(210,12%,78%) !important; }
    .react-datepicker__navigation-icon::before {
      border-color: rgba(255,255,255,0.8) !important;
    }
    .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
      border-color: #fff !important;
    }
    .react-datepicker__time-container {
      width: 90px !important;
      border-left: 1px solid hsl(200,20%,88%) !important;
    }
    .react-datepicker__time-box { width: 90px !important; }
    .react-datepicker__time-list { height: 204px !important; }
    .react-datepicker__time-list-item {
      font-size: 12px !important; padding: 6px 8px !important;
      height: auto !important; white-space: nowrap !important;
      display: flex !important; align-items: center !important;
      color: hsl(210,12%,25%) !important;
    }
    .react-datepicker__time-list-item:hover {
      background: hsl(174,62%,92%) !important;
      color: hsl(174,62%,25%) !important;
    }
    .react-datepicker__time-list-item--selected {
      background: hsl(174,62%,38%) !important;
      color: #fff !important; font-weight: 600 !important;
    }
    .react-datepicker__time-caption {
      font-size: 11px !important; font-weight: 700 !important;
      color: hsl(210,12%,45%) !important; padding: 6px 8px 4px !important;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .react-datepicker__input-container { width: 100% !important; }
    .react-datepicker__input-container input { width: 100% !important; }
    /* ── Mobile: shrink calendar to fit small screens ── */
    @media (max-width: 480px) {
      .react-datepicker {
        font-size: 11px !important;
      }
      .react-datepicker__month-container {
        float: none !important;
        width: 100% !important;
      }
      .react-datepicker__day-name,
      .react-datepicker__day {
        width: 1.7rem !important;
        line-height: 1.7rem !important;
        font-size: 11px !important;
        margin: 1px !important;
      }
      .react-datepicker__current-month {
        font-size: 12px !important;
      }
      .react-datepicker__time-container {
        float: none !important;
        border-left: none !important;
        border-top: 1px solid hsl(200,20%,88%) !important;
        width: 100% !important;
      }
      .react-datepicker__time-box {
        width: 100% !important;
      }
      .react-datepicker__time-list {
        height: 80px !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        align-items: center !important;
        padding: 0 4px !important;
        gap: 4px !important;
      }
      .react-datepicker__time-list-item {
        flex-shrink: 0 !important;
        border-radius: 8px !important;
        padding: 6px 10px !important;
        background: hsl(210,20%,97%) !important;
      }
      .react-datepicker-popper {
        width: calc(100vw - 2rem) !important;
        max-width: 340px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
      }
    }
  `}</style>
);

// ── Live badge ─────────────────────────────────────────────────────────────
const LiveBadge = ({ lastUpdated, isLive }: { lastUpdated: Date | null; isLive: boolean }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
    {isLive ? <Wifi className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3 text-red-400" />}
    {lastUpdated
      ? <>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
      : 'Waiting...'}
    {isLive && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
  </div>
);

// ── Status config ──────────────────────────────────────────────────────────
const STATUS = {
  stable:   { dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',   bar: 'bg-emerald-400' },
  warning:  { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-600 border-amber-200',         bar: 'bg-amber-400'   },
  critical: { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-500 border-red-200',               bar: 'bg-red-400'     },
};

// ── Reusable form field ────────────────────────────────────────────────────
const Field = ({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) => (
  <div>
    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
      {label}{optional && <span className="normal-case tracking-normal font-normal ml-1 text-gray-300">(optional)</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white transition-all";

const IconInput = ({ icon: Icon, ...props }: { icon: any } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
    <input {...props} className={inputCls} />
  </div>
);

// ── Chart tooltip ──────────────────────────────────────────────────────────
const TooltipStyle = {
  background: '#fff', border: '1px solid hsl(200,20%,90%)',
  borderRadius: '10px', fontSize: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
};

// ── Main component ─────────────────────────────────────────────────────────
const DoctorDashboard = () => {
  const { isEnabled } = useFeatures();
  const navigate = useNavigate();

  const [patients, setPatients]     = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats]           = useState<DoctorStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive]         = useState(true);
  const [search, setSearch]         = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Schedule modal
  const [scheduleOpen, setScheduleOpen]     = useState(false);
  const [schedulePatientId, setSchedulePatientId] = useState<number | null>(null);
  const [scheduleDate, setScheduleDate]     = useState<Date | null>(null);
  const [scheduleType, setScheduleType]     = useState('Follow-up');
  const [scheduleNotes, setScheduleNotes]   = useState('');
  const [scheduling, setScheduling]         = useState(false);

  // Medication modal
  const [medOpen, setMedOpen]               = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [medName, setMedName]               = useState('');
  const [dosage, setDosage]                 = useState('');
  const [frequency, setFrequency]           = useState('');
  const [medTime, setMedTime]               = useState('');
  const [refillDate, setRefillDate]         = useState<Date | null>(null);
  const [prescribing, setPrescribing]       = useState(false);

  const refreshStats = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const sData = await statsApi.dashboard();
      setStats(sData);
      setLastUpdated(new Date());
      setIsLive(true);
    } catch { setIsLive(false); }
    finally { if (!silent) setRefreshing(false); }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [pData, apptData] = await Promise.all([
        patientsApi.list(),
        appointmentsApi.list(),
      ]);
      const pWithMeds = await Promise.all(
        pData.map(async (p: Patient) => {
          const meds = await medicationsApi.listByPatient(p.id);
          return { ...p, medications: meds.filter((m: any) => !m.completed) };
        })
      );
      setPatients(pWithMeds);
      setAppointments(apptData);
      await refreshStats(true);
    } catch (err: any) {
      toast.error(err.message);
      setIsLive(false);
    } finally { setLoading(false); }
  }, [refreshStats]);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(() => refreshStats(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll, refreshStats]);

  if (loading) return (
    <Layout title="Doctor Dashboard">
      <div className="py-24 flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
      </div>
    </Layout>
  );

  const filteredPatients = patients.filter(p =>
    p.name?.trim().toLowerCase().includes(search.trim().toLowerCase())
  );
  const criticalPatients = patients.filter(p => p.status?.toLowerCase() === 'critical');
  // Compare date-only strings to avoid timezone shift issues
  const todayDateStr = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().slice(0, 10);

  const todayAppointments = appointments.filter(a => {
    if (!a.appointment_date) return false;
    // Works whether the API returns "2025-03-07T10:00:00", "2025-03-07T10:00:00+03:00", etc.
    const apptDateStr = a.appointment_date.slice(0, 10);
    return apptDateStr === todayDateStr;
  });
  const selectedPatientName = patients.find(p => p.id === selectedPatientId)?.name;

  const handleSchedule = async () => {
    if (!schedulePatientId || !scheduleDate) return;
    setScheduling(true);
    try {
      await appointmentsApi.create({
        patient_id: schedulePatientId,
        appointment_date: scheduleDate.toISOString(),
        type: scheduleType,
        notes: scheduleNotes.trim(),
      });
      toast.success('Appointment scheduled');
      await fetchAll();
      setScheduleOpen(false);
      setSchedulePatientId(null); setScheduleDate(null); setScheduleType('Follow-up'); setScheduleNotes('');
    } catch (err: any) { toast.error(err.message); }
    finally { setScheduling(false); }
  };

  const openMedModal = (patientId: number) => {
    setSelectedPatientId(patientId);
    setMedName(''); setDosage(''); setFrequency(''); setMedTime(''); setRefillDate(null);
    setMedOpen(true);
  };

  const handleCreateMedication = async () => {
    if (!selectedPatientId || !medName || !dosage || !frequency) {
      toast.error('Please fill all required fields'); return;
    }
    setPrescribing(true);
    try {
      await medicationsApi.create({
        patient_id: selectedPatientId,
        name: medName, dosage, frequency, time: medTime,
        refill_date: refillDate ? refillDate.toISOString().split('T')[0] : null,
      });
      toast.success('Medication prescribed successfully');
      setMedOpen(false);
      await fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setPrescribing(false); }
  };

  return (
    <Layout title="Doctor Dashboard" subtitle="Your patients and schedule overview">
      <DatePickerStyles />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isEnabled('My Patients Count') && (
          <StatCard title="My Patients" value={patients.length} icon={Users} trend="+0 this month" trendUp variant="primary" />
        )}
        {isEnabled('Patient Adherence Trend') && (
          <StatCard title="Avg Adherence" value={`${stats?.avgAdherence ?? 0}%`} icon={Activity} trendUp variant="success" />
        )}
        {isEnabled('Critical Patients Alert') && (
          <StatCard title="Critical" value={criticalPatients.length} icon={AlertTriangle} variant="danger" />
        )}
        {isEnabled("Today's Appointments") && (
          <StatCard title="Today's Appts" value={todayAppointments.length} icon={CalendarDays} variant="warning" />
        )}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {isEnabled('Patient Adherence Trend') && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            {/* Chart header with gradient accent */}
            <div className="px-6 pt-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Patient Adherence Trend</h3>
                    <p className="text-[11px] text-muted-foreground">Last 6 months · medication compliance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LiveBadge lastUpdated={lastUpdated} isLive={isLive} />
                  <button onClick={() => refreshStats(false)} disabled={refreshing}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats?.adherenceTrend ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adherenceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(152,60%,45%)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(152,60%,45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,93%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(210,12%,55%)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(210,12%,55%)' }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={80} stroke="hsl(152,60%,55%)" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Tooltip contentStyle={TooltipStyle} formatter={(v: any) => [`${v}%`, 'Adherence']} />
                  <Area type="monotone" dataKey="rate" stroke="hsl(152,60%,42%)" strokeWidth={2.5}
                    fill="url(#adherenceGrad)" dot={{ r: 3.5, fill: '#fff', stroke: 'hsl(152,60%,42%)', strokeWidth: 2 }} activeDot={{ r: 5.5, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {isEnabled('Avg Blood Sugar Chart') && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                    <Droplets className="h-4 w-4 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Avg Blood Sugar (mg/dL)</h3>
                    <p className="text-[11px] text-muted-foreground">Last 7 days · across all patients</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LiveBadge lastUpdated={lastUpdated} isLive={isLive} />
                  <button onClick={() => refreshStats(false)} disabled={refreshing}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats?.bloodSugarTrend ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,93%)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(210,12%,55%)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[80, 200]} tick={{ fontSize: 11, fill: 'hsl(210,12%,55%)' }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={140} stroke="hsl(38,92%,55%)" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'target', position: 'right', fontSize: 9, fill: 'hsl(38,70%,50%)' }} />
                  <Tooltip contentStyle={TooltipStyle} formatter={(v: any) => [`${v} mg/dL`, 'Avg Blood Sugar']} />
                  <Bar dataKey="avg" fill="hsl(205,80%,55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Search + Schedule button ── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search patients…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setScheduleOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:bg-primary/90 transition-all">
          <CalendarDays className="h-4 w-4" />
          Schedule Appointment
        </motion.button>
      </div>

      {/* ── Patient cards ── */}
      <div className="space-y-3 mb-8">
        {filteredPatients.map((p, i) => {
          const statusKey = (p.status?.toLowerCase() ?? 'stable') as keyof typeof STATUS;
          const s = STATUS[statusKey] ?? STATUS.stable;
          const taken  = p.medications?.filter((m: any) => m.taken_today && !m.completed).length ?? 0;
          const total  = p.medications?.filter((m: any) => !m.completed).length ?? 0;
          const adhPct = Math.min(100, Math.max(0, p.adherence_rate ?? 0));

          return (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="group rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/20 transition-all overflow-hidden">

              {/* Thin status stripe on left */}
              <div className="flex">
                <div className={`w-1 flex-shrink-0 ${s.bar} opacity-70`} />

                <div className="flex-1 p-4 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm ring-2 ring-primary/10">
                    {p.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-sm text-foreground truncate">{p.name}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${s.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {p.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" />{p.diabetes_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Next: <span className="text-foreground font-medium">{p.next_visit ?? 'Not scheduled'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Pill className="h-3 w-3" />{taken}/{total} meds today
                      </span>
                    </div>
                    {/* Adherence mini bar */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${adhPct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.04 + 0.2 }}
                          className={`h-full rounded-full ${adhPct >= 80 ? 'bg-emerald-400' : adhPct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground w-8 text-right">{adhPct}%</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => navigate(`/patients/${p.id}`)}
                      className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all shadow-sm">
                      View
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => openMedModal(p.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500 hover:shadow-indigo-500/40 transition-all">
                      <Pill className="h-3.5 w-3.5" />
                      Prescribe
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {filteredPatients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/25 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No patients found</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          SCHEDULE APPOINTMENT MODAL
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {scheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="w-full max-w-md rounded-3xl bg-white shadow-2xl max-h-[92vh] flex flex-col"
            >
              {/* Gradient header */}
              <div className="relative rounded-t-3xl bg-gradient-to-br from-primary to-primary/80 px-6 pt-6 pb-8">
                <button onClick={() => { setScheduleOpen(false); setScheduleNotes(''); }}
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white/70 hover:text-white hover:bg-white/30 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                    <CalendarDays className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">New Appointment</p>
                    <h3 className="text-lg font-black text-white">Schedule Visit</h3>
                  </div>
                </div>
              </div>

              {/* Pull-up card effect */}
              <div className="-mt-4 rounded-t-3xl bg-white px-6 pt-6 pb-5 space-y-4 overflow-visible flex-1">
                <Field label="Patient">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 z-10" />
                    <select value={schedulePatientId ?? ''} onChange={e => setSchedulePatientId(Number(e.target.value))}
                      className={inputCls + ' appearance-none'}>
                      <option value="" disabled>Choose a patient…</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </Field>

                <Field label="Date & Time">
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 z-10" />
                    <DatePicker
                      selected={scheduleDate}
                      onChange={(d: Date) => setScheduleDate(d)}
                      showTimeSelect minDate={new Date()}
                      dateFormat="MMM d, yyyy h:mm aa"
                      placeholderText="Select date and time"
                      popperPlacement="bottom-start"
                      popperProps={{ strategy: 'fixed' }}
                      portalId="datepicker-portal"
                      wrapperClassName="w-full"
                      timeIntervals={30}
                      className={inputCls}
                    />
                  </div>
                  {scheduleDate && (
                    <p className="text-[11px] text-primary font-medium mt-1.5 flex items-center gap-1 pl-1">
                      <Sparkles className="h-3 w-3" />
                      {scheduleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {scheduleDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </Field>

                <Field label="Appointment Type">
                  <div className="relative">
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                    <input type="text" value={scheduleType} onChange={e => setScheduleType(e.target.value)}
                      placeholder="e.g. Follow-up, Consultation, Review"
                      className={inputCls} />
                  </div>
                </Field>

                <Field label="Notes (optional)">
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-gray-300" />
                    <textarea
                      value={scheduleNotes}
                      onChange={e => setScheduleNotes(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Clinical notes, preparation instructions, follow-up details…"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white transition-all resize-none"
                    />
                    <p className="text-[11px] text-gray-300 text-right mt-1">{scheduleNotes.length}/500</p>
                  </div>
                </Field>
              </div>

              <div className="flex gap-3 px-6 pb-6 flex-shrink-0 border-t border-gray-100 pt-4">
                <button onClick={() => setScheduleOpen(false)}
                  className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button disabled={!schedulePatientId || !scheduleDate || scheduling} onClick={handleSchedule}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                  Confirm Appointment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          PRESCRIBE MEDICATION MODAL
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {medOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="w-full max-w-md rounded-3xl bg-white shadow-2xl max-h-[92vh] flex flex-col"
            >
              {/* Indigo gradient header */}
              <div className="relative rounded-t-3xl bg-gradient-to-br from-indigo-600 to-indigo-500 px-6 pt-6 pb-8">
                <button onClick={() => setMedOpen(false)}
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white/70 hover:text-white hover:bg-white/30 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                    <Pill className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">New Prescription</p>
                    <h3 className="text-lg font-black text-white leading-tight">Prescribe Medication</h3>
                    {selectedPatientName && (
                      <p className="text-xs text-white/70 mt-0.5">
                        for <span className="text-white font-semibold">{selectedPatientName}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pull-up card */}
              <div className="-mt-4 rounded-t-3xl bg-white px-6 pt-6 pb-4 space-y-4">
                <Field label="Medication Name">
                  <IconInput icon={Pill} placeholder="e.g. Metformin 500mg, Insulin Glargine" value={medName} onChange={e => setMedName(e.target.value)} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Dosage">
                    <IconInput icon={Activity} placeholder="e.g. 500mg" value={dosage} onChange={e => setDosage(e.target.value)} />
                  </Field>
                  <Field label="Frequency">
                    <IconInput icon={RefreshCcw} placeholder="e.g. Twice daily" value={frequency} onChange={e => setFrequency(e.target.value)} />
                  </Field>
                </div>

                <Field label="Time of Administration" optional>
                  <IconInput icon={Clock} placeholder="e.g. 08:00 AM, After meals" value={medTime} onChange={e => setMedTime(e.target.value)} />
                </Field>

                <Field label="Refill Date" optional>
                  <div className="relative">
                    <RefreshCcw className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 z-10" />
                    <DatePicker
                      selected={refillDate}
                      onChange={(d: Date) => setRefillDate(d)}
                      dateFormat="MMM d, yyyy" minDate={new Date()}
                      placeholderText="Select refill date"
                      popperPlacement="bottom-start"
                      popperProps={{ strategy: 'fixed' }}
                      wrapperClassName="w-full"
                      className={inputCls}
                    />
                  </div>
                  {refillDate && (
                    <p className="text-[11px] text-indigo-500 font-medium mt-1.5 flex items-center gap-1 pl-1">
                      <Sparkles className="h-3 w-3" />
                      Patient will be reminded on {refillDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </Field>

                <p className="text-[11px] text-gray-300 pt-1">* Name, dosage and frequency are required</p>
              </div>

              <div className="flex gap-3 px-6 pb-6 flex-shrink-0 border-t border-gray-100 pt-4">
                <button onClick={() => setMedOpen(false)}
                  className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreateMedication}
                  disabled={!medName || !dosage || !frequency || prescribing}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 hover:shadow-indigo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {prescribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pill className="h-4 w-4" />}
                  Prescribe
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </Layout>
  );
};

export default DoctorDashboard;