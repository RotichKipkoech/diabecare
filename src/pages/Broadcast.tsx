import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { patientsApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Send, Users, MessageSquare, Smartphone, Bell,
  CheckCircle2, Loader2, Search, X, ChevronDown,
  Filter, User, Stethoscope, Shield,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Channel = 'in_app' | 'sms';

interface Recipient { name: string; role: string; }

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-amber-50 text-amber-700',
  doctor:  'bg-primary/10 text-primary',
  patient: 'bg-emerald-50 text-emerald-700',
};

const RoleIcon = ({ role }: { role: string }) => {
  if (role === 'admin')   return <Shield className="h-3 w-3" />;
  if (role === 'doctor')  return <Stethoscope className="h-3 w-3" />;
  return <User className="h-3 w-3" />;
};

const Broadcast = () => {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  // ── Form state ───────────────────────────────────────────────────
  const [title, setTitle]         = useState('');
  const [message, setMessage]     = useState('');
  const [channels, setChannels]   = useState<Channel[]>(['in_app']);

  // ── Filter state (admin) ─────────────────────────────────────────
  const [role, setRole]               = useState('all');
  const [healthStatus, setHealthStatus] = useState('');
  const [diabetesType, setDiabetesType] = useState('');

  // ── Individual picker ────────────────────────────────────────────
  const [useIndividual, setUseIndividual] = useState(false);
  const [allUsers, setAllUsers]           = useState<any[]>([]);
  const [selectedIds, setSelectedIds]     = useState<number[]>([]);
  const [userSearch, setUserSearch]       = useState('');

  // ── Preview & send state ─────────────────────────────────────────
  const [preview, setPreview]       = useState<Recipient[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState<any>(null);

  // Load all users/patients for individual picker
  useEffect(() => {
    if (isAdmin) {
      fetch(`${API_URL}/auth/users`, { headers: authHeaders() })
        .then(r => r.json()).then(setAllUsers).catch(() => {});
    } else {
      patientsApi.list().then(setAllUsers).catch(() => {});
    }
  }, [isAdmin]);

  const buildPayload = () => {
    const base: any = { title, message, channels };
    if (useIndividual && selectedIds.length > 0) {
      base.user_ids = selectedIds;
    } else if (isAdmin) {
      base.role = role;
      if (healthStatus) base.health_status = healthStatus;
      if (diabetesType) base.diabetes_type = diabetesType;
    }
    return base;
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await fetch(`${API_URL}/broadcast/preview`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.recipients);
    } catch (e: any) {
      toast.error(e.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (channels.length === 0) {
      toast.error('Select at least one delivery channel');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/broadcast`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      toast.success(`Broadcast sent to ${data.recipients} recipient${data.recipients !== 1 ? 's' : ''}!`);
      // Reset form
      setTitle(''); setMessage(''); setPreview(null);
      setSelectedIds([]); setUseIndividual(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const toggleChannel = (ch: Channel) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  const toggleUser = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const filteredUsers = allUsers.filter(u => {
    const name = (u.full_name || u.name || '').toLowerCase();
    return name.includes(userSearch.toLowerCase());
  });

  return (
    <Layout title="Broadcast Message" subtitle={isAdmin ? 'Send messages to users by role, status, or individually' : 'Send messages to your patients'}>
      <div className="max-w-3xl grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: Compose form ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Title */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground">Message</h3>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. System Maintenance Notice"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                placeholder="Type your message here..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all resize-none" />
              <p className="text-xs text-muted-foreground mt-1">{message.length} characters</p>
            </div>
          </div>

          {/* Delivery channels */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-3">Delivery Channel</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'in_app' as Channel, label: 'In-App', sub: 'Notification bell', icon: Bell, color: 'border-primary/30 bg-primary/5 text-primary' },
                { id: 'sms'    as Channel, label: 'SMS',    sub: 'Text message',      icon: Smartphone, color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
              ]).map(ch => {
                const active = channels.includes(ch.id);
                return (
                  <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                      active ? ch.color + ' shadow-sm' : 'border-border bg-background text-muted-foreground hover:border-border/80'
                    }`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${active ? 'bg-current/10' : 'bg-muted'}`}>
                      <ch.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{ch.label}</p>
                      <p className="text-[11px] opacity-70">{ch.sub}</p>
                    </div>
                    {active && <CheckCircle2 className="h-4 w-4 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recipients */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Recipients</h3>
              <button onClick={() => { setUseIndividual(!useIndividual); setSelectedIds([]); setPreview(null); }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  useIndividual ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}>
                <User className="h-3.5 w-3.5" />
                {useIndividual ? 'Individual' : 'Filter'}
              </button>
            </div>

            {!useIndividual ? (
              <div className="space-y-3">
                {isAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Role</label>
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'patient', 'doctor', 'admin'] as const).map(r => (
                        <button key={r} onClick={() => { setRole(r); setPreview(null); }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                            role === r ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}>
                          {r === 'all' ? 'Everyone' : r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(isAdmin ? role === 'all' || role === 'patient' : true) && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Health Status</label>
                      <div className="flex flex-wrap gap-2">
                        {(['', 'stable', 'warning', 'critical'] as const).map(s => (
                          <button key={s} onClick={() => { setHealthStatus(s); setPreview(null); }}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                              healthStatus === s ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}>
                            {s === '' ? 'Any Status' : s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Diabetes Type</label>
                      <div className="flex flex-wrap gap-2">
                        {(['', 'Type 1', 'Type 2', 'Gestational'] as const).map(t => (
                          <button key={t} onClick={() => { setDiabetesType(t); setPreview(null); }}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                              diabetesType === t ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}>
                            {t === '' ? 'Any Type' : t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
                  {filteredUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                  ) : filteredUsers.map((u: any) => {
                    const id = u.id;
                    const name = u.full_name || u.name;
                    const uRole = u.role || 'patient';
                    const selected = selectedIds.includes(id);
                    return (
                      <button key={id} onClick={() => { toggleUser(id); setPreview(null); }}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          selected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                        }`}>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 text-[10px] font-bold ${ROLE_COLORS[uRole] || 'bg-muted text-muted-foreground'}`}>
                          {name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">{uRole}</p>
                        </div>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {selectedIds.length > 0 && (
                  <p className="text-xs text-primary font-semibold">{selectedIds.length} selected</p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={handlePreview} disabled={previewing}
              className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
              Preview
            </button>
            <motion.button onClick={handleSend} disabled={sending || !title || !message || channels.length === 0}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl gradient-primary px-5 py-2.5 text-sm font-black text-white shadow-md hover:opacity-90 transition-all disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Sending…' : 'Send Broadcast'}
            </motion.button>
          </div>
        </div>

        {/* ── RIGHT: Preview + Result ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Result card */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-700">Broadcast Sent!</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Recipients', value: result.recipients },
                    { label: 'In-App',     value: result.sent_app },
                    { label: 'SMS',        value: result.sent_sms },
                    { label: 'Failed',     value: result.failed },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-white/70 px-3 py-2 text-center">
                      <p className="text-lg font-black text-emerald-700">{s.value}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">{s.label}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setResult(null)} className="mt-3 text-xs text-emerald-600 hover:underline w-full text-center">Dismiss</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Recipients Preview
              </h3>
              {preview && (
                <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
                  {preview.length}
                </span>
              )}
            </div>

            {!preview ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Filter className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">Click Preview to see who will receive this message</p>
              </div>
            ) : preview.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No recipients match the selected filters</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {preview.map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-muted/30">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black flex-shrink-0 ${ROLE_COLORS[r.role] || 'bg-muted text-muted-foreground'}`}>
                      <RoleIcon role={r.role} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{r.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Tips</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2"><Bell className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" /><span>In-app messages appear in the notification bell instantly</span></li>
              <li className="flex gap-2"><Smartphone className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /><span>SMS only sends to users with a phone number on their profile</span></li>
              <li className="flex gap-2"><Filter className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" /><span>Use Preview to confirm recipients before sending</span></li>
            </ul>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Broadcast;