import { useState, useRef, useEffect } from "react";
import {
  Bell, X, Pill, CalendarDays, AlertTriangle,
  CheckCircle2, RefreshCcw, Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { notificationsApi } from "@/services/api";

interface Notification {
  id: number;
  type: "medication" | "appointment" | "alert" | "info";
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

interface NotificationPanelProps {
  role?: string;
}

const iconMap: Record<string, any> = {
  medication: Pill,
  appointment: CalendarDays,
  alert: AlertTriangle,
  info: CheckCircle2,
};

const colorMap: Record<string, string> = {
  medication: "text-primary bg-primary/10",
  appointment: "text-blue-500 bg-blue-500/10",
  alert: "text-destructive bg-destructive/10",
  info: "text-emerald-500 bg-emerald-500/10",
};

const dotMap: Record<string, string> = {
  medication: "bg-primary",
  appointment: "bg-blue-500",
  alert: "bg-destructive",
  info: "bg-emerald-500",
};

function timeAgo(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const secs = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (secs < 60) return 'Just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ role = "patient" }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await notificationsApi.list();
      setNotifications(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    try {
      await notificationsApi.markRead(-1);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
    }
  };

  const markSingleRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
    }
  };

  const dismiss = async (id: number) => {
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
    }
  };

  const dismissAllRead = async () => {
    const readOnes = notifications.filter((n) => n.read);
    await Promise.all(readOnes.map((n) => notificationsApi.delete(n.id).catch(() => {})));
    setNotifications((prev) => prev.filter((n) => !n.read));
  };

  const displayed = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  // Refill and completion summary strips
  const refillNotifs = notifications.filter(
    (n) => !n.read && n.type === 'medication' && n.title.toLowerCase().includes('refill')
  );
  const completedNotifs = notifications.filter(
    (n) => !n.read && n.title.toLowerCase().includes('completed')
  );

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetchNotifications(true); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-[calc(100vw-1rem)] sm:w-96 max-w-[24rem] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-foreground" />
                <span className="text-sm font-bold text-foreground">Notifications</span>
                {unread > 0 && (
                  <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchNotifications(true)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                  title="Refresh"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-primary font-semibold hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 bg-muted/20">
              {(['all', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all capitalize ${
                    filter === f
                      ? 'bg-card border border-border text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                  {f === 'unread' && unread > 0 && (
                    <span className="ml-1 rounded-full bg-destructive text-white text-[9px] px-1">{unread}</span>
                  )}
                </button>
              ))}
              {notifications.some(n => n.read) && (
                <button
                  onClick={dismissAllRead}
                  className="ml-auto text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear read
                </button>
              )}
            </div>

            {/* ── Refill summary strip ── */}
            {refillNotifs.length > 0 && (
              <div className="mx-3 mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Pill className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-amber-700">
                    {refillNotifs.length} Refill {refillNotifs.length === 1 ? 'Update' : 'Updates'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {refillNotifs.slice(0, 3).map(n => (
                    <p key={n.id} className="text-[11px] text-amber-700 leading-snug line-clamp-2">
                      · {n.message}
                    </p>
                  ))}
                  {refillNotifs.length > 3 && (
                    <p className="text-[11px] text-amber-600 font-medium">+{refillNotifs.length - 3} more</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Completion summary strip ── */}
            {completedNotifs.length > 0 && (
              <div className="mx-3 mt-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-700">
                    {completedNotifs.length} Medication{completedNotifs.length > 1 ? 's' : ''} Completed
                  </span>
                </div>
                <div className="space-y-0.5">
                  {completedNotifs.slice(0, 3).map(n => (
                    <p key={n.id} className="text-[11px] text-emerald-700 leading-snug line-clamp-2">
                      · {n.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Notification list */}
            <div className="max-h-[50vh] sm:max-h-72 overflow-y-auto divide-y divide-border/50 mt-2">
              {loading && displayed.length === 0 ? (
                <div className="flex justify-center py-8">
                  <RefreshCcw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-400" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs mt-0.5 opacity-70">
                    No {filter === 'unread' ? 'unread ' : ''}notifications
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {displayed.map((n) => {
                    const Icon = iconMap[n.type] ?? Bell;
                    const colors = colorMap[n.type] ?? colorMap.info;
                    const dot = dotMap[n.type] ?? dotMap.info;
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8, height: 0, paddingTop: 0, paddingBottom: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30 ${
                          n.read ? 'opacity-50' : ''
                        }`}
                        onClick={() => !n.read && markSingleRead(n.id)}
                      >
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${colors}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!n.read && (
                              <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                            )}
                            <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-3 sm:line-clamp-2">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                            <p className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                          className="shrink-0 mt-0.5 rounded-lg p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-border/50 px-4 py-2 bg-muted/10">
                <p className="text-[10px] text-center text-muted-foreground">
                  {notifications.length} total · {unread} unread · refreshes every 30s
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationPanel;