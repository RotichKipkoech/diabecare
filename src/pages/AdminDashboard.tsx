import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '@/components/Layout';
import StatCard from '@/components/StatCard';
import { authApi, statsApi } from '@/services/api';
import { Users, UserCheck, AlertTriangle, Stethoscope, ShieldCheck, Settings2, Loader2, Wrench, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMaintenance } from '@/contexts/MaintenanceContext';

// ── Reusable chart tooltip ────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-bold text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const CHART_COLORS = {
  teal:    'hsl(174, 62%, 38%)',
  blue:    'hsl(205, 80%, 55%)',
  amber:   'hsl(38, 92%, 55%)',
  rose:    'hsl(350, 80%, 60%)',
  purple:  'hsl(262, 70%, 60%)',
  emerald: 'hsl(158, 64%, 42%)',
};

const POLL_INTERVAL = 30_000; // 30 seconds

const LiveBadge = ({ lastUpdated, isLive }: { lastUpdated: Date | null; isLive: boolean }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
    {isLive ? <Wifi className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3 text-red-400" />}
    {lastUpdated
      ? <>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
      : 'Waiting...'}
    {isLive && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { activeCount } = useMaintenance();
  const mounted = useRef(false);
  const [stats, setStats]             = useState<any>(null);
  const [users, setUsers]             = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive]           = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // Silent poll — only refreshes stats numbers, never re-animates charts/cards
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

  // Full load — runs once on mount only
  const fetchAll = useCallback(async () => {
    try {
      const [sData, uData] = await Promise.all([
        statsApi.dashboard(),
        authApi.listUsers(),
      ]);
      setStats(sData);
      setUsers(uData);
      setLastUpdated(new Date());
      setIsLive(true);
    } catch (e: any) {
      setIsLive(false);
      toast.error(e.message);
    } finally {
      setLoading(false);
      mounted.current = true;
    }
  }, []);


  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(() => refreshStats(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAll, refreshStats]);

  if (loading) {
    return <Layout title="Admin Dashboard"><div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></Layout>;
  }

  // ── Derived counts ─────────────────────────────────────────────
  const patientCount = users.filter(u => u.role === 'patient').length;
  const doctorCount  = users.filter(u => u.role === 'doctor').length;
  const adminCount   = users.filter(u => u.role === 'admin').length;
  const recentUsers  = users.slice(0, 5);

  // ── Chart datasets — all sourced from statsApi.dashboard() ──────
  const roleDistribution = [
    { name: 'Patients', value: patientCount, color: CHART_COLORS.teal },
    { name: 'Doctors',  value: doctorCount,  color: CHART_COLORS.blue },
    { name: 'Admins',   value: adminCount,   color: CHART_COLORS.amber },
  ];

  const diabetesColors = [CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.purple];
  const diabetesDistribution = (stats?.diabetesDistribution ?? []).map(
    (d: any, i: number) => ({ ...d, color: diabetesColors[i % diabetesColors.length] })
  );

  const patientStatusData = (stats?.patientStatusOverview ?? []).map((d: any) => ({
    ...d,
    fill: d.name === 'Stable' ? CHART_COLORS.emerald
        : d.name === 'Warning' ? CHART_COLORS.amber
        : CHART_COLORS.rose,
  }));

  const totalAdherence = stats?.avgAdherence ?? 0;
  const adherencePie = (stats?.medicationAdherence ?? []).map((d: any) => ({
    ...d,
    color: d.name === 'Adherent' ? CHART_COLORS.teal : CHART_COLORS.rose,
  }));

  const apptByType = stats?.appointmentsByType ?? [];

  const apptStatusColors: Record<string, string> = {
    Scheduled: CHART_COLORS.blue,
    Completed: CHART_COLORS.emerald,
    Cancelled: CHART_COLORS.rose,
    Requested: CHART_COLORS.amber,
    Missed:    CHART_COLORS.purple,
  };
  const apptStatusData = (stats?.appointmentStatusOverview ?? []).map((d: any) => ({
    ...d,
    color: apptStatusColors[d.name] ?? CHART_COLORS.teal,
  }));

  const ChartCard = ({ title, delay, children }: { title: string; delay: number; children: React.ReactNode }) => (
    <motion.div
      initial={!mounted.current ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: !mounted.current ? delay : 0 }}
      className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card">
      <h3 className="text-sm font-semibold font-display text-foreground mb-4">{title}</h3>
      {children}
    </motion.div>
  );

  const PieLegend = ({ data }: { data: { name: string; value: number; color: string }[] }) => (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
      {data.map(d => (
        <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
          {d.name}: <span className="font-semibold text-foreground">{d.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Layout title="Admin Dashboard" subtitle="System overview and user management">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Users"    value={users.length}               icon={Users}         trend={`${doctorCount} doctors`} trendUp variant="primary" delay={0} />
        <StatCard title="Doctors"        value={doctorCount}                icon={Stethoscope}   delay={0.05} />
        <StatCard title="Patients"       value={patientCount}               icon={UserCheck}     delay={0.1} />
        <StatCard title="Critical Alerts" value={stats?.criticalPatients ?? 0} icon={AlertTriangle} trend="Needs attention" variant="danger" delay={0.15} />
      </div>

      {/* ── Quick-action buttons ── */}
      <motion.div initial={!mounted.current ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: !mounted.current ? 0.18 : 0 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <button onClick={() => navigate('/users')} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary"><Users className="h-5 w-5 text-primary-foreground" /></div>
          <div><p className="text-sm font-semibold text-foreground">Manage Users</p><p className="text-xs text-muted-foreground hidden sm:block">Create, update or delete accounts</p></div>
        </button>
        <button onClick={() => navigate('/dashboard-features')} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10"><Settings2 className="h-5 w-5 text-info" /></div>
          <div><p className="text-sm font-semibold text-foreground">Dashboard Features</p><p className="text-xs text-muted-foreground hidden sm:block">Manage Doctor & Patient dashboards</p></div>
        </button>
        <button onClick={() => navigate('/settings')} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card hover:border-amber-400/40 hover:bg-amber-500/5 transition-colors text-left">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <Wrench className="h-5 w-5 text-amber-500" />
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">{activeCount}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Maintenance</p>
            <p className="text-xs text-muted-foreground">{activeCount > 0 ? `${activeCount} page${activeCount > 1 ? 's' : ''} under maintenance` : 'No active maintenance'}</p>
          </div>
        </button>
      </motion.div>

      {/* ── Section header ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">Analytics</span>
        <div className="flex-1 h-px bg-border/60" />
        <div className="flex items-center gap-2">
          <LiveBadge lastUpdated={lastUpdated} isLive={isLive} />
          <button onClick={() => refreshStats(false)} disabled={refreshing}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Analytics: single unified 3-column grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

        <ChartCard title="User Role Distribution" delay={0.2}>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={4}>
                {roleDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <PieLegend data={roleDistribution} />
        </ChartCard>

        <ChartCard title="System-wide Adherence Trend" delay={0.25}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={stats?.adherenceTrend ?? []}>
              <defs>
                <linearGradient id="adherenceGradAdmin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.teal} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="rate" name="Adherence %" stroke={CHART_COLORS.teal} strokeWidth={2} fill="url(#adherenceGradAdmin)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Diabetes Type Distribution" delay={0.3}>
          {diabetesDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">No patient data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={diabetesDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={4}>
                    {diabetesDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <PieLegend data={diabetesDistribution} />
            </>
          )}
        </ChartCard>

        <ChartCard title="Patient Status Overview" delay={0.35}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={patientStatusData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Patients" radius={[6, 6, 0, 0]}>
                {patientStatusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Overall Medication Adherence" delay={0.4}>
          <div className="flex flex-col items-center gap-3">
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={adherencePie} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" paddingAngle={4} startAngle={90} endAngle={-270}>
                  {adherencePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full">
              <p className="text-2xl font-black text-foreground text-center">{totalAdherence}%</p>
              <p className="text-xs text-muted-foreground text-center mt-0.5">Avg across {stats?.totalPatients ?? 0} patients</p>
              <div className="mt-2 space-y-1">
                {adherencePie.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="ml-auto font-semibold text-foreground">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Appointments by Type" delay={0.45}>
          {apptByType.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">No appointments yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={apptByType} barSize={28} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 10, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} width={65} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Appointments" fill={CHART_COLORS.blue} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Appointment Status Overview" delay={0.5}>
          {apptStatusData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">No appointments yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={apptStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={4}>
                    {apptStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <PieLegend data={apptStatusData} />
            </>
          )}
        </ChartCard>

        {/* Placeholder */}
        <motion.div initial={!mounted.current ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: !mounted.current ? 0.55 : 0 }}
          className="rounded-xl border border-border/50 border-dashed bg-muted/20 p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-2">
          <Settings2 className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground/50">More analytics coming soon</p>
          <p className="text-xs text-muted-foreground/35">Blood sugar trends, refill rates & more</p>
        </motion.div>

      </div>

      {/* ── Recently Added Users table ── */}
      <motion.div initial={!mounted.current ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: !mounted.current ? 0.6 : 0 }}
        className="rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold font-display text-foreground">Recently Added Users</h3>
          <button onClick={() => navigate('/users')} className="text-xs font-medium text-primary hover:underline">Manage All Users →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="hidden sm:table-cell px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="hidden md:table-cell px-4 py-3 text-xs font-medium text-muted-foreground">Date Added</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground max-w-[120px] truncate">{u.full_name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground truncate max-w-[160px]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                      u.role === 'admin' ? 'bg-warning/10 text-warning' : u.role === 'doctor' ? 'bg-primary/10 text-primary' : 'bg-info/10 text-info'
                    }`}>
                      {u.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> : u.role === 'doctor' ? <Stethoscope className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

    </Layout>
  );
};

export default AdminDashboard;