import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Activity, AlertTriangle, CheckCircle2, TrendingUp,
  TrendingDown, Pill, CalendarDays, Download, Loader2,
  Heart, BarChart3, ClipboardList, Stethoscope, RefreshCw,
  ShieldCheck, Clock, Target, Search, X, User, ChevronDown,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Colour palette ──────────────────────────────────────────────────────────
const COLORS = {
  primary: '#6366f1', emerald: '#10b981', amber: '#f59e0b',
  red: '#ef4444', sky: '#0ea5e9', violet: '#8b5cf6', slate: '#64748b',
};
const STATUS_COLORS: Record<string, string> = {
  stable: COLORS.emerald, warning: COLORS.amber, critical: COLORS.red,
};

const pct = (val: number, total: number) =>
  total ? Math.round((val / total) * 100) : 0;

const trend = (arr: { rate: number }[]) =>
  arr.length < 2 ? 0 : arr[arr.length - 1].rate - arr[0].rate;

// ── Stat card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color, delay = 0 }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; delay?: number;
}) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.35 }}
    className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-3xl font-black text-foreground">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
    </div>
  </motion.div>
);

const SectionHeader = ({ icon: Icon, title, color }: { icon: any; title: string; color: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${color}20` }}>
      <Icon className="h-3.5 w-3.5" style={{ color }} />
    </div>
    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
    <div className="flex-1 h-px bg-border" />
  </div>
);

const AdherenceRing = ({ value }: { value: number }) => {
  const r = 44, circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 80 ? COLORS.emerald : value >= 50 ? COLORS.amber : COLORS.red;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="text-center -mt-16 mb-10">
        <p className="text-3xl font-black" style={{ color }}>{value}%</p>
        <p className="text-xs text-muted-foreground font-medium">Avg. Adherence</p>
      </div>
    </div>
  );
};

// ── Patient selector dropdown ────────────────────────────────────────────────
const PatientSelector = ({
  patients, selected, onSelect, onClear,
}: {
  patients: any[];
  selected: any | null;
  onSelect: (p: any) => void;
  onClear: () => void;
}) => {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all min-w-[220px] ${
          selected
            ? 'border-primary/40 bg-primary/5 text-primary'
            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
        }`}>
        <User className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{selected ? selected.name : 'All Patients'}</span>
        {selected
          ? <X className="h-3.5 w-3.5 flex-shrink-0" onClick={e => { e.stopPropagation(); onClear(); setOpen(false); }} />
          : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        }
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search patients..."
                  className="h-8 w-full rounded-xl border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              <button onClick={() => { onClear(); setOpen(false); setSearch(''); }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-muted/50 transition-colors">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">All Patients</p>
                  <p className="text-[11px] text-muted-foreground">{patients.length} patients</p>
                </div>
              </button>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No patients found</p>
              ) : filtered.map(p => (
                <button key={p.id}
                  onClick={() => { onSelect(p); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    selected?.id === p.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 text-[10px] font-black"
                    style={{ background: `${STATUS_COLORS[p.status]}18`, color: STATUS_COLORS[p.status] }}>
                    {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.diabetes_type} · {p.age}y</p>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize`}
                    style={{ background: `${STATUS_COLORS[p.status]}15`, color: STATUS_COLORS[p.status] }}>
                    {p.status}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────
const HealthReport = () => {
  const { user } = useAuth();
  const role = user?.role ?? 'admin';

  const [data, setData]         = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [appts, setAppts]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  // ── Patient filter ────────────────────────────────────────────────────
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientAppts, setPatientAppts]       = useState<any[]>([]);
  const [patientMeds, setPatientMeds]         = useState<any[]>([]);
  const [loadingPatient, setLoadingPatient]   = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [stats, pList, aList] = await Promise.all([
        req<any>('/stats/dashboard'),
        req<any[]>('/patients'),
        req<any[]>('/appointments'),
      ]);
      setData(stats);
      setPatients(pList);
      setAppts(aList);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Load patient-specific data when a patient is selected
  useEffect(() => {
    if (!selectedPatient) { setPatientAppts([]); setPatientMeds([]); return; }
    setLoadingPatient(true);
    Promise.all([
      req<any[]>('/appointments').then(a => a.filter((x: any) => x.patient_id === selectedPatient.id)),
      req<any[]>(`/medications/patientf/${selectedPatient.id}`),
    ]).then(([a, m]) => {
      setPatientAppts(a);
      setPatientMeds(m);
    }).catch(() => {}).finally(() => setLoadingPatient(false));
  }, [selectedPatient]);

  // ── PDF export ────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('access_token');
      const url = selectedPatient
        ? `${API_URL}/stats/report/pdf/patient/${selectedPatient.id}`
        : `${API_URL}/stats/report/pdf`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob  = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = objUrl;
      a.download = selectedPatient
        ? `DiabeCare_${selectedPatient.name.replace(/ /g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`
        : `DiabeCare_Health_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success(selectedPatient ? `${selectedPatient.name}'s report downloaded!` : 'Health report downloaded!');
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Derived — overview (all patients) ────────────────────────────────
  const totalPat  = patients.length;
  const stable    = patients.filter(p => p.status === 'stable').length;
  const warning   = patients.filter(p => p.status === 'warning').length;
  const critical  = patients.filter(p => p.status === 'critical').length;
  const statusPie = [
    { name: 'Stable',   value: stable,   color: COLORS.emerald },
    { name: 'Warning',  value: warning,  color: COLORS.amber   },
    { name: 'Critical', value: critical, color: COLORS.red     },
  ].filter(d => d.value > 0);

  const diabetesDist = Object.entries(
    patients.reduce((acc: any, p) => { acc[p.diabetes_type] = (acc[p.diabetes_type] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const genderDist = [
    { name: 'Male',   value: patients.filter(p => p.gender === 'Male').length,   color: COLORS.sky    },
    { name: 'Female', value: patients.filter(p => p.gender === 'Female').length, color: COLORS.violet },
  ].filter(d => d.value > 0);

  const apptStatusDist = [
    { name: 'Scheduled', value: appts.filter(a => a.status === 'scheduled').length, fill: COLORS.primary },
    { name: 'Completed', value: appts.filter(a => a.status === 'completed').length, fill: COLORS.emerald },
    { name: 'Cancelled', value: appts.filter(a => a.status === 'cancelled').length, fill: COLORS.red     },
    { name: 'Requested', value: appts.filter(a => a.status === 'requested').length, fill: COLORS.amber   },
    { name: 'Missed',    value: appts.filter(a => a.status === 'missed').length,    fill: COLORS.slate   },
  ].filter(d => d.value > 0);

  const adherenceTrend  = data?.adherenceTrend  || [];
  const bloodSugarTrend = data?.bloodSugarTrend || [];
  const adherenceChange = trend(adherenceTrend);
  const avgBS = patients.length
    ? Math.round(patients.reduce((s, p) => s + (p.blood_sugar || 0), 0) / patients.length) : 0;

  // ── Per-patient derived ───────────────────────────────────────────────
  const sp = selectedPatient;
  const spApptDist = sp ? [
    { name: 'Scheduled', value: patientAppts.filter(a => a.status === 'scheduled').length, fill: COLORS.primary },
    { name: 'Completed', value: patientAppts.filter(a => a.status === 'completed').length, fill: COLORS.emerald },
    { name: 'Cancelled', value: patientAppts.filter(a => a.status === 'cancelled').length, fill: COLORS.red     },
    { name: 'Missed',    value: patientAppts.filter(a => a.status === 'missed').length,    fill: COLORS.slate   },
  ].filter(d => d.value > 0) : [];

  if (loading) {
    return (
      <Layout title="Health Report" subtitle="Loading analytics…">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Heart className="absolute inset-0 m-auto h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Compiling health analytics…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Health Report"
      subtitle={`Comprehensive analytics · ${new Date().toLocaleDateString('en-KE', { dateStyle: 'long' })}`}
    >
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {new Date().toLocaleTimeString('en-KE', { timeStyle: 'short' })} EAT
          </div>
          {/* Patient filter */}
          <PatientSelector
            patients={patients}
            selected={selectedPatient}
            onSelect={setSelectedPatient}
            onClear={() => setSelectedPatient(null)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={handleExportPDF} disabled={exporting}
            className="flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-60">
            {exporting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating PDF…</>
              : <><Download className="h-4 w-4" /> {selectedPatient ? `Export ${selectedPatient.name.split(' ')[0]}'s PDF` : 'Export PDF'}</>
            }
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── INDIVIDUAL PATIENT VIEW ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {selectedPatient ? (
          <motion.div key={selectedPatient.id} initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-10">

            {loadingPatient ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Patient header card */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black flex-shrink-0"
                      style={{ background: `${STATUS_COLORS[sp.status]}18`, color: STATUS_COLORS[sp.status] }}>
                      {sp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl font-black text-foreground">{sp.name}</h2>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize"
                          style={{ background: `${STATUS_COLORS[sp.status]}15`, color: STATUS_COLORS[sp.status] }}>
                          {sp.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sp.diabetes_type} · Age {sp.age} · {sp.gender}
                        {sp.assigned_doctor_name && ` · Dr. ${sp.assigned_doctor_name}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Clinical KPIs */}
                <section>
                  <SectionHeader icon={Activity} title="Clinical Metrics" color={COLORS.primary} />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Blood Sugar"    value={`${sp.blood_sugar} mg/dL`} icon={Activity}    color={COLORS.amber}   delay={0.05} />
                    <StatCard label="HbA1c"          value={`${sp.hba1c}%`}           icon={Target}       color={COLORS.violet}  delay={0.09} />
                    <StatCard label="Adherence Rate" value={`${sp.adherence_rate}%`}  icon={CheckCircle2} color={COLORS.emerald} delay={0.13} />
                    <StatCard label="Medications"    value={patientMeds.filter(m => !m.completed).length} sub="active" icon={Pill} color={COLORS.primary} delay={0.17} />
                  </div>
                </section>

                {/* Adherence ring + Appt breakdown */}
                <section>
                  <SectionHeader icon={Heart} title="Adherence & Appointments" color={COLORS.red} />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col items-center justify-center">
                      <p className="text-sm font-semibold text-foreground mb-2 self-start">Medication Adherence</p>
                      <AdherenceRing value={Math.round(Number(sp.adherence_rate))} />
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                      <p className="text-sm font-semibold text-foreground mb-4">Appointment Breakdown</p>
                      {spApptDist.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No appointments yet</p>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={spApptDist} barSize={32}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" radius={[6,6,0,0]}>
                                {spApptDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="flex flex-wrap gap-3 mt-3 justify-center">
                            {spApptDist.map(d => (
                              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                                <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                                <span className="text-muted-foreground">{d.name}</span>
                                <span className="font-bold text-foreground">{d.value}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>

                {/* Medications list */}
                <section>
                  <SectionHeader icon={Pill} title="Current Medications" color={COLORS.violet} />
                  {patientMeds.filter(m => !m.completed).length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center">
                      <Pill className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No active medications</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            {['Medication', 'Dosage', 'Frequency', 'Time', 'Refill Date', 'Today'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {patientMeds.filter(m => !m.completed).map((m, i) => (
                            <tr key={m.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                              <td className="px-4 py-3 font-semibold text-foreground">{m.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{m.dosage}</td>
                              <td className="px-4 py-3 text-muted-foreground">{m.frequency}</td>
                              <td className="px-4 py-3 text-muted-foreground">{m.time || '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {m.refill_date ? new Date(m.refill_date).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  m.taken_today ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                                }`}>
                                  {m.taken_today ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                  {m.taken_today ? 'Taken' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Appointment history */}
                <section>
                  <SectionHeader icon={CalendarDays} title="Appointment History" color={COLORS.sky} />
                  {patientAppts.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center">
                      <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No appointments on record</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            {['Date', 'Type', 'Doctor', 'Status', 'Notes'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {patientAppts.sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())
                            .slice(0, 15).map((a, i) => (
                            <tr key={a.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                                {new Date(a.appointment_date).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground">{a.type}</td>
                              <td className="px-4 py-3 text-muted-foreground">{a.doctor_name || '—'}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
                                  style={{ background: `${STATUS_COLORS[a.status] ?? COLORS.slate}15`, color: STATUS_COLORS[a.status] ?? COLORS.slate }}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{a.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                  Individual report for {sp.name} · Generated {new Date().toLocaleString('en-KE')} EAT
                </motion.div>
              </>
            )}
          </motion.div>

        ) : (
          /* ══════════════════════════════════════════════════════════════ */
          /* ── ALL PATIENTS OVERVIEW ── */
          /* ══════════════════════════════════════════════════════════════ */
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-10">

            <section>
              <SectionHeader icon={BarChart3} title="Key Metrics" color={COLORS.primary} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Patients"   value={totalPat}  sub={`${stable} stable`} icon={Users} color={COLORS.primary} delay={0.05} />
                <StatCard label="Critical Cases"   value={critical}  sub={`${pct(critical, totalPat)}% of total`} icon={AlertTriangle} color={COLORS.red} delay={0.09} />
                <StatCard label="Avg. Blood Sugar" value={`${avgBS} mg/dL`} sub="cohort average" icon={Activity} color={COLORS.amber} delay={0.13} />
                <StatCard label="Upcoming Appts"   value={data?.upcomingAppointments ?? 0} sub="scheduled" icon={CalendarDays} color={COLORS.sky} delay={0.17} />
              </div>
            </section>

            <section>
              <SectionHeader icon={Heart} title="Patient Health Overview" color={COLORS.red} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm font-semibold text-foreground mb-4">Health Status Distribution</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                        {statusPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any) => [`${v} patients`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    {statusPie.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-bold text-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col items-center justify-center">
                  <p className="text-sm font-semibold text-foreground mb-2 self-start">Medication Adherence</p>
                  <AdherenceRing value={Math.round(data?.avgAdherence ?? 0)} />
                  <div className={`flex items-center gap-1.5 text-xs font-semibold mt-1 ${adherenceChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {adherenceChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {Math.abs(adherenceChange).toFixed(1)}% vs 6 months ago
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm font-semibold text-foreground mb-4">Gender Distribution</p>
                  <div className="space-y-3">
                    {genderDist.map(d => (
                      <div key={d.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{d.name}</span>
                          <span className="font-bold text-foreground">{d.value} ({pct(d.value, totalPat)}%)</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct(d.value, totalPat)}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="h-full rounded-full" style={{ background: d.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-6 mb-4">Diabetes Type</p>
                  <div className="space-y-3">
                    {diabetesDist.map((d: any, i) => {
                      const dColors = [COLORS.primary, COLORS.violet, COLORS.sky];
                      return (
                        <div key={d.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{d.name}</span>
                            <span className="font-bold text-foreground">{d.value as number} ({pct(d.value as number, totalPat)}%)</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct(d.value as number, totalPat)}%` }}
                              transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                              className="h-full rounded-full" style={{ background: dColors[i % 3] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionHeader icon={TrendingUp} title="6-Month Trends" color={COLORS.emerald} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm font-semibold text-foreground mb-1">Medication Adherence Trend</p>
                  <p className="text-xs text-muted-foreground mb-4">6-month rolling average (%)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={adherenceTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(v: any) => [`${v}%`, 'Adherence']} />
                      <Line type="monotone" dataKey="rate" stroke={COLORS.emerald} strokeWidth={2.5}
                        dot={{ r: 4, fill: COLORS.emerald }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm font-semibold text-foreground mb-1">Average Blood Sugar Trend</p>
                  <p className="text-xs text-muted-foreground mb-4">7-day cohort average (mg/dL)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={bloodSugarTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit=" mg/dL" width={70} />
                      <Tooltip formatter={(v: any) => [`${v} mg/dL`, 'Avg. BS']} />
                      <Line type="monotone" dataKey="avg" stroke={COLORS.amber} strokeWidth={2.5}
                        dot={{ r: 4, fill: COLORS.amber }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section>
              <SectionHeader icon={CalendarDays} title="Appointment Analytics" color={COLORS.sky} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm font-semibold text-foreground mb-4">Appointment Status Breakdown</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={apptStatusDist} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6,6,0,0]}>
                        {apptStatusDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-sm font-semibold text-foreground mb-4">Summary</p>
                  <div className="space-y-3">
                    {apptStatusDist.map(d => (
                      <div key={d.name} className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: `${d.fill}10`, border: `1px solid ${d.fill}25` }}>
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                          <span className="text-sm font-medium text-foreground">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-black text-foreground">{d.value}</span>
                          <span className="text-xs text-muted-foreground">{pct(d.value, appts.length)}%</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 border border-border mt-2">
                      <span className="text-sm font-semibold text-foreground">Total Appointments</span>
                      <span className="text-lg font-black text-foreground">{appts.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionHeader icon={AlertTriangle} title="Patients Requiring Attention" color={COLORS.red} />
              {patients.filter(p => p.status !== 'stable').length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
                  <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-700">All patients are in stable condition</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {['Patient', 'Status', 'HbA1c', 'Blood Sugar', 'Adherence', 'Doctor'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {patients.filter(p => p.status !== 'stable').sort((a, b) => a.status === 'critical' ? -1 : 1).map((p, i) => (
                        <tr key={p.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <button onClick={() => setSelectedPatient(p)}
                              className="hover:text-primary hover:underline transition-colors text-left">
                              {p.name}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize"
                              style={{ background: `${STATUS_COLORS[p.status]}18`, color: STATUS_COLORS[p.status] }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[p.status] }} />
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums">{p.hba1c}%</td>
                          <td className="px-4 py-3 tabular-nums">{p.blood_sugar} mg/dL</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden w-16">
                                <div className="h-full rounded-full"
                                  style={{ width: `${p.adherence_rate}%`, background: p.adherence_rate >= 80 ? COLORS.emerald : p.adherence_rate >= 50 ? COLORS.amber : COLORS.red }} />
                              </div>
                              <span className="text-xs tabular-nums font-medium">{p.adherence_rate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.assigned_doctor_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <SectionHeader icon={Pill} title="Medications Overview" color={COLORS.violet} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Medications" value={data?.medicationsDispensed ?? 0} sub="across all patients" icon={Pill} color={COLORS.violet} delay={0.05} />
                <StatCard label="Avg per Patient"   value={totalPat ? (Math.round((data?.medicationsDispensed ?? 0) / totalPat * 10) / 10) : 0} sub="medications/patient" icon={Target} color={COLORS.sky} delay={0.09} />
                <StatCard label="High Adherence"    value={patients.filter(p => p.adherence_rate >= 80).length} sub="≥ 80% adherence" icon={CheckCircle2} color={COLORS.emerald} delay={0.13} />
                <StatCard label="Low Adherence"     value={patients.filter(p => p.adherence_rate < 50).length}  sub="< 50% adherence" icon={AlertTriangle} color={COLORS.red} delay={0.17} />
              </div>
            </section>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              Report generated by DiabeCare · Data reflects current system state · {role === 'doctor' ? 'Showing your assigned patients only' : 'Showing all patients'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default HealthReport;