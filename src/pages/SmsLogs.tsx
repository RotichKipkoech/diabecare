import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { smsLogsApi } from '@/services/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  MessageSquare, CheckCircle2, XCircle, Ban, Search,
  Trash2, RefreshCcw, Wifi, Loader2, BarChart2, AlertCircle, RotateCcw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

type AnyRecord = Record<string, unknown>;

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-bold text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const SmsLogs = () => {
  const [stats, setStats]         = useState<AnyRecord | null>(null);
  const [logs, setLogs]           = useState<AnyRecord[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [retrying, setRetrying]   = useState<Record<number, boolean>>({});
  const [filter, setFilter]       = useState('');
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const PER_PAGE = 20;

  const fetchStats = useCallback(async () => {
    try {
      const data = await smsLogsApi.getStats() as AnyRecord;
      setStats(data);
    } catch { /* silent */ }
  }, []);

  const fetchLogs = useCallback(async (p = 1, status = '', q = '') => {
    setRefreshing(true);
    try {
      const data = await smsLogsApi.getLogs({
        page: p, per_page: PER_PAGE,
        status: status || undefined,
        search: q || undefined,
      }) as AnyRecord;
      setLogs((data.logs as AnyRecord[]) ?? []);
      setTotal((data.total as number) ?? 0);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load SMS logs');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchLogs()]);
  }, [fetchStats, fetchLogs]);

  const handleClear = async () => {
    if (!confirm('Clear all SMS logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      await smsLogsApi.clearLogs();
      setLogs([]); setTotal(0);
      setStats(s => s ? { ...s, total: 0, sent: 0, failed: 0, disabled: 0, success_rate: 0 } : s);
      toast.success('SMS logs cleared');
    } catch (e: any) {
      toast.error(e.message || 'Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  const handleRetry = async (logId: number) => {
    setRetrying(prev => ({ ...prev, [logId]: true }));
    try {
      const result = await smsLogsApi.retrySms(logId) as AnyRecord;
      if ((result.status as string) === 'sent') {
        toast.success('SMS resent successfully');
        // Remove from list immediately if filtering by failed/disabled
        // so it disappears without waiting for a full refresh
        if (filter === 'failed' || filter === 'disabled') {
          setLogs(prev => prev.filter(l => (l.id as number) !== logId));
          setTotal(prev => Math.max(0, prev - 1));
        } else {
          // In "All" view — update status in place to 'sent'
          setLogs(prev => prev.map(l =>
            (l.id as number) === logId ? { ...l, status: 'sent', error: '', failure_reason: '' } : l
          ));
        }
        await fetchStats();
      } else {
        toast.error('Retry attempted but failed again — check the failure reason');
        await fetchLogs(page, filter, search);
      }
    } catch (e: any) {
      toast.error(e.message || 'Retry failed');
    } finally {
      setRetrying(prev => ({ ...prev, [logId]: false }));
    }
  };

  const handleSearch = (val: string) => { setSearch(val); setPage(1); fetchLogs(1, filter, val); };
  const handleFilter = (val: string) => { setFilter(val); setPage(1); fetchLogs(1, val, search); };
  const totalPages   = Math.max(1, Math.ceil(total / PER_PAGE));
  const catColors    = ['hsl(174,62%,38%)', 'hsl(205,80%,55%)', 'hsl(262,70%,60%)', 'hsl(38,92%,55%)', 'hsl(350,80%,60%)'];

  if (loading) {
    return (
      <Layout title="SMS Logs" subtitle="All outbound SMS messages">
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="SMS Logs" subtitle="Track all outbound SMS messages to patients and doctors">

      {/* ── Stat cards ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {([
            { label: 'Total',        value: stats.total        as number ?? 0,  icon: MessageSquare, color: 'bg-primary/10 text-primary' },
            { label: 'Delivered',    value: stats.sent         as number ?? 0,  icon: CheckCircle2,  color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Failed',       value: stats.failed       as number ?? 0,  icon: XCircle,       color: 'bg-red-50 text-red-500' },
            { label: 'Success Rate', value: `${stats.success_rate as number ?? 0}%`, icon: Wifi,    color: 'bg-teal-50 text-teal-600' },
          ] as const).map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-black font-display text-foreground">{s.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Charts ── */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Last 7 Days</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={(stats.daily as AnyRecord[]) ?? []} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })}
                  tick={{ fontSize: 11, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="SMS" fill="hsl(174,62%,38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">By Category</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={(stats.by_category as AnyRecord[]) ?? []} barSize={18} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(200,20%,90%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="category" width={130}
                  tickFormatter={c => String(c).replace(/_/g, ' ')}
                  tick={{ fontSize: 9, fill: 'hsl(210,12%,50%)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="SMS" radius={[0, 4, 4, 0]}>
                  {((stats.by_category as AnyRecord[]) ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={catColors[i % catColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* ── Log table ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">Log</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{total} total records</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search name, phone..." value={search}
                onChange={e => handleSearch(e.target.value)}
                className="h-8 w-48 rounded-xl border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/25" />
            </div>
            <div className="flex gap-1">
              {(['', 'sent', 'failed', 'disabled'] as const).map(f => (
                <button key={f} onClick={() => handleFilter(f)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold capitalize transition-all ${
                    filter === f ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}>
                  {f === '' ? 'All' : f}
                </button>
              ))}
            </div>
            <button onClick={() => { fetchStats(); fetchLogs(page, filter, search); }} disabled={refreshing}
              className="rounded-xl p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleClear} disabled={clearing || total === 0}
              className="rounded-xl p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40" title="Clear all logs">
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {refreshing && logs.length === 0 ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No SMS records found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Recipient</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Phone</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Message</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id as number} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground text-sm leading-tight">{(log.recipient_name as string) || '—'}</p>
                      <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                        log.recipient_role === 'doctor' ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {(log.recipient_role as string) || 'patient'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.recipient as string}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize whitespace-nowrap">
                        {(log.category as string)?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="truncate text-xs text-muted-foreground" title={log.message as string}>{log.message as string}</p>
                      {log.status === 'failed' && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-red-50 border border-red-100 px-2 py-1.5">
                          <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-red-600">Failure Reason</p>
                            <p className="text-[10px] text-red-500 break-words">
                              {(log.failure_reason as string) || (log.error as string) || 'Unknown error'}
                            </p>
                          </div>
                        </div>
                      )}
                      {log.status === 'disabled' && (
                        <p className="text-[10px] text-gray-400 mt-1 italic">SMS disabled — not sent</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        log.status === 'sent'   ? 'bg-emerald-50 text-emerald-600' :
                        log.status === 'failed' ? 'bg-red-50 text-red-500' :
                                                  'bg-gray-100 text-gray-500'
                      }`}>
                        {log.status === 'sent'   ? <CheckCircle2 className="h-3 w-3" /> :
                         log.status === 'failed' ? <XCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                        {log.status as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at as string).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(log.status === 'failed' || log.status === 'disabled') && (
                        <button
                          onClick={() => handleRetry(log.id as number)}
                          disabled={retrying[log.id as number]}
                          title="Retry sending this SMS"
                          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {retrying[log.id as number]
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <RotateCcw className="h-3 w-3" />
                          }
                          {retrying[log.id as number] ? 'Sending…' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PER_PAGE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min((page - 1) * PER_PAGE + 1, total)}–{Math.min(page * PER_PAGE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); fetchLogs(p, filter, search); }}
                className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-40 transition-all">‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page + i - 2;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => { setPage(p); fetchLogs(p, filter, search); }}
                    className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${page === p ? 'bg-primary text-white shadow-md' : 'border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/30'}`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); fetchLogs(p, filter, search); }}
                className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-40 transition-all">›</button>
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
};

export default SmsLogs;