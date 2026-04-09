import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from './AdminDashboard';
import DoctorDashboard from './DoctorDashboard';
import PatientDashboard from './PatientDashboard';

const Dashboard = () => {
  const { user } = useAuth();

  // Also check localStorage for demo mode
  const storedUser = localStorage.getItem('diabecare_user');
  const role = user?.role || (storedUser ? JSON.parse(storedUser).role : 'admin');

  if (role === 'patient') return <PatientDashboard />;
  if (role === 'doctor') return <DoctorDashboard />;
  return <AdminDashboard />;
};

export default Dashboard;
