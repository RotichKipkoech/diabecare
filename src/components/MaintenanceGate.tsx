import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { motion } from 'framer-motion';
import { Wrench, Clock, ArrowLeft, Heart } from 'lucide-react';
import { ReactNode } from 'react';

interface MaintenanceGateProps {
  children: ReactNode;
}

const MaintenanceGate = ({ children }: MaintenanceGateProps) => {
  const { user } = useAuth();
  const { isUnderMaintenance, state } = useMaintenance();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role ?? '';
  const blocked = isUnderMaintenance(location.pathname, role);

  if (!blocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md text-center"
      >
        {/* Animated icon */}
        <div className="relative inline-flex mb-8">
          <div className="h-24 w-24 rounded-3xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary/30">
            <Wrench className="h-10 w-10 text-white" />
          </div>
          {/* Orbiting dot */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-primary/60 shadow-md" />
          </motion.div>
        </div>

        {/* Text */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h1 className="text-2xl font-black text-foreground mb-2">Under Maintenance</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm mx-auto">
            {state.message || "We're making improvements to enhance your experience."}
          </p>
        </motion.div>

        {/* ETA badge */}
        {state.estimatedTime && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary mb-6"
          >
            <Clock className="h-4 w-4" />
            Back in approximately {state.estimatedTime}
          </motion.div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <Heart className="h-3.5 w-3.5 text-muted-foreground/30" />
          <div className="flex-1 h-px bg-border" />
        </div>

        <p className="text-xs text-muted-foreground mb-6">
          We apologize for the inconvenience. Please check back soon.
        </p>

        {/* Go back button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mx-auto rounded-2xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </motion.button>
      </motion.div>
    </div>
  );
};

export default MaintenanceGate;