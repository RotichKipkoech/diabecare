export interface Appointment {
  id: string;
  appointment_date: string;
  type: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  doctor_name?: string;
}

export interface Medication {
  id: string;
  patient_id?: number;
  name: string;
  dosage: string;
  frequency: string;
  time?: string;
  refill_date?: string;
  taken_today: boolean; 
  prescribed_by?: number;
  created_at?: string;
}

export interface Patient {
  id: string;
  user_id?: number;

  name: string;
  age: number;
  gender: 'Male' | 'Female';
  diabetes_type: 'Type 1' | 'Type 2' | 'Gestational';

  phone: string;
  email: string;

  blood_sugar: number;
  hba1c: number;

  last_visit?: string;
  next_visit?: string;

  adherence_rate: number;
  status: 'stable' | 'warning' | 'critical';

  medications: Medication[];
  appointments?: Appointment[];

  assigned_doctor_id?: number;
  created_at?: string;
}

export interface DashboardStats {
  totalPatients: number;
  activePatients: number;
  avgAdherence: number;
  criticalPatients: number;
  upcomingAppointments: number;
  medicationsDispensed: number;
}