import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { authApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Activity, LogIn, LogOut, User, Pill, CalendarDays, Settings,
  Shield, Loader2, RefreshCcw, Search, ChevronDown,
  UserPlus, Trash2, Edit3, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';

interface LogEntry {
  id: number;
  user_name: string;
  user_role: string;
  action: string;
  target: string;
  description: string;
  created_at: string;
  ip_address?: string;
}

// Map action keywords to icons and colors
const actionMeta = (action: string): { icon: any; color: string; bg: string } => {
  const a = action.toLowerCase();
  if (a.includes('login'))    return { icon: LogIn,        color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (a.includes('logout'))   return { icon: LogOut,       color: 'text-gray-500',    bg: 'bg-gray-100'   };
  if (a.includes('register') || a.includes('create') || a.includes('add'))
                              return { icon: UserPlus,     color: 'text-sky-600',     bg: 'bg-sky-50'     };
  if (a.includes('delete') || a.includes('remove'))
                              return { icon: Trash2,       color: 'text-rose-500',    bg: 'bg-rose-50'    };
  if (a.includes('update') || a.includes('edit') || a.includes('change'))
                              return { icon: Edit3,        color: 'text-amber-600',   bg: 'bg-amber-50'   };
  if (a.includes('appoint'))  return { icon: CalendarDays, color: 'text-primary',     bg: 'bg-primary/8'  };
  if (a.includes('med') || a.includes('prescri'))
                              return { icon: Pill,         color: 'text-indigo-600',  bg: 'bg-indigo-50'  };
  if (a.includes('password')) return { icon: Shield,       color: 'text-purple-600',  bg: 'bg-purple-50'  };
  if (a.includes('complete')) return { icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (a.includes('cancel'))   return { icon: XCircle,      color: 'text-rose-500',    bg: 'bg-rose-50'    };
  if (a.includes('setting') || a.includes('config'))
                              return { icon: Settings,     color: 'text-gray-600',    bg: 'bg-gray-100'   };
  return                             { icon: Activity,     color: 'text-primary',     bg: 'bg-primary/8'  };
};

const roleBadge = (role: string) => {
  const map: Record<string, string> = {
    admin:   'bg-purple-50 text-purple-600 border-purple-200',
    doctor:  'bg-sky-50 text-sky-600 border-sky-200',
    patient: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };
  return map[role] ?? 'bg-gray-100 text-gray-500 border-gray-200';
};

const timeAgo = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── Skeleton loader ────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="flex items-start gap-4 p-4 animate-pulse">
    <div className="h-9 w-9 rounded-xl bg-muted flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-1/3 rounded bg-muted" />
      <div className="h-2.5 w-2/3 rounded bg-muted" />
    </div>
    <div className="h-2.5 w-12 rounded bg-muted" />
  </div>
);

const ActivityLog = () => {
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'doctor' | 'patient'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await authApi.getActivityLog();
      setLogs(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load activity log');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(l => {
    const matchSearch = [l.user_name, l.action, l.description, l.target]
      .join(' ').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || l.user_role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Group by day
  const groups: Record<string, LogEntry[]> = {};
  paginated.forEach(l => {
    const day = new Date(l.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(l);
  });

  const stats = {
    total:   logs.length,
    logins:  logs.filter(l => l.action.toLowerCase().includes('login')).length,
    creates: logs.filter(l => ['create', 'add', 'register', 'prescribe', 'schedule'].some(k => l.action.toLowerCase().includes(k))).length,
    deletes: logs.filter(l => l.action.toLowerCase().includes('delete')).length,
  };

  return (
    <Layout title="Activity Log" subtitle="Complete audit trail of all system actions">

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Events',    value: stats.total,   color: 'bg-primary/8 text-primary'      },
          { label: 'Logins',          value: stats.logins,  color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Records Created', value: stats.creates, color: 'bg-sky-50 text-sky-700'         },
          { label: 'Deletions',       value: stats.deletes, color: 'bg-rose-50 text-rose-600'       },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-4 ${s.color}`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-semibold opacity-70 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Filters row ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search actions, users…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
        </div>

        {/* Role filter pills */}
        <div className="flex gap-1.5">
          {(['all', 'admin', 'doctor', 'patient'] as const).map(r => (
            <button key={r} onClick={() => { setRoleFilter(r); setPage(1); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                roleFilter === r
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}>
              {r}
            </button>
          ))}
        </div>

        <button onClick={() => fetchLogs(true)} disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
          <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Log list ── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No activity found</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Try adjusting your search or filters</p>
          </div>
        ) : (
          Object.entries(groups).map(([day, entries]) => (
            <div key={day}>
              {/* Day header */}
              <div className="px-5 py-2.5 bg-muted/30 border-b border-border/40">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{day}</p>
              </div>
              {/* Entries */}
              <div className="divide-y divide-border/40">
                {entries.map((log, i) => {
                  const meta = actionMeta(log.action);
                  const Icon = meta.icon;
                  const isExpanded = expanded === log.id;

                  return (
                    <motion.div key={log.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="group">
                      <button
                        className="w-full flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                      >
                        {/* Icon */}
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${meta.bg}`}>
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-bold text-foreground">{log.action}</p>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${roleBadge(log.user_role)}`}>
                              {log.user_role}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            <span className="font-semibold text-foreground/70">{log.user_name}</span>
                            {' · '}{log.description}
                          </p>
                        </div>

                        {/* Time + expand */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                            {timeAgo(log.created_at)}
                          </span>
                          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mx-5 mb-4 rounded-xl bg-muted/40 border border-border/60 p-4 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground font-semibold mb-0.5">Target</p>
                                <p className="font-bold text-foreground">{log.target || '—'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground font-semibold mb-0.5">Timestamp</p>
                                <p className="font-bold text-foreground">
                                  {new Date(log.created_at).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                    hour: 'numeric', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              {log.ip_address && (
                                <div>
                                  <p className="text-muted-foreground font-semibold mb-0.5">IP Address</p>
                                  <p className="font-mono font-bold text-foreground">{log.ip_address}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-muted-foreground font-semibold mb-0.5">User</p>
                                <p className="font-bold text-foreground">{log.user_name}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-col items-center gap-3 mt-5">
          {/* Page info */}
          <p className="text-xs text-muted-foreground">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events
          </p>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ‹
              </button>

              {/* Page numbers with ellipsis */}
              {(() => {
                const pages: (number | '…')[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (page > 3) pages.push('…');
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                  if (page < totalPages - 2) pages.push('…');
                  pages.push(totalPages);
                }
                return pages.map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                        page === p
                          ? 'bg-primary text-white shadow-md shadow-primary/25'
                          : 'border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/30'
                      }`}
                    >
                      {p}
                    </button>
                  )
                );
              })()}

              {/* Next */}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default ActivityLog;