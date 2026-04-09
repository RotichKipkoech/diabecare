import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PatientCard from '@/components/PatientCard';
import { patientsApi } from '@/services/api';
import { Patient } from '@/types/patient';
import { Search, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Patients = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    patientsApi.list()
      .then((data) => {
        const mapped: Patient[] = data.map((p: any) => ({
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
          medications: (p.medications || []).filter((m: any) => !m.completed).map((m: any) => ({
            id: String(m.id),
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            time: m.time,
            taken_today: m.taken_today,
            refill_date: m.refill_date,
          })),
        }));
        setPatients(mapped);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) => {
    const matchesSearch =
      p.name?.trim().toLowerCase().includes(search.trim().toLowerCase()) ?? false;

    const matchesStatus =
      statusFilter === 'all' ||
      p.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const filters = ['all', 'stable', 'warning', 'critical'];

  return (
    <Layout title="Patients" subtitle={`${filtered.length} patients found`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((patient, i) => (
            <PatientCard key={patient.id} patient={patient} index={i} />
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No patients found matching your criteria.</p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default Patients;