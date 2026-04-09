import { Patient, DashboardStats } from '@/types/patient';
export const mockPatients: Patient[] = [];

export const mockStats: DashboardStats = {
  totalPatients: 0,
  activePatients: 0,
  avgAdherence: 0,
  criticalPatients: 0,
  upcomingAppointments: 0,
  medicationsDispensed: 0,
};

export const adherenceData: { month: string; rate: number }[] = [];

export const bloodSugarTrend: { day: string; avg: number }[] = [];
