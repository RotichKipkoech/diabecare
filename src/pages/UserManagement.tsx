import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { authApi, patientsApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Pencil, Trash2, Search, ShieldCheck, Stethoscope,
  Users, X, Loader2, ArrowRight, User, Mail, Phone, Lock, Droplets, Activity,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/contexts/AuthContext';

interface SystemUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone: string;
  created_at: string;
}

const emptyStaffForm = {
  username: '', email: '', full_name: '', phone: '',
  role: 'doctor' as 'admin' | 'doctor', password: '',
};

const emptyPatientForm = {
  name: '', age: '', username: '', password: '',
  gender: 'Male' as 'Male' | 'Female',
  diabetes_type: 'Type 2' as 'Type 1' | 'Type 2' | 'Gestational',
  phone: '', email: '', blood_sugar: '', hba1c: '',
};

// ── Small field helpers ────────────────────────────────────────────────────
const Field = ({ label, required, optional, children }: {
  label: string; required?: boolean; optional?: boolean; children: React.ReactNode;
}) => (
  <div>
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
      {label}
      {required && <span className="text-red-400 ml-0.5">*</span>}
      {optional && <span className="font-normal normal-case tracking-normal text-gray-300 ml-1">(optional)</span>}
    </label>
    {children}
  </div>
);

const inputCls = "h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition";
const iconInputCls = "h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition";

const IconInput = ({ icon: Icon, ...props }: { icon: any } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
    <input {...props} className={iconInputCls} />
  </div>
);

// ── Role selector shown before modal opens ─────────────────────────────────
const RolePickerModal = ({ onPick, onClose }: {
  onPick: (role: 'admin' | 'doctor' | 'patient') => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">

      <div className="px-6 pt-7 pb-5 border-b border-gray-100">
        <button onClick={onClose} className="absolute right-5 top-5 h-7 w-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Add User</p>
        <h2 className="text-xl font-black text-gray-800">Who are you adding?</h2>
        <p className="text-xs text-gray-400 mt-1">Patients use a separate form with clinical fields.</p>
      </div>

      <div className="p-5 space-y-3">
        {([
          { role: 'doctor' as const, label: 'Doctor', desc: 'Manages patients & appointments', icon: Stethoscope, color: 'bg-primary/10 text-primary border-primary/20' },
          { role: 'admin' as const,  label: 'Admin',  desc: 'Full system access',             icon: ShieldCheck,  color: 'bg-amber-50 text-amber-600 border-amber-200' },
          { role: 'patient' as const, label: 'Patient', desc: 'Opens the patient registration form', icon: Users, color: 'bg-indigo-50 text-indigo-500 border-indigo-200' },
        ]).map(({ role, label, desc, icon: Icon, color }) => (
          <button key={role} onClick={() => onPick(role)}
            className="w-full flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 hover:border-gray-200 p-4 text-left transition-all group">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${color} flex-shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </button>
        ))}
      </div>
    </motion.div>
  </div>
);

// ── Staff (admin/doctor) create/edit modal ─────────────────────────────────
const StaffModal = ({ editing, initialRole, onClose, onSaved }: {
  editing: SystemUser | null;
  initialRole?: 'admin' | 'doctor';
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState(editing ? {
    username: editing.username, email: editing.email,
    full_name: editing.full_name, phone: editing.phone,
    role: editing.role as 'admin' | 'doctor', password: '',
  } : { ...emptyStaffForm, role: initialRole ?? 'doctor' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.username) { toast.error('Fill all required fields'); return; }
    if (!editing && !form.password) { toast.error('Password is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await authApi.updateUser(editing.id, { ...form, password: form.password || undefined });
        toast.success(`${form.full_name} updated`);
      } else {
        await authApi.registerUser(form);
        toast.success(`${form.full_name} created`);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = form.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className={`relative px-6 pt-6 pb-5 ${isAdmin ? 'bg-amber-50' : 'bg-primary/5'}`}>
          <button onClick={onClose} className="absolute right-4 top-4 h-7 w-7 flex items-center justify-center rounded-full bg-white/70 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3 ${isAdmin ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
            {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Stethoscope className="h-5 w-5" />}
          </div>
          <h2 className="text-lg font-black text-gray-800">
            {editing ? `Edit ${editing.full_name}` : `Add ${form.role === 'admin' ? 'Admin' : 'Doctor'}`}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{form.role} account</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name" required>
              <IconInput icon={User} type="text" placeholder="Dr. Jane Smith" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </Field>
            <Field label="Username" required>
              <IconInput icon={User} type="text" placeholder="jane_smith" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" required>
              <IconInput icon={Mail} type="email" placeholder="jane@hospital.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label="Phone" optional>
              <IconInput icon={Phone} type="tel" placeholder="+254 712 345678" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role" required>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'doctor' })}
                  className={inputCls}>
                  <option value="doctor">Doctor</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Password" required>
                <IconInput icon={Lock} type="password" placeholder="••••••••" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
              </Field>
            </div>
          )}
          {editing && (
            <Field label="New Password" optional>
              <IconInput icon={Lock} type="password" placeholder="Leave blank to keep current" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-2xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {editing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── Patient quick-add modal (mirrors AddPatient fields) ────────────────────
const PatientModal = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState(emptyPatientForm);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof emptyPatientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bs    = form.blood_sugar ? Number(form.blood_sugar) : 0;
    const hba1c = form.hba1c ? Number(form.hba1c) : 0;
    if (bs < 0 || bs > 600)       { toast.error('Blood Sugar must be 0–600 mg/dL'); return; }
    if (hba1c < 0 || hba1c > 20) { toast.error('HbA1c must be 0–20%'); return; }
    setSaving(true);
    try {
      await patientsApi.create({
        name: form.name, username: form.username, password: form.password,
        age: Number(form.age), gender: form.gender, diabetes_type: form.diabetes_type,
        phone: form.phone, email: form.email, blood_sugar: bs, hba1c,
      });
      toast.success(`${form.name} registered as patient`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-indigo-50 flex-shrink-0">
          <button onClick={onClose} className="absolute right-4 top-4 h-7 w-7 flex items-center justify-center rounded-full bg-white/70 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-500 mb-3">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-black text-gray-800">Register Patient</h2>
          <p className="text-xs text-gray-400 mt-0.5">Patient account with clinical information</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Name + Age */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name" required>
              <IconInput icon={User} placeholder="John Doe" value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Age" required>
              <input type="number" placeholder="45" value={form.age} onChange={set('age')}
                className={inputCls} required min="1" max="120" />
            </Field>
          </div>

          {/* Username + Password */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" required>
              <IconInput icon={User} placeholder="john_doe" value={form.username} onChange={set('username')} required />
            </Field>
            <Field label="Password" required>
              <IconInput icon={Lock} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </Field>
          </div>

          {/* Gender + Diabetes Type */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender" required>
              <select value={form.gender} onChange={set('gender')} className={inputCls}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </Field>
            <Field label="Diabetes Type" required>
              <select value={form.diabetes_type} onChange={set('diabetes_type')} className={inputCls}>
                <option value="Type 1">Type 1</option>
                <option value="Type 2">Type 2</option>
                <option value="Gestational">Gestational</option>
              </select>
            </Field>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" optional>
              <IconInput icon={Phone} type="tel" placeholder="+254 712 345678" value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email" optional>
              <IconInput icon={Mail} type="email" placeholder="patient@email.com" value={form.email} onChange={set('email')} />
            </Field>
          </div>

          {/* Blood Sugar + HbA1c */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Blood Sugar (mg/dL)" optional>
              <IconInput icon={Droplets} type="number" placeholder="e.g. 120" value={form.blood_sugar} onChange={set('blood_sugar')} min="0" max="600" />
            </Field>
            <Field label="HbA1c (%)" optional>
              <IconInput icon={Activity} type="number" step="0.1" placeholder="e.g. 6.5" value={form.hba1c} onChange={set('hba1c')} min="0" max="20" />
            </Field>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-2xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Register Patient
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── Delete confirmation modal ──────────────────────────────────────────────
const DeleteConfirmModal = ({
  user,
  onClose,
  onConfirm,
}: {
  user: SystemUser;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) => {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  const roleColor =
    user.role === 'admin'  ? 'text-amber-600'  :
    user.role === 'doctor' ? 'text-primary'     : 'text-indigo-500';

  const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden"
      >
        {/* Warning header */}
        <div className="relative px-6 pt-8 pb-6 flex flex-col items-center text-center bg-red-50">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 h-7 w-7 flex items-center justify-center rounded-full bg-white/70 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Pulsing danger ring */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-40" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-100 border-2 border-red-200">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Permanent Action</p>
          <h2 className="text-xl font-black text-gray-800 leading-tight">Delete User?</h2>
          <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
            This will permanently remove this account and all associated data.
          </p>
        </div>

        {/* User info card */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-4 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-200 text-gray-600 font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-800 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
              <p className={`text-xs font-semibold capitalize mt-0.5 ${roleColor}`}>{user.role}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              ⚠️ This cannot be undone. All patient records, appointments, and activity logs linked to this account will be affected.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 hover:bg-red-600 transition-all disabled:opacity-60"
          >
            {deleting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Trash2 className="h-4 w-4" />
            }
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────
const UserManagement = () => {
  const [users, setUsers]       = useState<SystemUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);

  // Modal state machine: null → role-picker → 'staff' | 'patient'
  const [modalStep, setModalStep] = useState<null | 'picker' | 'staff' | 'patient'>(null);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [staffInitialRole, setStaffInitialRole] = useState<'admin' | 'doctor'>('doctor');

  const fetchUsers = () => {
    authApi.listUsers()
      .then(setUsers)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter((u) => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openCreate = () => { setEditingUser(null); setModalStep('picker'); };
  const openEdit   = (user: SystemUser) => {
    setEditingUser(user);
    setStaffInitialRole(user.role === 'admin' ? 'admin' : 'doctor');
    // Patients edited here only for staff fields — for full patient edit use PatientDetail
    setModalStep('staff');
  };

  const handleDelete = (user: SystemUser) => {
    setDeleteTarget(user);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await authApi.deleteUser(deleteTarget.id);
    setUsers(prev => prev.filter((u) => u.id !== deleteTarget.id));
    toast.success(`"${deleteTarget.full_name}" deleted`);
    setDeleteTarget(null);
  };

  const onRolePick = (role: 'admin' | 'doctor' | 'patient') => {
    if (role === 'patient') {
      setModalStep('patient');
    } else {
      setStaffInitialRole(role);
      setModalStep('staff');
    }
  };

  const closeAll = () => { setModalStep(null); setEditingUser(null); };

  const roleIcon = (role: string) => {
    if (role === 'admin')  return <ShieldCheck className="h-3 w-3" />;
    if (role === 'doctor') return <Stethoscope className="h-3 w-3" />;
    return <Users className="h-3 w-3" />;
  };
  const roleBadge = (role: string) => {
    const cls = role === 'admin'
      ? 'bg-warning/10 text-warning'
      : role === 'doctor' ? 'bg-primary/10 text-primary' : 'bg-info/10 text-info';
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
        {roleIcon(role)} {role}
      </span>
    );
  };

  return (
    <Layout title="User Management" subtitle="Create, update and delete system users">

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {['all', 'admin', 'doctor', 'patient'].map((f) => (
              <button key={f} onClick={() => setRoleFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  roleFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}>{f}</button>
            ))}
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-primary-glow hover:opacity-90 transition-opacity">
            <UserPlus className="h-4 w-4" /> Add User
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Name', 'Username', 'Email', 'Phone', 'Role', 'Created', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{user.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.phone || '—'}</td>
                    <td className="px-4 py-3">{roleBadge(user.role)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(user)} title="Edit"
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(user)} title="Delete"
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {modalStep === 'picker' && (
          <RolePickerModal onPick={onRolePick} onClose={closeAll} />
        )}
        {modalStep === 'staff' && (
          <StaffModal
            editing={editingUser}
            initialRole={staffInitialRole}
            onClose={closeAll}
            onSaved={fetchUsers}
          />
        )}
        {modalStep === 'patient' && (
          <PatientModal onClose={closeAll} onSaved={fetchUsers} />
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            user={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default UserManagement;