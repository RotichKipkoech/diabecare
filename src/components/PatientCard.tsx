import { Patient } from '@/types/patient';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Pill, CalendarDays, Stethoscope } from 'lucide-react';

interface PatientCardProps {
  patient: Patient;
  index?: number;
}

const statusStyles: any = {
  stable: { bg: 'bg-success/10', text: 'text-success', label: 'Stable' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', label: 'Warning' },
  critical: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Critical' },
};

const PatientCard = ({ patient, index = 0 }: PatientCardProps) => {
  const navigate = useNavigate();

  const status =
    statusStyles[patient.status?.toLowerCase()] ||
    statusStyles['stable'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => navigate(`/patients/${patient.id}`)}
      className="group rounded-xl border border-border bg-card p-4 shadow-card cursor-pointer transition-all hover:shadow-card-hover hover:border-primary/20"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: avatar + info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar — photo if available, initials otherwise */}
          <div className="flex-shrink-0">
            {(patient as any).avatar_url ? (
              <img
                src={(patient as any).avatar_url}
                alt={patient.name}
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold font-display text-sm">
                {patient.name?.split(' ').map((n: string) => n[0]).join('')}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm truncate">
              {patient.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {patient.age}y • {patient.diabetes_type} • HbA1c: {patient.hba1c}%
            </p>
            {(patient as any).assigned_doctor_name && (
              <div className="flex items-center gap-1 mt-0.5">
                <Stethoscope className="h-3 w-3 text-primary/60 flex-shrink-0" />
                <span className="text-[11px] text-primary/70 font-medium truncate">{(patient as any).assigned_doctor_name}</span>
              </div>
            )}
            {/* Visit info — hidden on xs, shown sm+ */}
            <div className="hidden sm:flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                <span>Last: {patient.last_visit ?? 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3 text-primary" />
                <span className="text-primary font-medium">Next: {patient.next_visit ?? 'Not scheduled'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: status + arrow */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Pill className="h-3 w-3" />
              <span>{patient.medications?.length ?? 0}</span>
              <span className="text-muted-foreground/60">•</span>
              <span>{patient.adherence_rate ?? 0}%</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Visit info on xs only */}
      <div className="flex sm:hidden items-center gap-3 mt-2 ml-[52px] text-[11px] text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          <span>Last: {patient.last_visit ?? 'N/A'}</span>
        </div>
        <div className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3 text-primary" />
          <span className="text-primary font-medium">Next: {patient.next_visit ?? 'Not scheduled'}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default PatientCard;