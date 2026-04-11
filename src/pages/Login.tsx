import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, LogIn, User, Stethoscope, ShieldCheck,
  Eye, EyeOff, Lock, AtSign, Phone, ArrowLeft,
  KeyRound, RefreshCcw, CheckCircle2, Loader2,
} from 'lucide-react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'https://diabecare.onrender.com/api';

// ── Forgot-password step types ────────────────────────────────────────────────
type FpStep = 'lookup' | 'otp' | 'reset' | 'done';

// ── OTP digit input ───────────────────────────────────────────────────────────
const OtpInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const next = value.slice(0, i) + value.slice(i + 1);
      onChange(next);
      if (i > 0) inputs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i: number, v: string) => {
    const ch = v.replace(/\D/g, '').slice(-1);
    if (!ch) return;
    const arr = digits.map(d => (d === ' ' ? '' : d));
    arr[i] = ch;
    const next = arr.join('').slice(0, 6);
    onChange(next);
    if (i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] === ' ' ? '' : digits[i]}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className={`h-12 w-10 rounded-xl border-2 text-center text-lg font-black transition-all focus:outline-none focus:border-primary ${
            digits[i] !== ' ' && digits[i] !== ''
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-background text-foreground'
          }`}
        />
      ))}
    </div>
  );
};

// ── Forgot Password multi-step modal ─────────────────────────────────────────
const ForgotPasswordModal = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep]           = useState<FpStep>('lookup');
  const [username, setUsername]   = useState('');
  const [maskedPhone, setMasked]  = useState('');
  const [otp, setOtp]             = useState('');
  const [resetToken, setToken]    = useState('');
  const [newPass, setNewPass]     = useState('');
  const [confirmPass, setConfirm] = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [showConfirm, setShowCon] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [resendCooldown, setCool] = useState(0);
  const coolRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (coolRef.current) clearInterval(coolRef.current); }, []);

  const startCooldown = () => {
    setCool(60);
    coolRef.current = setInterval(() => {
      setCool(s => { if (s <= 1) { clearInterval(coolRef.current!); return 0; } return s - 1; });
    }, 1000);
  };

  const apiPost = async (path: string, body: object) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  // Step 1 — lookup username
  const handleLookup = async () => {
    if (!username.trim()) { toast.error('Enter your username'); return; }
    setLoading(true);
    try {
      const data = await apiPost('/auth/forgot-password/lookup', { username: username.trim() });
      setMasked(data.masked_phone);
      setStep('otp');
      // Automatically send OTP after lookup
      await handleSendOtp(username.trim());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — send / resend OTP
  const handleSendOtp = async (uname = username) => {
    setLoading(true);
    try {
      await apiPost('/auth/forgot-password/send-otp', { username: uname.trim() });
      toast.success('OTP sent to your phone');
      startCooldown();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — verify OTP
  const handleVerify = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      const data = await apiPost('/auth/forgot-password/verify-otp', { username: username.trim(), otp });
      setToken(data.reset_token);
      setStep('reset');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 4 — reset password
  const handleReset = async () => {
    if (!newPass || !confirmPass) { toast.error('Fill in both password fields'); return; }
    if (newPass !== confirmPass)  { toast.error('Passwords do not match'); return; }
    if (newPass.length < 8)       { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await apiPost('/auth/forgot-password/reset', {
        reset_token: resetToken,
        new_password: newPass,
        confirm_password: confirmPass,
      });
      setStep('done');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const stepTitles: Record<FpStep, string> = {
    lookup: 'Forgot Password',
    otp:    'Verify Your Identity',
    reset:  'Set New Password',
    done:   'Password Reset!',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/50">
          {step !== 'done' && step !== 'lookup' && (
            <button
              onClick={() => { if (step === 'otp') setStep('lookup'); if (step === 'reset') setStep('otp'); }}
              className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{stepTitles[step]}</p>
            <div className="flex gap-1 mt-1">
              {(['lookup','otp','reset','done'] as FpStep[]).map((s, i) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
                  ['lookup','otp','reset','done'].indexOf(step) >= i ? 'bg-primary' : 'bg-muted'
                }`} />
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all">
            <Eye className="h-4 w-4 opacity-0 pointer-events-none" />
            <span className="sr-only">Close</span>
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Username lookup ── */}
            {step === 'lookup' && (
              <motion.div key="lookup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter your username and we'll send an OTP to your registered phone number.</p>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Username</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text" value={username}
                      onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      placeholder="Your username"
                      className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>
                <button onClick={handleLookup} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  {loading ? 'Looking up…' : 'Continue'}
                </button>
              </motion.div>
            )}

            {/* ── Step 2: OTP entry ── */}
            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3 text-center">
                  <Phone className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">OTP sent to</p>
                  <p className="text-sm font-bold text-foreground">{maskedPhone}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-3 text-center">Enter 6-digit OTP</label>
                  <OtpInput value={otp} onChange={setOtp} />
                </div>
                <button onClick={handleVerify} disabled={loading || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </button>
                <button
                  onClick={() => handleSendOtp()}
                  disabled={loading || resendCooldown > 0}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-primary font-semibold hover:underline disabled:text-muted-foreground disabled:no-underline transition-all"
                >
                  <RefreshCcw className="h-3 w-3" />
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </motion.div>
            )}

            {/* ── Step 3: New password ── */}
            {step === 'reset' && (
              <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">Choose a strong password of at least 8 characters.</p>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type={showNew ? 'text' : 'password'} value={newPass}
                      onChange={e => setNewPass(e.target.value)} placeholder="New password"
                      className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all" />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type={showConfirm ? 'text' : 'password'} value={confirmPass}
                      onChange={e => setConfirm(e.target.value)} placeholder="Confirm password"
                      onKeyDown={e => e.key === 'Enter' && handleReset()}
                      className={`h-11 w-full rounded-xl border bg-background pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all ${
                        confirmPass && confirmPass !== newPass ? 'border-destructive focus:ring-destructive/25' : 'border-input focus:border-primary/50'
                      }`} />
                    <button type="button" onClick={() => setShowCon(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPass && confirmPass !== newPass && (
                    <p className="text-[11px] text-destructive mt-1">Passwords do not match</p>
                  )}
                </div>
                <button onClick={handleReset} disabled={loading || !newPass || !confirmPass}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </motion.div>
            )}

            {/* ── Step 4: Done ── */}
            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 text-center py-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <p className="text-base font-black text-foreground">Password Reset!</p>
                  <p className="text-sm text-muted-foreground mt-1">Your password has been updated. You can now sign in with your new password.</p>
                </div>
                <button onClick={onClose}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all">
                  Back to Login
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

const roleInfo: { role: UserRole; label: string; icon: typeof User; description: string }[] = [
  { role: 'admin',   label: 'Admin',   icon: ShieldCheck,  description: 'Full system access' },
  { role: 'doctor',  label: 'Doctor',  icon: Stethoscope,  description: 'Manage patients & prescriptions' },
  { role: 'patient', label: 'Patient', icon: User,         description: 'View your records' },
];

const Login = () => {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [loading, setLoading]           = useState(false);
  const [showForgot, setShowForgot]     = useState(false);
  const { login, logout } = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      // login() stores the user — we read it back from localStorage to check role
      await login(username, password);

      const stored = localStorage.getItem('user');
      const loggedInUser = stored ? JSON.parse(stored) : null;
      const actualRole = loggedInUser?.role;

      if (actualRole && actualRole !== selectedRole) {
        // Role mismatch — log them out immediately and show a clear message
        logout();
        const roleLabel = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
        toast.error(`Invalid username or password`);
        return;
      }

      toast.success('Login successful!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Login failed — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary mb-4 shadow-lg"
          >
            <Heart className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold font-display text-foreground">DiabeCare</h1>
          <p className="text-sm text-muted-foreground mt-1">Diabetic Patient Medication Follow-Up System</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          {/* Role selector */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Login as</p>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {roleInfo.map(({ role, label, icon: Icon, description }) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs transition-all ${
                  selectedRole === role
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-semibold">{label}</span>
                <span className="text-[10px] opacity-70 text-center leading-tight hidden sm:block">{description}</span>
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username field */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Username</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye    className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs text-primary font-semibold hover:underline transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </motion.button>
          </form>

          <p className="text-[11px] text-muted-foreground text-center mt-5">
            Select your role above, and enter your credentials.
          </p>
        </motion.div>
      </motion.div>

      {/* Forgot password modal */}
      <AnimatePresence>
        {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      </AnimatePresence>

    </div>
  );
};

export default Login;