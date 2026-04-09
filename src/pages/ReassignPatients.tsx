import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { patientsApi, authApi, reassignApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Stethoscope, Search, RefreshCcw, ArrowRightLeft, AlertTriangle, CheckCircle2, Loader2, ChevronDown, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Doctor { id: number; full_name: string; role: string; }
interface Patient { id: number; name: string; age: number; diabetes_type: string; status: string; assigned_doctor_id: number | null; assigned_doctor_name: string | null; }

const STATUS_COLOR: Record<string, string> = {
  stable:   'bg-emerald-50 text-emerald-600 border-emerald-100',
  warning:  'bg-amber-50 text-amber-600 border-amber-100',
  critical: 'bg-red-50 text-red-500 border-red-100',
};

function ReassignPatients() {
  const [patients, setPatients]     = useState<Patient[]>([]);
  const [doctors, setDoctors]       = useState<Doctor[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [saving, setSaving]         = useState<number | null>(null);  // patientId being saved
  const [selections, setSelections] = useState<Record<number, number>>({}); // patientId → new doctorId

  // Bulk reassign state
  const [bulkFrom, setBulkFrom]     = useState('');
  const [bulkTo, setBulkTo]         = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulk, setShowBulk]     = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pData, uData] = await Promise.all([patientsApi.list(), authApi.listUsers()]);
      setPatients(pData as unknown as Patient[]);
      setDoctors((uData as unknown as Doctor[]).filter(u => u.role === 'doctor'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReassign = async (patientId: number) => {
    const newDoctorId = selections[patientId];
    if (!newDoctorId) return;
    setSaving(patientId);
    try {
      const res = await reassignApi.reassignPatient(patientId, newDoctorId) as any;
      toast.success(res.message || 'Patient reassigned');
      // Update local state
      setPatients(prev => prev.map(p =>
        p.id === patientId
          ? { ...p, assigned_doctor_id: newDoctorId, assigned_doctor_name: doctors.find(d => d.id === newDoctorId)?.full_name ?? null }
          : p
      ));
      // Clear selection
      setSelections(prev => { const n = { ...prev }; delete n[patientId]; return n; });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reassignment failed');
    } finally {
      setSaving(null);
    }
  };

  const handleBulkReassign = async () => {
    if (!bulkFrom || !bulkTo || bulkFrom === bulkTo) {
      toast.error('Select two different doctors');
      return;
    }
    if (!confirm(`Move ALL patients from ${doctors.find(d => d.id === +bulkFrom)?.full_name} to ${doctors.find(d => d.id === +bulkTo)?.full_name}? This cannot be undone.`)) return;
    setBulkSaving(true);
    try {
      const res = await reassignApi.reassignBulk(+bulkFrom, +bulkTo) as any;
      toast.success(res.message || 'Bulk reassignment complete');
      await loadData();
      setBulkFrom(''); setBulkTo('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bulk reassignment failed');
    } finally {
      setBulkSaving(false);
    }
  };

  const filtered = patients.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchDoctor = !filterDoctor || String(p.assigned_doctor_id) === filterDoctor;
    return matchSearch && matchDoctor;
  });

  // Group patients by doctor for summary
  const doctorPatientCount = doctors.map(d => ({
    ...d,
    count: patients.filter(p => p.assigned_doctor_id === d.id).length,
  }));

  return (
    <Layout title="Reassign Patients" subtitle="Transfer patients between doctors">
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">

          {/* ── Doctor Load Overview ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {doctorPatientCount.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                  <Stethoscope className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">Dr. {d.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{d.count} patient{d.count !== 1 ? 's' : ''}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Bulk Reassign Panel ── */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
            <button onClick={() => setShowBulk(b => !b)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Bulk Reassign — Move all patients from one doctor to another
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${showBulk ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showBulk && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="overflow-hidden border-t border-amber-200">
                  <div className="p-5 flex flex-col sm:flex-row items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-amber-700 mb-1">From Doctor (retiring / leaving)</label>
                      <select value={bulkFrom} onChange={e => setBulkFrom(e.target.value)}
                        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                        <option value="">Select doctor...</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name} ({patients.filter(p => p.assigned_doctor_id === d.id).length} patients)</option>)}
                      </select>
                    </div>
                    <ArrowRightLeft className="h-5 w-5 text-amber-500 flex-shrink-0 mb-2" />
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-amber-700 mb-1">To Doctor (takes over)</label>
                      <select value={bulkTo} onChange={e => setBulkTo(e.target.value)}
                        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                        <option value="">Select doctor...</option>
                        {doctors.filter(d => String(d.id) !== bulkFrom).map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
                      </select>
                    </div>
                    <button onClick={handleBulkReassign} disabled={!bulkFrom || !bulkTo || bulkSaving}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors flex-shrink-0">
                      {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                      Reassign All
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Individual Reassign Table ── */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-border">
              <h3 className="text-sm font-semibold font-display text-foreground">Individual Reassignment</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Search patient..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 w-44 rounded-lg border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20" />
                </div>
                <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20">
                  <option value="">All Doctors</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
                </select>
                <button onClick={loadData} className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <RefreshCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No patients found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Patient</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Current Doctor</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Reassign To</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => {
                      const selected = selections[p.id];
                      const isChanged = selected && selected !== p.assigned_doctor_id;
                      return (
                        <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">{p.diabetes_type} • Age {p.age}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_COLOR[p.status] ?? STATUS_COLOR.stable}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm text-foreground">
                                {p.assigned_doctor_name ? `Dr. ${p.assigned_doctor_name}` : <span className="text-muted-foreground italic">Unassigned</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={selected ?? p.assigned_doctor_id ?? ''}
                              onChange={e => setSelections(prev => ({ ...prev, [p.id]: +e.target.value }))}
                              className={`rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                                isChanged ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-input bg-background text-foreground'
                              }`}>
                              <option value="">— Select doctor —</option>
                              {doctors.map(d => (
                                <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleReassign(p.id)}
                              disabled={!isChanged || saving === p.id}
                              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                              {saving === p.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <CheckCircle2 className="h-3.5 w-3.5" />}
                              {saving === p.id ? 'Saving...' : 'Confirm'}
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-4 py-2 border-t border-border bg-muted/10">
              <p className="text-xs text-muted-foreground">{filtered.length} of {patients.length} patients shown</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default ReassignPatients;