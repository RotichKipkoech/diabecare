import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import MedicationList from '@/components/MedicationList';
import { patientsApi, medicationsApi } from '@/services/api';
import { Patient, Medication } from '@/types/patient';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, Mail, Calendar, Droplets, Activity, Pill, Loader2, Pencil, Save, X, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const PatientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  // Vitals edit state
  const [editingVitals, setEditingVitals] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    blood_sugar: '',
    hba1c: '',
    diabetes_type: 'Type 2' as 'Type 1' | 'Type 2' | 'Gestational',
  });

  const fetchPatient = (patientId: number) => {
    setLoading(true);
    patientsApi.get(patientId)
      .then((p: any) => {
        setPatient({
          id: String(p.id),
          user_id: p.user_id,
          name: p.name,
          age: p.age,
          gender: p.gender,
          diabetes_type: p.diabetes_type,
          phone: p.phone,
          email: p.email,
          blood_sugar: p.blood_sugar,
          hba1c: p.hba1c,
          last_visit: p.last_visit,
          next_visit: p.next_visit,
          adherence_rate: p.adherence_rate,
          status: p.status,
          assigned_doctor_name: p.assigned_doctor_name || null,
          medications: (p.medications || []).filter((m: any) => !m.completed).map((m: any) => ({
            id: String(m.id),
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            time: m.time,
            taken_today: m.taken_today,
            refill_date: m.refill_date,
          })),
        });
        setVitalsForm({
          blood_sugar: String(p.blood_sugar ?? ''),
          hba1c: String(p.hba1c ?? ''),
          diabetes_type: p.diabetes_type ?? 'Type 2',
        });
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    fetchPatient(Number(id));
  }, [id]);

  const handleToggleMed = async (medId: string, taken: boolean) => {
    try {
      await medicationsApi.markTaken(Number(medId), taken);
      setPatient((prev) =>
        prev ? { ...prev, medications: prev.medications.map((m) => m.id === medId ? { ...m, taken_today: taken } : m) } : prev
      );
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSaveVitals = async () => {
    if (!patient) return;
    const bloodSugar = parseFloat(vitalsForm.blood_sugar);
    const hba1c = parseFloat(vitalsForm.hba1c);
    if (isNaN(bloodSugar) || isNaN(hba1c)) {
      toast.error('Please enter valid numeric values');
      return;
    }
    setSavingVitals(true);
    try {
      await patientsApi.update(Number(patient.id), {
        blood_sugar: bloodSugar,
        hba1c: hba1c,
        diabetes_type: vitalsForm.diabetes_type,
      });
      toast.success('Vitals updated successfully');
      setEditingVitals(false);
      fetchPatient(Number(patient.id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingVitals(false);
    }
  };

  const handleCancelVitals = () => {
    if (!patient) return;
    setVitalsForm({
      blood_sugar: String(patient.blood_sugar ?? ''),
      hba1c: String(patient.hba1c ?? ''),
      diabetes_type: patient.diabetes_type,
    });
    setEditingVitals(false);
  };

  if (loading) {
    return (
      <Layout title="Loading...">
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </Layout>
    );
  }

  if (!patient) {
    return (
      <Layout title="Patient Not Found">
        <div className="py-16 text-center text-muted-foreground">
          <p>Patient not found.</p>
          <button onClick={() => navigate('/patients')} className="mt-4 text-primary underline text-sm">Back to patients</button>
        </div>
      </Layout>
    );
  }

  const isDoctor = user?.role === 'doctor' || user?.role === 'admin';

  const statusColor = {
    stable: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    critical: 'bg-destructive/10 text-destructive',
  }[patient.status];

  return (
    <Layout title={patient.name} subtitle={`${patient.diabetes_type} • ${patient.age} years old`}>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Panel ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold font-display text-lg">
              {patient.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="font-bold font-display text-foreground">{patient.name}</h2>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusColor}`}>{patient.status}</span>
            </div>
          </div>

          <div className="space-y-4">
            <InfoRow icon={Phone} label="Phone" value={patient.phone} />
            <InfoRow icon={Mail} label="Email" value={patient.email} />
            <InfoRow icon={Calendar} label="Last Visit" value={patient.last_visit ? new Date(patient.last_visit).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'} />
            <InfoRow icon={Calendar} label="Next Visit" value={patient.next_visit ? new Date(patient.next_visit).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'} />
            {isDoctor && (
              <InfoRow icon={Stethoscope} label="Assigned Doctor" value={(patient as any).assigned_doctor_name || 'Not assigned'} />
            )}
          </div>

          {/* ── Vitals ── */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vitals</h3>
              {isDoctor && !editingVitals && (
                <button
                  onClick={() => setEditingVitals(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary border border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Update
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {editingVitals ? (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Blood Sugar (mg/dL)</label>
                    <div className="relative">
                      <Droplets className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="number"
                        value={vitalsForm.blood_sugar}
                        onChange={(e) => setVitalsForm(f => ({ ...f, blood_sugar: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                        placeholder="e.g. 120"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">HbA1c (%)</label>
                    <div className="relative">
                      <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="number"
                        step="0.1"
                        value={vitalsForm.hba1c}
                        onChange={(e) => setVitalsForm(f => ({ ...f, hba1c: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                        placeholder="e.g. 6.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Diabetes Type</label>
                    <select
                      value={vitalsForm.diabetes_type}
                      onChange={(e) => setVitalsForm(f => ({ ...f, diabetes_type: e.target.value as any }))}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                    >
                      <option value="Type 1">Type 1</option>
                      <option value="Type 2">Type 2</option>
                      <option value="Gestational">Gestational</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCancelVitals}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="h-3 w-3" /> Cancel
                    </button>
                    <button
                      onClick={handleSaveVitals}
                      disabled={savingVitals}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-primary-glow hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savingVitals
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Save className="h-3 w-3" />
                      }
                      Save
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="view"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="grid grid-cols-2 gap-3"
                >
                  <VitalCard icon={Droplets} label="Blood Sugar" value={`${patient.blood_sugar} mg/dL`} warn={patient.blood_sugar > 180} />
                  <VitalCard icon={Activity} label="HbA1c" value={`${patient.hba1c}%`} warn={patient.hba1c > 7.5} />
                  <VitalCard icon={Pill} label="Medications" value={String(patient.medications.length)} />
                  <VitalCard icon={Activity} label="Adherence" value={`${patient.adherence_rate}%`} warn={patient.adherence_rate < 70} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Right Panel: Medications ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="text-sm font-semibold font-display text-foreground mb-4">Medication Schedule</h3>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Overall Adherence</span>
              <span className="text-xs font-semibold text-foreground">{patient.adherence_rate}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${patient.adherence_rate}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={`h-full rounded-full ${patient.adherence_rate >= 80 ? 'bg-success' : patient.adherence_rate >= 60 ? 'bg-warning' : 'bg-destructive'}`}
              />
            </div>
          </div>
          <MedicationList medications={patient.medications} onToggle={handleToggleMed} role={user?.role === "patient" ? "patient" : "doctor"} />
        </motion.div>

      </div>
    </Layout>
  );
};

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  </div>
);

const VitalCard = ({ icon: Icon, label, value, warn }: { icon: any; label: string; value: string; warn?: boolean }) => (
  <div className={`rounded-lg p-3 border ${warn ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-secondary/50'}`}>
    <Icon className={`h-4 w-4 mb-1 ${warn ? 'text-destructive' : 'text-muted-foreground'}`} />
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={`text-sm font-bold ${warn ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
  </div>
);

export default PatientDetail;