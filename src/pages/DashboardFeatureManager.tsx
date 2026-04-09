import Layout from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, LayoutDashboard, Stethoscope, Users, Loader2, Lock } from 'lucide-react';
import { useState } from 'react';
import { useFeatures, DashboardFeature, FeatureType, TargetRole } from '@/contexts/FeaturesContext';

const emptyForm = {
  title: '',
  description: '',
  type: 'stat' as FeatureType,
  targetRole: 'patient' as TargetRole,
  enabled: true,
  value: '',
  unit: '',
};

const typeColors: Record<FeatureType, string> = {
  stat:  'bg-primary/10 text-primary',
  chart: 'bg-info/10 text-info',
  list:  'bg-success/10 text-success',
  alert: 'bg-warning/10 text-warning',
};

const DashboardFeatureManager = () => {
  const { features, updateFeature, addFeature, deleteFeature, toggleFeature } = useFeatures();

  const [roleFilter, setRoleFilter] = useState<'all' | TargetRole>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<DashboardFeature | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = features.filter((f) => roleFilter === 'all' || f.targetRole === roleFilter);
  const doctorCount = features.filter((f) => f.targetRole === 'doctor').length;
  const patientCount = features.filter((f) => f.targetRole === 'patient').length;

  const openCreate = () => {
    setEditingFeature(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (feature: DashboardFeature) => {
    setEditingFeature(feature);
    setForm({
      title: feature.title,
      description: feature.description,
      type: feature.type,
      targetRole: feature.targetRole,
      enabled: feature.enabled,
      value: feature.value || '',
      unit: feature.unit || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (feature: DashboardFeature) => {
    if (feature.isBuiltin) { toast.error('Built-in features cannot be deleted — disable them instead'); return; }
    try {
      await deleteFeature(feature.id);
      toast.success(`Feature "${feature.title}" removed`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (feature: DashboardFeature) => {
    try {
      await toggleFeature(feature.id);
      toast.success(`"${feature.title}" ${feature.enabled ? 'disabled' : 'enabled'}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingFeature) {
        await updateFeature(editingFeature.id, form);
        toast.success(`Feature "${form.title}" updated`);
      } else {
        await addFeature(form);
        toast.success(`Feature "${form.title}" added`);
      }
      setShowModal(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save feature');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Dashboard Feature Manager" subtitle="Add, update or remove features on Doctor and Patient dashboards">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Features',    value: features.length, icon: LayoutDashboard, cls: 'bg-primary/10 text-primary' },
          { label: 'Doctor Dashboard',  value: doctorCount,     icon: Stethoscope,     cls: 'bg-info/10 text-info' },
          { label: 'Patient Dashboard', value: patientCount,    icon: Users,           cls: 'bg-success/10 text-success' },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.cls}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold font-display text-foreground">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {(['all', 'doctor', 'patient'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                roleFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {f === 'all' ? 'All' : f === 'doctor' ? 'Doctor Dashboard' : 'Patient Dashboard'}
            </button>
          ))}
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-primary-glow hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add Feature
        </button>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence>
          {filtered.map((feature, i) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-start justify-between gap-3 rounded-xl border p-4 shadow-card transition-colors ${
                feature.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColors[feature.type]}`}>
                    {feature.type}
                  </span>
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                    {feature.targetRole}
                  </span>
                  {feature.isBuiltin && (
                    <span className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200">
                      <Lock className="h-2.5 w-2.5" /> Built-in
                    </span>
                  )}
                  {!feature.enabled && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{feature.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                {feature.value && (
                  <p className="text-xs font-medium text-primary mt-1">
                    Value: {feature.value} {feature.unit}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(feature)}
                  title={feature.enabled ? 'Disable' : 'Enable'}
                  className={`rounded-lg p-1.5 text-xs font-medium transition-colors ${
                    feature.enabled
                      ? 'text-success hover:bg-success/10'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {feature.enabled ? '●' : '○'}
                </button>
                <button
                  onClick={() => openEdit(feature)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(feature)}
                  disabled={feature.isBuiltin}
                  title={feature.isBuiltin ? 'Built-in features cannot be deleted' : 'Delete feature'}
                  className={`rounded-lg p-1.5 transition-colors ${feature.isBuiltin ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="col-span-2 py-16 text-center text-muted-foreground text-sm">
            No features found.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-display text-foreground">
                {editingFeature ? 'Edit Feature' : 'Add Dashboard Feature'}
              </h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Feature Title *
                  {editingFeature && editingFeature.id <= 10 && (
                    <span className="ml-2 text-[10px] text-warning font-normal">⚠ Built-in — title locked</span>
                  )}
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Weekly Weight Trend"
                  readOnly={!!(editingFeature && editingFeature.id <= 10)}
                  className={`h-10 w-full rounded-lg border border-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 ${
                    editingFeature && editingFeature.id <= 10
                      ? 'bg-muted cursor-not-allowed opacity-70'
                      : 'bg-background'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description *</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of what this feature shows"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Feature Type *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FeatureType })}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
                    <option value="stat">Stat Card</option>
                    <option value="chart">Chart</option>
                    <option value="list">List</option>
                    <option value="alert">Alert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Target Dashboard *</label>
                  <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value as TargetRole })}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
                    <option value="doctor">Doctor Dashboard</option>
                    <option value="patient">Patient Dashboard</option>
                  </select>
                </div>
              </div>
              {form.type === 'stat' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Default Value</label>
                    <input type="text" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                      placeholder="e.g. 120"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Unit</label>
                    <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      placeholder="e.g. mg/dL or %"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">Enable Feature</label>
                <button type="button" onClick={() => setForm({ ...form, enabled: !form.enabled })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.enabled ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-primary-glow hover:opacity-90 transition-opacity disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? 'Saving...' : editingFeature ? 'Update Feature' : 'Add Feature'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
};

export default DashboardFeatureManager;