import { useState, useRef } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  User, Mail, Phone, Stethoscope, Shield, Edit3, Save,
  Loader2, X, Clock, BadgeCheck, Sparkles, Lock,
  Camera, Trash2, Upload,
} from 'lucide-react';

// ── API helper for avatar ──────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
async function uploadAvatar(avatarDataUri: string | null): Promise<void> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_URL}/auth/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ avatar_url: avatarDataUri }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Avatar upload failed');
  }
}

// ── Shared input style ─────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-2xl border border-input bg-background/60 pl-10 pr-4 py-3 text-sm text-foreground ' +
  'placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/25 ' +
  'focus:border-primary/50 transition-all duration-200';

// ── Editable field ─────────────────────────────────────────────────────────
const Field = ({
  icon: Icon, label, value, onChange, type = 'text', placeholder, readOnly = false,
}: {
  icon: any; label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean;
}) => (
  <div className="group">
    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-2 pl-1">
      {label}
    </label>
    <div className="relative">
      <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
        readOnly ? 'text-muted-foreground/25' : 'text-muted-foreground/40 group-focus-within:text-primary/60'
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <input type={type} value={value} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} readOnly={readOnly}
        className={`${inputCls} ${readOnly ? 'opacity-40 cursor-not-allowed bg-muted/20' : ''}`} />
      {readOnly && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          <Lock className="h-3 w-3 text-muted-foreground/25" />
        </div>
      )}
    </div>
  </div>
);

// ── Info row (view mode) ───────────────────────────────────────────────────
const InfoItem = ({ icon: Icon, label, value, accent = false, delay = 0 }: {
  icon: any; label: string; value: string; accent?: boolean; delay?: number;
}) => (
  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className="flex items-center gap-4 py-4 border-b border-border/40 last:border-0">
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${
      accent ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
    }`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground truncate">{value || '—'}</p>
    </div>
  </motion.div>
);

// ── Avatar component ───────────────────────────────────────────────────────
const AvatarUploader = ({
  initials, currentAvatar, onAvatarChange, size = 'lg',
}: {
  initials: string;
  currentAvatar: string | null;
  onAvatarChange: (dataUri: string | null) => void;
  size?: 'lg' | 'sm';
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dim = size === 'lg' ? 'h-20 w-20' : 'h-14 w-14';
  const textSize = size === 'lg' ? 'text-2xl' : 'text-base';

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      onAvatarChange(dataUri);
      setUploading(false);
      toast.success('Photo ready — save your profile to apply it');
    };
    reader.onerror = () => { toast.error('Failed to read file'); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHovering(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="relative flex-shrink-0 group/avatar">
      {/* Avatar circle */}
      <div
        className={`relative ${dim} cursor-pointer`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onDragOver={e => { e.preventDefault(); setHovering(true); }}
        onDragLeave={() => setHovering(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        {currentAvatar ? (
          <img src={currentAvatar} alt="Profile"
            className={`${dim} rounded-full object-cover ring-2 ring-white/20 select-none`} />
        ) : (
          <div className={`${dim} flex items-center justify-center rounded-full bg-white/15 text-white font-black ${textSize} ring-2 ring-white/15 select-none`}>
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : initials}
          </div>
        )}

        {/* Hover overlay */}
        <AnimatePresence>
          {(hovering || uploading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`absolute inset-0 ${dim} rounded-full bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1`}
            >
              {uploading
                ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                : <>
                    <Camera className="h-5 w-5 text-white" />
                    <span className="text-[9px] font-black text-white/80 uppercase tracking-widest">
                      {currentAvatar ? 'Change' : 'Upload'}
                    </span>
                  </>
              }
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Remove button — only when photo exists */}
      {currentAvatar && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={e => { e.stopPropagation(); onAvatarChange(null); }}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 border-2 border-white/20 flex items-center justify-center shadow-lg z-10"
          title="Remove photo"
        >
          <X className="h-2.5 w-2.5 text-white" />
        </motion.button>
      )}

      {/* Online dot */}
      {!currentAvatar && (
        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-white/20" />
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
};


// ── Main Profile page ──────────────────────────────────────────────────────
const Profile = () => {
  const { user, setUser } = useAuth();
  const role = user?.role ?? 'doctor';

  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail]       = useState(user?.email ?? '');
  const [phone, setPhone]       = useState(user?.phone ?? '');
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);
  // undefined = no change; null = remove; string = new photo

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A';

  const currentAvatar = pendingAvatar !== undefined ? pendingAvatar : (user?.avatar_url ?? null);
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const RoleIcon  = role === 'admin' ? Shield : Stethoscope;
  const roleLabel = role === 'admin' ? 'Administrator' : 'Doctor';

  const handleCancel = () => {
    setEditing(false);
    setPendingAvatar(undefined);
    setFullName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save profile fields
      await authApi.updateProfile({ full_name: fullName, email, phone });

      // 2. Save avatar if changed
      if (pendingAvatar !== undefined) {
        await uploadAvatar(pendingAvatar);
        // Update local auth context so avatar shows everywhere immediately
        if (setUser) setUser((prev: any) => ({ ...prev, avatar_url: pendingAvatar }));
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      toast.success('Profile updated');
      setEditing(false);
      setPendingAvatar(undefined);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="My Profile" subtitle="Manage your account information">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── LEFT COLUMN: Identity card ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-1 flex flex-col gap-4"
        >
          {/* Hero identity card */}
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-indigo-600" />
            <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/5 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-indigo-300/10 blur-2xl pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            <div className="relative p-6 flex flex-col items-center text-center">
              {/* Avatar */}
              <div className="mb-4">
                {editing ? (
                  <AvatarUploader
                    initials={initials}
                    currentAvatar={currentAvatar}
                    onAvatarChange={setPendingAvatar}
                    size="lg"
                  />
                ) : (
                  <motion.div
                    initial={{ scale: 0.75, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="relative inline-block"
                  >
                    {currentAvatar ? (
                      <img src={currentAvatar} alt="Profile"
                        className="h-24 w-24 rounded-full object-cover ring-4 ring-white/20 shadow-2xl" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-white font-black text-3xl ring-4 ring-white/15 shadow-2xl select-none">
                        {initials}
                      </div>
                    )}
                    <div className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full bg-emerald-400 ring-2 ring-white/30 shadow-md" />
                  </motion.div>
                )}
              </div>

              {/* Name & meta */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }} className="w-full">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <h2 className="text-lg font-black text-white leading-tight truncate max-w-[180px]">
                    {user?.full_name || 'Your Name'}
                  </h2>
                  <BadgeCheck className="h-4 w-4 text-white/50 flex-shrink-0" />
                </div>
                <p className="text-xs text-white/45 font-medium mb-4">@{user?.username ?? 'username'}</p>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 border border-white/15 px-3 py-1 text-xs font-bold text-white">
                    <RoleIcon className="h-3 w-3" />{roleLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/7 border border-white/10 px-3 py-1 text-xs text-white/45">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                </div>

                {editing && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/35">
                    <Upload className="h-3 w-3" />Click photo to change · max 2MB
                  </motion.p>
                )}
              </motion.div>
            </div>
          </div>

          {/* Quick-info tiles */}
          <div className="rounded-3xl border border-border bg-card shadow-sm p-5 space-y-0">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-3">Account Info</p>
            <InfoItem icon={Clock}    label="Member Since" value={joinedDate}       delay={0.1} />
            <InfoItem icon={RoleIcon} label="Role"         value={roleLabel}        accent delay={0.14} />
            <InfoItem icon={User}     label="Username"     value={user?.username ?? ''} delay={0.18} />
          </div>

          {/* Account type badge */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border/50 bg-gradient-to-r from-primary/5 to-transparent px-5 py-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <RoleIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-foreground">
                {role === 'admin' ? 'Administrator Account' : 'Medical Staff Account'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {role === 'admin'
                  ? 'Full system access & user management'
                  : 'Patient management & appointments'}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* ── RIGHT COLUMN: Details & edit form ──────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-2 rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
        >
          {/* Card header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-border/50">
            <div>
              <h3 className="text-sm font-bold text-foreground">Account Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editing ? 'Update your contact details below' : 'Your personal information'}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {!editing ? (
                <motion.button key="edit-btn"
                  initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all shadow-sm">
                  <Edit3 className="h-3.5 w-3.5" />Edit Profile
                </motion.button>
              ) : (
                <motion.div key="save-btns"
                  initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }} className="flex items-center gap-2">
                  <button onClick={handleCancel}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition-all">
                    <X className="h-3.5 w-3.5" />Cancel
                  </button>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white shadow-md shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-60">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : saved ? <Sparkles className="h-3.5 w-3.5" />
                      : <Save className="h-3.5 w-3.5" />}
                    {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card body */}
          <div className="px-7 py-6">
            <AnimatePresence mode="wait">
              {!editing ? (
                <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="divide-y divide-border/40">
                  <InfoItem icon={User}  label="Full Name"    value={user?.full_name ?? ''} accent delay={0.05} />
                  <InfoItem icon={Mail}  label="Email"        value={user?.email ?? ''}     delay={0.09} />
                  <InfoItem icon={Phone} label="Phone Number" value={user?.phone ?? ''}     delay={0.13} />
                </motion.div>
              ) : (
                <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field icon={User}  label="Full Name"     value={fullName} onChange={setFullName} placeholder="Your full name" />
                    <Field icon={Phone} label="Phone Number"  value={phone}    onChange={setPhone}    placeholder="+254 712 345 678" />
                  </div>
                  <Field icon={Mail}  label="Email Address" value={email} onChange={setEmail} placeholder="your@email.com" type="email" />

                  <div className="pt-1">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-border/50" />
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/35">Read Only</span>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field icon={User}     label="Username" value={user?.username ?? ''} readOnly />
                      <Field icon={RoleIcon} label="Role"     value={roleLabel}            readOnly />
                    </div>
                    <p className="mt-4 text-[11px] text-muted-foreground/45 leading-relaxed">
                      Username and role are managed by your administrator.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </Layout>
  );
};

export default Profile;