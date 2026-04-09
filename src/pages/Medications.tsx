import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '@/components/Layout';
import { patientsApi, statsApi, medicationsApi } from '@/services/api';
import { Patient } from '@/types/patient';
import {
  Pill, RefreshCcw, Wifi, WifiOff, Loader2, Search,
  ChevronDown, ChevronUp, Check, X, CalendarDays,
  CheckCircle2, MoreHorizontal, Pencil, Archive,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const POLL_INTERVAL = 30_000;

const ChartTooltipStyle = {
  background: 'hsl(0,0%,100%)',
  border: '1px solid hsl(200,20%,90%)',
  borderRadius: '8px',
  fontSize: '12px',
};

const LiveBadge = ({ lastUpdated, isLive }: { lastUpdated: Date | null; isLive: boolean }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
    {isLive ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-destructive" />}
    {lastUpdated
      ? <>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
      : 'Waiting...'}
    {isLive && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
  </div>
);

// ── Refill Date Modal ──────────────────────────────────────────────────────
const RefillModal = ({
  med, onClose, onSave,
}: {
  med: any;
  onClose: () => void;
  onSave: (medId: number, date: string | null) => Promise<void>;
}) => {
  const current = med.refill_date ? med.refill_date.split('T')[0] : '';
  const [date, setDate] = useState(current);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(med.id, date || null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Update Refill Date</p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{med.name} · {med.dosage}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-2">
              New Refill Date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all"
            />
          </div>
          {date && (
            <p className="text-xs text-muted-foreground">
              New refill scheduled for{' '}
              <span className="font-semibold text-foreground">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </p>
          )}
          {!date && current && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">
              Saving without a date will clear the current refill date.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-all">
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Date'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Complete Confirm Modal ────────────────────────────────────────────────
const CompleteModal = ({
  med, onClose, onConfirm,
}: {
  med: any;
  onClose: () => void;
  onConfirm: (medId: number) => Promise<void>;
}) => {
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(med.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="text-base font-black text-foreground">Mark as Completed?</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            This will mark <span className="font-semibold text-foreground">{med.name} ({med.dosage})</span> as a completed course. It will be archived and no longer shown as active.
          </p>
        </div>

        <div className="mx-6 mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-xs text-amber-700 font-medium">
            This action is permanent. The medication record will be kept for history but won't appear in active prescriptions.
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-all">
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleConfirm} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600 transition-all disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? 'Completing…' : 'Yes, Complete'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Med action menu ────────────────────────────────────────────────────────
const MedActions = ({
  med, onRefill, onComplete, onDelete,
}: {
  med: any;
  onRefill: (med: any) => void;
  onComplete: (med: any) => void;
  onDelete: (med: any) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (med.completed) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-black text-emerald-600">
      <CheckCircle2 className="h-3 w-3" />Completed
    </span>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-8 z-[9999] w-44 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
          >
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onRefill(med); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-primary/8 hover:text-primary transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              Update Refill Date
            </button>
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onComplete(med); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Mark as Completed
            </button>
            <div className="h-px bg-border/60 mx-3" />
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onDelete(med); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/8 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────
const Medications = () => {
  const [patients, setPatients]       = useState<Patient[]>([]);
  const [stats, setStats]             = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive]           = useState(true);
  const [search, setSearch]           = useState('');
  const [expanded, setExpanded]       = useState<Record<string, boolean>>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modal state
  const [refillModal, setRefillModal]     = useState<any>(null);
  const [completeModal, setCompleteModal] = useState<any>(null);

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
      const pData = await patientsApi.list();
      const pWithMeds = await Promise.all(
        pData.map(async (p: Patient) => {
          const meds = await medicationsApi.listByPatient(Number((p as any).id));
          return { ...p, medications: meds };
        })
      );
      setPatients(pWithMeds);
      await refreshStats(true);
    } catch (err: any) {
      toast.error(err.message);
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

  // ── Actions ──────────────────────────────────────────────────────────
  const handleUpdateRefill = async (medId: number, date: string | null) => {
    await medicationsApi.updateRefill(medId, date);
    toast.success(date ? 'Refill date updated' : 'Refill date cleared');
    // Update locally
    setPatients(prev => prev.map(p => ({
      ...p,
      medications: (p.medications ?? []).map((m: any) =>
        m.id === medId ? { ...m, refill_date: date } : m
      ),
    })));
  };

  const handleMarkComplete = async (medId: number) => {
    await medicationsApi.markComplete(medId);
    toast.success('Medication marked as completed');
    setPatients(prev => prev.map(p => ({
      ...p,
      medications: (p.medications ?? []).map((m: any) =>
        m.id === medId ? { ...m, completed: true } : m
      ),
    })));
  };

  const handleDelete = async (med: any) => {
    if (!confirm(`Delete ${med.name} (${med.dosage})? This cannot be undone.`)) return;
    try {
      await medicationsApi.delete(med.id);
      toast.success('Medication deleted');
      setPatients(prev => prev.map(p => ({
        ...p,
        medications: (p.medications ?? []).filter((m: any) => m.id !== med.id),
      })));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = patients.filter(p =>
    p.name?.trim().toLowerCase().includes(search.trim().toLowerCase())
  );

  const totalMeds   = patients.reduce((s, p) => s + ((p.medications ?? []).filter((m: any) => !m.completed).length), 0);
  const takenToday  = patients.reduce((s, p) => s + ((p.medications ?? []).filter((m: any) => m.taken_today && !m.completed).length), 0);
  const missedToday = totalMeds - takenToday;
  const completedTotal = patients.reduce((s, p) => s + ((p.medications ?? []).filter((m: any) => m.completed).length), 0);

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return (
    <Layout title="Medications">
      <div className="py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </Layout>
  );

  return (
    <Layout title="Medications" subtitle="All patient prescriptions and adherence overview">

      {/* ── Modals ── */}
      <AnimatePresence>
        {refillModal && (
          <RefillModal
            med={refillModal}
            onClose={() => setRefillModal(null)}
            onSave={handleUpdateRefill}
          />
        )}
        {completeModal && (
          <CompleteModal
            med={completeModal}
            onClose={() => setCompleteModal(null)}
            onConfirm={handleMarkComplete}
          />
        )}
      </AnimatePresence>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active',        value: totalMeds,      color: 'bg-primary/10 text-primary',           icon: Pill },
          { label: 'Taken Today',   value: takenToday,     color: 'bg-success/10 text-success',           icon: Check },
          { label: 'Missed Today',  value: missedToday,    color: 'bg-destructive/10 text-destructive',   icon: X },
          { label: 'Completed',     value: completedTotal, color: 'bg-emerald-50 text-emerald-600',       icon: CheckCircle2 },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 sm:gap-4 rounded-xl border border-border bg-card p-3 sm:p-4 shadow-card">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold font-display text-foreground">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display text-foreground">Patient Adherence Trend</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 6 months · medication compliance</p>
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
            <AreaChart data={stats?.adherenceTrend ?? []}>
              <defs>
                <linearGradient id="adherenceMedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(174,62%,38%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(174,62%,38%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={ChartTooltipStyle} formatter={(v: any) => [`${v}%`, 'Adherence']} />
              <Area type="monotone" dataKey="rate" stroke="hsl(174,62%,38%)" strokeWidth={2} fill="url(#adherenceMedGrad)" dot={{ r: 3, fill: 'hsl(174,62%,38%)' }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display text-foreground">Avg Blood Sugar (mg/dL)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 7 days · across all patients</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 200]} tick={{ fontSize: 12, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={ChartTooltipStyle} formatter={(v: any) => [`${v} mg/dL`, 'Avg Blood Sugar']} />
              <Bar dataKey="avg" fill="hsl(205,80%,55%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Patient Medication List ── */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search patients..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <button
          onClick={() => setShowCompleted(v => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
            showCompleted
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'border-border text-muted-foreground hover:border-primary/30 hover:text-primary'
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          {showCompleted ? 'Hide Completed' : 'Show Completed'}
        </button>
        <p className="text-xs text-muted-foreground">{filtered.length} patients</p>
      </div>

      <div className="space-y-3">
        {filtered.map((patient, i) => {
          const allMeds  = patient.medications ?? [];
          const activeMeds    = allMeds.filter((m: any) => !m.completed);
          const completedMeds = allMeds.filter((m: any) => m.completed);
          const displayMeds   = showCompleted ? allMeds : activeMeds;
          const taken  = activeMeds.filter((m: any) => m.taken_today).length;
          const isOpen = expanded[patient.id];

          return (
            <motion.div key={patient.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-border bg-card shadow-card">

              {/* Patient row */}
              <button onClick={() => toggleExpand(patient.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                    {patient.name?.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.diabetes_type} · Adherence: {patient.adherence_rate ?? 0}%
                      {completedMeds.length > 0 && (
                        <span className="ml-1.5 text-emerald-600 font-medium">
                          · {completedMeds.length} completed
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 text-xs">
                    <span className="flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 font-medium">
                      <Check className="h-3 w-3" />{taken} taken
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
                      <X className="h-3 w-3" />{activeMeds.length - taken} missed
                    </span>
                  </div>
                  {/* Mobile: compact counts */}
                  <div className="flex sm:hidden items-center gap-1 text-xs">
                    <span className="rounded-full bg-success/10 text-success px-1.5 py-0.5 font-bold">{taken}✓</span>
                    <span className="rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 font-bold">{activeMeds.length - taken}✗</span>
                  </div>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded medications */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-visible"
                  >
                    <div className="px-5 pb-4 border-t border-border pt-3 space-y-2">
                      {displayMeds.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2">No medications to show.</p>
                      )}
                      {displayMeds.map((med: any) => {
                        const refillRaw = med.refill_date;
                        const refillDate = refillRaw ? new Date(refillRaw + (refillRaw.includes('T') ? '' : 'T00:00:00')) : null;
                        const today = new Date(); today.setHours(0, 0, 0, 0);
                        const daysUntilRefill = refillDate
                          ? Math.ceil((refillDate.getTime() - today.getTime()) / 86400000)
                          : null;

                        return (
                          <div key={med.id}
                            className={`flex items-center justify-between rounded-lg px-4 py-3 border text-sm transition-all ${
                              med.completed
                                ? 'border-emerald-200/60 bg-emerald-50/50 opacity-70'
                                : med.taken_today
                                ? 'border-success/20 bg-success/5'
                                : 'border-destructive/20 bg-destructive/5'
                            }`}>

                            {/* Left: status icon + details */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${
                                med.completed
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : med.taken_today
                                  ? 'bg-success/20 text-success'
                                  : 'bg-destructive/20 text-destructive'
                              }`}>
                                {med.completed
                                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                                  : med.taken_today
                                  ? <Check className="h-3.5 w-3.5" />
                                  : <X className="h-3.5 w-3.5" />}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-medium ${med.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {med.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {med.dosage} · {med.frequency}{med.time ? ` · ${med.time}` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Right: refill badge + actions */}
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                              {refillDate && !med.completed && (
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                  daysUntilRefill !== null && daysUntilRefill <= 0
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : daysUntilRefill !== null && daysUntilRefill <= 7
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : 'bg-muted text-muted-foreground border-border'
                                }`}>
                                  {daysUntilRefill !== null && daysUntilRefill <= 0
                                    ? 'Overdue'
                                    : daysUntilRefill !== null && daysUntilRefill <= 7
                                    ? `In ${daysUntilRefill}d`
                                    : refillDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}

                              <MedActions
                                med={med}
                                onRefill={m => setRefillModal(m)}
                                onComplete={m => setCompleteModal(m)}
                                onDelete={handleDelete}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-muted-foreground text-sm">No patients found.</div>
        )}
      </div>
    </Layout>
  );
};

export default Medications;