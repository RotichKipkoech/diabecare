import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, CheckCircle2, XCircle, Loader2,
  ShieldAlert, Info, Lock, Eye, EyeOff,
  Smartphone, Zap, Shield, Wrench, ToggleLeft, ToggleRight, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import { useMaintenance, MAINTAINABLE_PAGES } from '@/contexts/MaintenanceContext';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const smsApi = {
  status: () => request<{ sms_enabled: boolean }>("/sms/status"),
  toggle: (enabled: boolean) =>
    request<{ sms_enabled: boolean; message: string }>("/sms/toggle", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  test: (phone: string) =>
    request<{ sent: boolean; sms_enabled: boolean }>("/sms/test", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
};


// ─── Password Strength ────────────────────────────────────────────────────────
const PasswordStrength = ({ password }: { password: string }) => {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special character', pass: /[^a-zA-Z0-9]/.test(password) },
  ];
  const strength = checks.filter(c => c.pass).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < strength ? colors[strength - 1] : 'bg-muted'}`} />
          ))}
        </div>
        <span className={`text-[11px] font-bold tabular-nums ${
          strength >= 3 ? 'text-emerald-500' : strength === 2 ? 'text-yellow-500' : 'text-red-400'
        }`}>
          {strength > 0 ? labels[strength - 1] : 'Too weak'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map(({ label, pass }) => (
          <div key={label} className={`flex items-center gap-1.5 text-[11px] ${pass ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${pass ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
            {label}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ─── Change Password Card ─────────────────────────────────────────────────────
const ChangePasswordCard = () => {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPass !== form.confirm) { toast.error('New passwords do not match'); return; }
    if (form.newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await authApi.changePassword({ current_password: form.current, new_password: form.newPass });
      setSuccess(true);
      setForm({ current: '', newPass: '', confirm: '' });
      toast.success('Password changed successfully');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const inputBase = "h-11 w-full rounded-xl border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">Change Password</p>
        <p className="text-xs text-muted-foreground">Update your password to keep your account secure.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.current}
              onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
              placeholder="Enter your current password"
              required
              className={`${inputBase} pr-11 border-input focus:ring-primary/25 focus:border-primary/60`}
            />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={form.newPass}
              onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))}
              placeholder="Create a strong password"
              required
              className={`${inputBase} pr-11 border-input focus:ring-primary/25 focus:border-primary/60`}
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrength password={form.newPass} />
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirm Password</label>
          <div className="relative">
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Repeat new password"
              required
              className={`${inputBase} pr-11 ${
                form.confirm && form.newPass !== form.confirm
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                  : form.confirm && form.newPass === form.confirm
                  ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200'
                  : 'border-input focus:ring-primary/25 focus:border-primary/60'
              }`}
            />
            {form.confirm && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {form.newPass === form.confirm
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <XCircle className="h-4 w-4 text-red-400" />}
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="relative w-full h-11 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 overflow-hidden mt-2"
        >
          <AnimatePresence mode="wait">
            {success ? (
              <motion.span key="ok" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="absolute inset-0 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Password Updated!
              </motion.span>
            ) : saving ? (
              <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Updating…
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center gap-2">
                <Lock className="h-4 w-4" /> Update Password
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </form>
    </div>
  );
};

// ─── SMS Toggle ───────────────────────────────────────────────────────────────
const SmsToggleCard = ({
  enabled, loading, toggling, onToggle,
}: { enabled: boolean; loading: boolean; toggling: boolean; onToggle: () => void }) => (
  <div className="space-y-4">
    <div>
      <p className="text-sm font-semibold text-foreground mb-1">SMS Notifications</p>
      <p className="text-xs text-muted-foreground">Control outbound SMS to patients and doctors.</p>
    </div>

    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground text-sm py-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading SMS status…
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
              enabled ? 'bg-primary shadow-md shadow-primary/25' : 'bg-muted'
            }`}>
              <Smartphone className={`h-5 w-5 ${enabled ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">
                  {enabled ? 'SMS Notifications Active' : 'SMS Notifications Off'}
                </p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  {enabled ? 'LIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {enabled
                  ? 'Patients receive reminders, alerts & confirmations via SMS.'
                  : 'No outbound SMS will be sent while disabled.'}
              </p>
            </div>

            {/* Toggle */}
            <button
              onClick={onToggle}
              disabled={toggling}
              style={{ width: '52px' }}
              className={`relative h-7 shrink-0 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 ${
                enabled ? 'bg-primary' : 'bg-muted-foreground/25'
              }`}
            >
              {toggling
                ? <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white" />
                : <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md ${enabled ? 'left-[26px]' : 'left-0.5'}`} />
              }
            </button>
          </div>
        )}

        <AnimatePresence>
          {!loading && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className={`mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs transition-all ${
                enabled
                  ? 'bg-primary/5 border border-primary/15 text-primary'
                  : 'bg-muted/50 border border-border text-muted-foreground'
              }`}>
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {enabled
                    ? 'Active triggers: appointment created, rescheduled, cancelled, 48h reminder, missed, and new account registration.'
                    : 'Toggle on to resume all outbound SMS notifications to patients and doctors.'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

    {/* Test SMS */}
    <div>
      <p className="text-sm font-semibold text-foreground mb-1">Test Delivery</p>
      <p className="text-xs text-muted-foreground mb-3">Send a test SMS to verify your provider is working.</p>
      <TestSmsCard smsEnabled={enabled} />
    </div>

    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
      SMS configuration is only visible to administrators. Changes take effect immediately.
    </div>
  </div>
);

// ─── Test SMS ─────────────────────────────────────────────────────────────────
const TestSmsCard = ({ smsEnabled }: { smsEnabled: boolean }) => {
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  const handleTest = async () => {
    if (!testPhone.trim()) { toast.error('Please enter a phone number'); return; }
    setTestLoading(true);
    setTestResult(null);
    try {
      const data = await smsApi.test(testPhone.trim());
      setTestResult(data.sent ? 'success' : 'failed');
      if (data.sent) toast.success('Test SMS delivered!');
      else toast.error('SMS not delivered. Check provider settings.');
    } catch (e: any) {
      setTestResult('failed');
      toast.error(e.message || 'Test SMS failed');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-6 py-5 space-y-4">
        {!smsEnabled && (
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            Enable SMS above before sending a test message.
          </div>
        )}

        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              type="tel"
              value={testPhone}
              onChange={e => { setTestPhone(e.target.value); setTestResult(null); }}
              placeholder="+254712345678 or 0712345678"
              disabled={!smsEnabled || testLoading}
              className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            onClick={handleTest}
            disabled={!smsEnabled || testLoading || !testPhone.trim()}
            className="h-11 flex items-center gap-2 rounded-xl gradient-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Send
          </button>
        </div>

        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium ${
                testResult === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}
            >
              {testResult === 'success'
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <XCircle className="h-4 w-4 shrink-0" />}
              {testResult === 'success'
                ? 'Test message delivered successfully!'
                : 'Delivery failed. Check provider credentials.'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Maintenance Card ────────────────────────────────────────────────────────
const MaintenanceCard = () => {
  const { state, togglePage, setMessage, setEstimatedTime, activeCount } = useMaintenance();
  const [localMessage, setLocalMessage] = useState(state.message);
  const [localTime, setLocalTime] = useState(state.estimatedTime);

  const handleMessageBlur = () => { if (localMessage !== state.message) setMessage(localMessage); };
  const handleTimeBlur = () => { if (localTime !== state.estimatedTime) setEstimatedTime(localTime); };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">Page Maintenance</p>
        <p className="text-xs text-muted-foreground">
          Toggle pages under maintenance. Doctors and patients will see a maintenance screen instead.
          Admins always have full access.
        </p>
      </div>

      {/* Active count badge */}
      {activeCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 font-medium"
        >
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          {activeCount} page{activeCount > 1 ? 's are' : ' is'} currently under maintenance
        </motion.div>
      )}

      {/* Page toggles */}
      <div className="space-y-2">
        {MAINTAINABLE_PAGES.map((page) => {
          const active = !!state.pages[page.id];
          return (
            <div
              key={page.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                active ? 'border-amber-200 bg-amber-50' : 'border-border bg-background'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${active ? 'text-amber-800' : 'text-foreground'}`}>
                  {page.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Affects: {page.roles.join(', ')}
                </p>
              </div>
              <button
                onClick={() => togglePage(page.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {active
                  ? <><ToggleRight className="h-3.5 w-3.5" /> On</>
                  : <><ToggleLeft className="h-3.5 w-3.5" /> Off</>
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom message */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Maintenance Message
        </label>
        <textarea
          value={localMessage}
          onChange={e => setLocalMessage(e.target.value)}
          onBlur={handleMessageBlur}
          rows={2}
          placeholder="We're making improvements to enhance your experience."
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-all resize-none"
        />
        <p className="text-[11px] text-muted-foreground">Shown to users on the maintenance screen.</p>
      </div>

      {/* ETA */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Estimated Downtime
        </label>
        <div className="relative">
          <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            value={localTime}
            onChange={e => setLocalTime(e.target.value)}
            onBlur={handleTimeBlur}
            placeholder="e.g. 2 hours, Tonight, 30 minutes"
            className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-all"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">Optional — leave blank to hide the ETA.</p>
      </div>
    </div>
  );
};

// ─── Tab Definition ───────────────────────────────────────────────────────────
type TabId = 'security' | 'sms' | 'maintenance';

// ─── Main Settings Page ───────────────────────────────────────────────────────
const Settings = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TabId>('security');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setLoadingStatus(false); return; }
    smsApi.status()
      .then(d => setSmsEnabled(d.sms_enabled))
      .catch(() => toast.error('Could not load SMS status'))
      .finally(() => setLoadingStatus(false));
  }, [isAdmin]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const data = await smsApi.toggle(!smsEnabled);
      setSmsEnabled(data.sms_enabled);
      toast.success(data.message);
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle SMS');
    } finally {
      setToggling(false);
    }
  };

  const tabs = [
    { id: 'security' as TabId, label: 'Security', icon: Shield, color: 'text-primary' },
    ...(isAdmin ? [{ id: 'sms' as TabId, label: 'SMS Notifications', icon: MessageSquare, color: 'text-emerald-500' }] : []),
    ...(isAdmin ? [{ id: 'maintenance' as TabId, label: 'Maintenance', icon: Wrench, color: 'text-amber-500' }] : []),
  ];

  return (
    <Layout
      title="Settings"
      subtitle={isAdmin ? 'Manage your preferences and system configuration' : 'Manage your account preferences'}
    >
      <div className="max-w-2xl pb-8">

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 mb-6 w-fit">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 rounded-lg bg-card shadow-sm border border-border"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon className={`relative h-4 w-4 z-10 ${isActive ? tab.color : ''}`} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="rounded-2xl border border-border bg-card shadow-sm p-6"
          >
            {activeTab === 'security' && <ChangePasswordCard />}
            {activeTab === 'maintenance' && isAdmin && <MaintenanceCard />}
            {activeTab === 'sms' && isAdmin && (
              <SmsToggleCard
                enabled={smsEnabled}
                loading={loadingStatus}
                toggling={toggling}
                onToggle={handleToggle}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default Settings;