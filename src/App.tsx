import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FeaturesProvider } from "@/contexts/FeaturesContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MaintenanceProvider } from "@/contexts/MaintenanceContext";
import MaintenanceGate from "@/components/MaintenanceGate";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Medications from "./pages/Medications";
import Appointments from "./pages/Appointments";
import AddPatient from "./pages/AddPatient";
import UserManagement from "./pages/UserManagement";
import DashboardFeatureManager from "./pages/DashboardFeatureManager";
import MyProfile from "./pages/MyProfile";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import ActivityLog from "./pages/ActivityLog";
import AppointmentRequest from "./pages/AppointmentRequest";
import HealthReport from "./pages/HealthReport";
import SmsLogs from "./pages/SmsLogs";
import Broadcast from "./pages/Broadcast";
import ReassignPatients from "./pages/ReassignPatients";
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) => {
  const auth = useAuth();
  const { isAuthenticated, user } = auth;
  // Support both old and new AuthContext (initializing may not exist in older versions)
  const initializing = (auth as { initializing?: boolean }).initializing ?? false;

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated && !user) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<ProtectedRoute><MaintenanceGate><Dashboard /></MaintenanceGate></ProtectedRoute>} />
    <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
    <Route path="/dashboard-features" element={<ProtectedRoute allowedRoles={['admin']}><DashboardFeatureManager /></ProtectedRoute>} />
    <Route path="/patients" element={<ProtectedRoute allowedRoles={['admin', 'doctor']}><MaintenanceGate><Patients /></MaintenanceGate></ProtectedRoute>} />
    <Route path="/patients/:id" element={<ProtectedRoute allowedRoles={['admin', 'doctor']}><MaintenanceGate><PatientDetail /></MaintenanceGate></ProtectedRoute>} />
    <Route path="/medications" element={<ProtectedRoute allowedRoles={['admin', 'doctor']}><MaintenanceGate><Medications /></MaintenanceGate></ProtectedRoute>} />
    <Route path="/appointments" element={<ProtectedRoute><MaintenanceGate><Appointments /></MaintenanceGate></ProtectedRoute>} />
    <Route path="/appointments/request" element={<ProtectedRoute allowedRoles={['patient']}><MaintenanceGate><AppointmentRequest /></MaintenanceGate></ProtectedRoute>} />
    <Route path="/add-patient" element={<ProtectedRoute allowedRoles={['admin']}><AddPatient /></ProtectedRoute>} />
    {/* Patient profile (existing) */}
    <Route path="/profile" element={<ProtectedRoute allowedRoles={['patient']}><MaintenanceGate><MyProfile /></MaintenanceGate></ProtectedRoute>} />
    {/* Doctor / Admin profile */}
    <Route path="/my-profile" element={<ProtectedRoute allowedRoles={['admin', 'doctor']}><MaintenanceGate><Profile /></MaintenanceGate></ProtectedRoute>} />
    {/* Settings — all roles */}
    <Route path="/settings" element={<ProtectedRoute><MaintenanceGate><Settings /></MaintenanceGate></ProtectedRoute>} />
    
    {/* Admin activity log */}
    <Route path="/activity-log" element={<ProtectedRoute allowedRoles={['admin']}><ActivityLog /></ProtectedRoute>} />
    {/* Health Report — admin + doctor */}
    <Route path="/health-report" element={<ProtectedRoute allowedRoles={['admin', 'doctor']}><MaintenanceGate><HealthReport /></MaintenanceGate></ProtectedRoute>} />
    {/* SMS Logs — admin only */}
    <Route path="/sms-logs" element={<ProtectedRoute allowedRoles={['admin']}><SmsLogs /></ProtectedRoute>} />
    <Route path="/broadcast" element={<ProtectedRoute allowedRoles={['admin', 'doctor']}><Broadcast /></ProtectedRoute>} />
    <Route path="/reassign-patients" element={<ProtectedRoute allowedRoles={['admin']}><ReassignPatients /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FeaturesProvider>
            <ThemeProvider>
              <MaintenanceProvider>
                <AppRoutes />
              </MaintenanceProvider>
            </ThemeProvider>
          </FeaturesProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;