import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { authApi, patientsApi, appointmentsApi, medicationsApi, statsApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Stethoscope, CalendarDays, Pill, Activity, Search, 
  ChevronRight, ChevronDown, User, Mail, Phone, FileText,
  Loader2, TrendingUp, CheckCircle2, XCircle, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Doctor {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  patients: Patient[];
  stats: {
    totalPatients: number;
    totalAppointments: number;
    completedAppointments: number;
    avgAdherence: number;
    completedRate: number;
  };
}

interface Patient {
  id: number;
  name: string;
  age: number;
  diabetes_type: string;
  status: string;
  adherence_rate: number;
  last_visit: string;
  next_visit: string;
  appointments_count: number;
  medications_count: number;
  completed_medications_count: number;
}

const AdminDoctorManagement = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedDoctor, setExpandedDoctor] = useState<number | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);

  useEffect(() => {
    fetchDoctorsWithData();
  }, []);

  const fetchDoctorsWithData = async () => {
    setLoading(true);
    try {
      // Fetch all data in 3 parallel calls — no N+1 queries
      const [users, allPatients, allAppointments] = await Promise.all([
        authApi.listUsers(),
        patientsApi.list(),
        appointmentsApi.list(),
      ]);
      const doctorsList = users.filter((u: any) => u.role === 'doctor');

      // Fetch per-patient medications in parallel (one call per patient, all at once)
      const patientIds = allPatients.map((p: any) => p.id);
      const medsPerPatient: Record<number, any[]> = {};
      await Promise.all(
        patientIds.map(async (pid: number) => {
          const meds = await medicationsApi.listByPatient(pid);
          medsPerPatient[pid] = meds;
        })
      );

      const doctorsWithData = doctorsList.map((doctor: any) => {
        const doctorPatients = allPatients.filter((p: any) => p.assigned_doctor_id === doctor.id);
        const doctorAppointments = allAppointments.filter((a: any) => a.doctor_id === doctor.id);
        const completedAppointments = doctorAppointments.filter((a: any) => a.status === 'completed');
        const avgAdherence = doctorPatients.length > 0
          ? doctorPatients.reduce((acc: number, p: any) => acc + (p.adherence_rate || 0), 0) / doctorPatients.length
          : 0;

        const patientsWithDetails = doctorPatients.map((patient: any) => {
          const meds = medsPerPatient[patient.id] ?? [];
          const patientAppts = allAppointments.filter((a: any) => a.patient_id === patient.id);
          return {
            id: patient.id,
            name: patient.name,
            age: patient.age,
            diabetes_type: patient.diabetes_type,
            status: patient.status,
            adherence_rate: patient.adherence_rate || 0,
            last_visit: patient.last_visit,
            next_visit: patient.next_visit,
            appointments_count: patientAppts.length,
            medications_count: meds.filter((m: any) => !m.completed).length,
            completed_medications_count: meds.filter((m: any) => m.completed).length,
          };
        });

        return {
          id: doctor.id,
          full_name: doctor.full_name,
          email: doctor.email,
          phone: doctor.phone || 'N/A',
          patients: patientsWithDetails,
          stats: {
            totalPatients: doctorPatients.length,
            totalAppointments: doctorAppointments.length,
            completedAppointments: completedAppointments.length,
            avgAdherence: Math.round(avgAdherence),
            completedRate: doctorAppointments.length > 0
              ? Math.round((completedAppointments.length / doctorAppointments.length) * 100)
              : 0,
          },
        };
      });

      setDoctors(doctorsWithData);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(doctor =>
    doctor.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Layout title="Doctor Management" subtitle="View doctors and their patients">
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Doctor Management" subtitle="Monitor doctors' performance and patient assignments">
      
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search doctors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Doctors</p>
              <p className="text-2xl font-bold text-foreground">{doctors.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Patients Assigned</p>
              <p className="text-2xl font-bold text-foreground">
                {doctors.reduce((acc, d) => acc + d.stats.totalPatients, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <TrendingUp className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Patient Adherence</p>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(doctors.reduce((acc, d) => acc + d.stats.avgAdherence, 0) / (doctors.length || 1))}%
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <CalendarDays className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Appointments</p>
              <p className="text-2xl font-bold text-foreground">
                {doctors.reduce((acc, d) => acc + d.stats.totalAppointments, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Doctors List */}
      <div className="space-y-4">
        {filteredDoctors.map((doctor) => (
          <motion.div
            key={doctor.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
          >
            {/* Doctor Header */}
            <button
              onClick={() => setExpandedDoctor(expandedDoctor === doctor.id ? null : doctor.id)}
              className="w-full p-5 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                    {doctor.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{doctor.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {doctor.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {doctor.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{doctor.stats.totalPatients}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Patients</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{doctor.stats.totalAppointments}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Appointments</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-500">{doctor.stats.completedAppointments}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-500">{doctor.stats.avgAdherence}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Adherence</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-500">{doctor.stats.completedRate}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completion Rate</p>
                  </div>
                  {expandedDoctor === doctor.id ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>

            {/* Expanded Patients List */}
            <AnimatePresence>
              {expandedDoctor === doctor.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-border"
                >
                  <div className="p-5">
                    <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Assigned Patients ({doctor.patients.length})
                    </h4>
                    
                    {doctor.patients.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No patients assigned yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {doctor.patients.map((patient) => (
                          <div
                            key={patient.id}
                            className="rounded-lg border border-border bg-muted/20 p-4 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                                  {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <Link 
                                    to={`/patients/${patient.id}`}
                                    className="font-semibold text-foreground hover:text-primary transition-colors"
                                  >
                                    {patient.name}
                                  </Link>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span>{patient.age} yrs</span>
                                    <span>•</span>
                                    <span>{patient.diabetes_type}</span>
                                    <span>•</span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      patient.status === 'stable' ? 'bg-emerald-100 text-emerald-700' :
                                      patient.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {patient.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                  <span>{patient.appointments_count} appts</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Pill className="h-3 w-3 text-muted-foreground" />
                                  <span>{patient.medications_count} active</span>
                                </div>
                                {patient.completed_medications_count > 0 && (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                    <span className="text-emerald-600">{patient.completed_medications_count} completed</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Activity className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-semibold">{patient.adherence_rate}% adherence</span>
                                </div>
                                <Link
                                  to={`/patients/${patient.id}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20 transition-colors"
                                >
                                  View Details <ChevronRight className="h-3 w-3" />
                                </Link>
                              </div>
                            </div>
                            
                            {/* Patient visit info */}
                            <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap items-center gap-4 text-xs">
                              {patient.last_visit && (
                                <span className="text-muted-foreground">
                                  Last visit: {new Date(patient.last_visit).toLocaleDateString()}
                                </span>
                              )}
                              {patient.next_visit && (
                                <span className="text-primary">
                                  Next visit: {new Date(patient.next_visit).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {filteredDoctors.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-sm">No doctors found.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminDoctorManagement;