import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Heart, LogIn, User, Stethoscope, ShieldCheck,
  Eye, EyeOff, Lock, AtSign,
} from 'lucide-react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const { login }    = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
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
    </div>
  );
};

export default Login;