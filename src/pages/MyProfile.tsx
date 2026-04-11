import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { patientsApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  User, Phone, Mail, Droplets, Activity, Heart, CalendarDays,
  Save, Pencil, Loader2, Camera, X, Upload, Stethoscope,
} from 'lucide-react';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = import.meta.env.VITE_API_URL || "https://diabecare.onrender.com/api";
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

// ── Avatar uploader ────────────────────────────────────────────────────────
const AvatarUploader = ({
  initials, currentAvatar, onAvatarChange, editing,
}: {
  initials: string; currentAvatar: string | null;
  onAvatarChange: (v: string | null) => void; editing: boolean;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setProcessing(true);
    const reader = new FileReader();
    reader.onload = e => {
      onAvatarChange(e.target?.result as string);
      setProcessing(false);
      toast.success('Photo ready — tap Save to apply');
    };
    reader.onerror = () => { toast.error('Failed to read file'); setProcessing(false); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative mx-auto w-fit">
      <div
        className={`relative h-20 w-20 ${editing ? 'cursor-pointer' : ''}`}
        onMouseEnter={() => editing && setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onDragOver={e => { if (editing) { e.preventDefault(); setHovering(true); } }}
        onDragLeave={() => setHovering(false)}
        onDrop={e => {
          if (!editing) return;
          e.preventDefault(); setHovering(false);
          const f = e.dataTransfer.files[0]; if (f) handleFile(f);
        }}
        onClick={() => editing && fileRef.current?.click()}
      >
        {currentAvatar ? (
          <img src={currentAvatar} alt="Profile"
            className="h-20 w-20 rounded-full object-cover ring-4 ring-primary/20" />
        ) : (
          <div className="h-20 w-20 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-2xl font-bold select-none">
            {processing ? <Loader2 className="h-6 w-6 animate-spin" /> : initials}
          </div>
        )}

        {/* Hover overlay — edit mode only */}
        <AnimatePresence>
          {editing && (hovering || processing) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 rounded-full bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1">
              {processing
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

      {/* Remove button */}
      {editing && currentAvatar && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={e => { e.stopPropagation(); onAvatarChange(null); }}
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center shadow z-10"
          title="Remove photo">
          <X className="h-2.5 w-2.5 text-white" />
        </motion.button>
      )}

      {/* Upload badge — visible in edit mode when no photo */}
      {editing && !currentAvatar && (
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary border-2 border-white flex items-center justify-center shadow">
          <Camera className="h-3 w-3 text-white" />
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
};

// ── Vital row ──────────────────────────────────────────────────────────────
const VitalRow = ({ icon: Icon, label, value, warn }: {
  icon: any; label: string; value: string; warn?: boolean;
}) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
    <div className="flex items-center gap-2.5">
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${warn ? 'bg-red-50' : 'bg-muted/50'}`}>
        <Icon className={`h-3.5 w-3.5 ${warn ? 'text-red-500' : 'text-muted-foreground'}`} />
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
    <span className={`text-xs font-bold tabular-nums ${warn ? 'text-red-500' : 'text-foreground'}`}>{value}</span>
  </div>
);

// ── Field ──────────────────────────────────────────────────────────────────
const Field = ({ icon: Icon, label, value, onChange, type = 'text', placeholder }: {
  icon: any; label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) => (
  <div className="group">
    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1.5 pl-0.5">{label}</label>
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-2xl border border-input bg-background/60 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-all" />
    </div>
  </div>
);

// ── Info row ───────────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0">
    <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value || '—'}</p>
    </div>
  </div>
);

// ── Read-only chip ─────────────────────────────────────────────────────────
const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-muted/40 border border-border/50 px-3.5 py-3">
    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50 mb-0.5">{label}</p>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────────
const MyProfile = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [rawPatient, setRawPatient] = useState<any>(null);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [profile, setProfile]   = useState({ name: '', phone: '', email: '' });
  const [form, setForm]         = useState({ name: '', phone: '', email: '' });
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    // Fetch both: patient record (clinical data) + user record (avatar)
    Promise.all([
      patientsApi.list(),
      fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ])
      .then(([patientData, userData]) => {
        const p = patientData[0];
        if (p) {
          setRawPatient({ ...p, avatar_url: userData.avatar_url ?? null });
          const info = { name: p.name, phone: p.phone, email: p.email };
          setProfile(info);
          setForm(info);
          if (setUser && userData.avatar_url) {
            setUser((prev: any) => ({ ...prev, avatar_url: userData.avatar_url }));
          }
        }
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const currentAvatar = pendingAvatar !== undefined ? pendingAvatar : (user?.avatar_url ?? null);
  const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPatient) return;
    setSaving(true);
    try {
      // /auth/profile updates full_name, phone, email — accessible to all roles
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ full_name: form.name, phone: form.phone, email: form.email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Profile update failed');
      }
      if (pendingAvatar !== undefined) {
        await uploadAvatar(pendingAvatar);
        if (setUser) setUser((prev: any) => ({ ...prev, avatar_url: pendingAvatar }));
      }
      setProfile(form);
      setEditing(false);
      setPendingAvatar(undefined);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="My Profile">
        <div className="py-20 flex justify-center items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading your profile…</span>
        </div>
      </Layout>
    );
  }

  if (!rawPatient) {
    return <Layout title="My Profile"><p className="text-muted-foreground py-8">No patient record found.</p></Layout>;
  }

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    stable:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    warning:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    critical: { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  };
  const sc = statusConfig[rawPatient.status] ?? statusConfig.stable;

  return (
    <Layout title="My Profile" subtitle="View and update your personal information">
      <div className="max-w-3xl grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ───────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-1 space-y-4">

          {/* Identity card */}
          <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Top gradient strip */}
            <div className="h-16 bg-gradient-to-br from-primary/80 to-indigo-500/80 relative">
              <div className="absolute inset-0 opacity-[0.08]"
                style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
            </div>

            <div className="px-5 pb-5 -mt-10 flex flex-col items-center text-center">
              <AvatarUploader
                initials={initials}
                currentAvatar={currentAvatar}
                onAvatarChange={setPendingAvatar}
                editing={editing}
              />

              <h2 className="mt-3 font-bold text-foreground leading-tight">{profile.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rawPatient.diabetes_type} · {rawPatient.age} yrs · {rawPatient.gender}
              </p>

              <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold capitalize ${sc.bg} ${sc.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} ${rawPatient.status === 'critical' ? 'animate-pulse' : ''}`} />
                {rawPatient.status}
              </span>

              {editing && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  Click photo to change · max 2MB
                </motion.p>
              )}
            </div>
          </div>

          {/* Vitals card */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-3">Current Vitals</p>
            <VitalRow icon={Droplets}    label="Blood Sugar" value={`${rawPatient.blood_sugar} mg/dL`} warn={rawPatient.blood_sugar > 180} />
            <VitalRow icon={Activity}    label="HbA1c"       value={`${rawPatient.hba1c}%`}           warn={rawPatient.hba1c > 7.5} />
            <VitalRow icon={Heart}       label="Adherence"   value={`${rawPatient.adherence_rate}%`}  warn={rawPatient.adherence_rate < 70} />
            <VitalRow icon={CalendarDays} label="Last Visit" value={
              rawPatient.last_visit
                ? new Date(rawPatient.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'
            } />
            <VitalRow icon={CalendarDays} label="Next Visit" value={
              rawPatient.next_visit
                ? new Date(rawPatient.next_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'
            } />
          </div>
        </motion.div>

        {/* ── Right column ──────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-2">
          <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden h-full">

            {/* Card header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-border/50">
              <div>
                <h3 className="text-sm font-bold text-foreground">Personal Information</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editing ? 'Update your contact details below' : 'Only contact details can be updated'}
                </p>
              </div>
              {!editing && (
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => { setForm(profile); setEditing(true); }}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all shadow-sm">
                  <Pencil className="h-3.5 w-3.5" />Edit Profile
                </motion.button>
              )}
            </div>

            <div className="px-7 py-6">
              <AnimatePresence mode="wait">
                {editing ? (
                  <motion.form key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onSubmit={handleSave} className="space-y-5">
                    <Field icon={User}  label="Full Name"     value={form.name}  onChange={v => setForm({ ...form, name: v })}  placeholder="Your full name" />
                    <Field icon={Phone} label="Phone Number"  value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+254 712 345 678" type="tel" />
                    <Field icon={Mail}  label="Email Address" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="you@email.com" type="email" />

                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/35">Medical Details</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <ReadOnlyField label="Diabetes Type" value={rawPatient.diabetes_type} />
                        <ReadOnlyField label="Age"           value={`${rawPatient.age} years`} />
                        <ReadOnlyField label="Gender"        value={rawPatient.gender} />
                        <ReadOnlyField label="Patient ID"    value={`#${rawPatient.id}`} />
                      </div>
                    </div>

                    {/* Assigned Doctor — read only in edit mode too */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50">Your Assigned Doctor</p>
                        <p className="text-sm font-bold text-foreground">
                          {rawPatient.assigned_doctor_name || 'Not yet assigned'}
                        </p>
                        {rawPatient.assigned_doctor_phone && (
                          <a href={`tel:${rawPatient.assigned_doctor_phone}`}
                            className="flex items-center gap-1 mt-0.5 text-xs text-primary hover:underline">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {rawPatient.assigned_doctor_phone}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button type="button"
                        onClick={() => { setEditing(false); setPendingAvatar(undefined); }}
                        className="flex-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-all">
                        Cancel
                      </button>
                      <motion.button type="submit" disabled={saving}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity disabled:opacity-60">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? 'Saving…' : 'Save Changes'}
                      </motion.button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="space-y-0">
                    <InfoRow icon={User}  label="Full Name"     value={profile.name} />
                    <InfoRow icon={Phone} label="Phone Number"  value={profile.phone} />
                    <InfoRow icon={Mail}  label="Email Address" value={profile.email} />

                    <div className="pt-4 mt-2">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/35">Medical Details</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <ReadOnlyField label="Diabetes Type" value={rawPatient.diabetes_type} />
                        <ReadOnlyField label="Age"           value={`${rawPatient.age} years`} />
                        <ReadOnlyField label="Gender"        value={rawPatient.gender} />
                        <ReadOnlyField label="Patient ID"    value={`#${rawPatient.id}`} />
                      </div>
                    </div>

                    {/* Assigned Doctor */}
                    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50">Your Assigned Doctor</p>
                        <p className="text-sm font-bold text-foreground">
                          {rawPatient.assigned_doctor_name || 'Not yet assigned'}
                        </p>
                        {rawPatient.assigned_doctor_phone && (
                          <a href={`tel:${rawPatient.assigned_doctor_phone}`}
                            className="flex items-center gap-1 mt-0.5 text-xs text-primary hover:underline">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {rawPatient.assigned_doctor_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default MyProfile;