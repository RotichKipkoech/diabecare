import { useState } from 'react';
import Layout from '@/components/Layout';
import { patientsApi } from '@/services/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

const AddPatient = () => {
  const [form, setForm] = useState({
    name: '', age: '', username: '', password: '', gender: 'Male', diabetes_type: 'Type 2',
    phone: '', email: '', blood_sugar: '', hba1c: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const bloodSugar = form.blood_sugar ? Number(form.blood_sugar) : 0;
    const hba1c = form.hba1c ? Number(form.hba1c) : 0;

    if (bloodSugar < 0 || bloodSugar > 600) {
      toast.error('Blood Sugar must be between 0 and 600 mg/dL');
      return;
    }
    if (hba1c < 0 || hba1c > 20) {
      toast.error('HbA1c must be between 0 and 20% — enter the actual % value e.g. 6.5, not 65');
      return;
    }

    setLoading(true);
    try {
      await patientsApi.create({
        name: form.name,
        username: form.username,
        password: form.password,
        age: Number(form.age),
        gender: form.gender,
        diabetes_type: form.diabetes_type,
        phone: form.phone,
        email: form.email,
        blood_sugar: bloodSugar,
        hba1c: hba1c,
      });
      toast.success('Patient added successfully!', { description: `${form.name} has been registered in the system.` });
      setForm({ name: '', age: '', username: '', password: '', gender: 'Male', diabetes_type: 'Type 2', phone: '', email: '', blood_sugar: '', hba1c: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Layout title="Add Patient" subtitle="Register a new patient in the system">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" name="name" value={form.name} onChange={handleChange} required placeholder="John Doe" />
            <FormField label="Age" name="age" type="number" value={form.age} onChange={handleChange} required placeholder="45" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Username" name="username" value={form.username} onChange={handleChange} required placeholder="john_doe" />
            <FormField label="Password" name="password" type="password" value={form.password} onChange={handleChange} required placeholder="••••••••" />
            <SelectField label="Gender" name="gender" value={form.gender} onChange={handleChange} options={['Male', 'Female']} />
            <SelectField label="Diabetes Type" name="diabetes_type" value={form.diabetes_type} onChange={handleChange} options={['Type 1', 'Type 2', 'Gestational']} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 123-4567" />
            <FormField label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="patient@email.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Blood Sugar (mg/dL)" name="blood_sugar" type="number" value={form.blood_sugar} onChange={handleChange} placeholder="e.g. 120  (normal: 70-140)" min="0" max="600" />
            <FormField label="HbA1c (%)" name="hba1c" type="number" step="0.1" value={form.hba1c} onChange={handleChange} placeholder="e.g. 6.5  (normal: 4-7)" min="0" max="20" />
          </div>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-lg gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-primary-glow hover:opacity-90 transition-opacity disabled:opacity-50">
            <UserPlus className="h-4 w-4" />{loading ? 'Adding...' : 'Register Patient'}
          </button>
        </form>
      </motion.div>
    </Layout>
  );
};

const FormField = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
    <input {...props} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
  </div>
);

const SelectField = ({ label, options, ...props }: { label: string; options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div>
    <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
    <select {...props} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
      {options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
    </select>
  </div>
);

export default AddPatient;