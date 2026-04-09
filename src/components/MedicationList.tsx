import { Medication } from '@/types/patient';
import { Check, X, Clock, RefreshCcw, AlertTriangle } from 'lucide-react';

interface MedicationListProps {
  medications: Medication[];
  onToggle?: (medId: string, taken: boolean) => void;
  role?: 'admin' | 'doctor' | 'patient';
  togglingIds?: Record<string, boolean>;
}

function getRefillStatus(refillDate?: string): { label: string; color: string; urgent: boolean } | null {
  if (!refillDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const refill = new Date(refillDate);
  refill.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((refill.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // 3+ days overdue: backend will have already removed this medication —
  // this label is a safeguard in case the component receives stale data.
  if (daysUntil <= -3) return {
    label: `Refill ${Math.abs(daysUntil)}d overdue — will be removed`,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    urgent: true,
  };
  // 1-2 days overdue: still active, patient can still mark taken/missed
  if (daysUntil < 0) return {
    label: `Refill overdue by ${Math.abs(daysUntil)}d — collect soon`,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    urgent: true,
  };
  if (daysUntil === 0) return {
    label: 'Refill due today — collect now',
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    urgent: true,
  };
  if (daysUntil <= 7) return {
    label: `Refill in ${daysUntil}d`,
    color: 'text-warning bg-warning/10 border-warning/20',
    urgent: true,
  };
  return {
    label: `Refill ${refill.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    color: 'text-muted-foreground bg-muted border-border',
    urgent: false,
  };
}

const MedicationList = ({ medications, onToggle, role, togglingIds = {} }: MedicationListProps) => {
  const isPatient = role === 'patient';

  // Never show completed (auto-removed or doctor-completed) medications
  const activeMeds     = medications.filter((m) => !(m as any).completed);
  const completedCount = medications.length - activeMeds.length;

  return (
    <div className="space-y-3">
      {completedCount > 0 && (
        <p className="text-[11px] text-muted-foreground px-1">
          {completedCount} completed medication{completedCount !== 1 ? 's' : ''} hidden
        </p>
      )}
      {activeMeds.map((med) => {
        const takenToday = med.taken_today;
        // Support both refill_date (backend/PatientDetail) and refillDate (PatientDashboard mapping)
        const refillRaw = (med as any).refill_date || (med as any).refillDate;
        const refillStatus = getRefillStatus(refillRaw);

        return (
          <div
            key={med.id}
            className={`rounded-lg border p-3 sm:p-4 transition-colors ${
              takenToday
                ? 'border-success/20 bg-success/5'
                : 'border-destructive/20 bg-destructive/5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              {/* Left Side */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                  takenToday ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                }`}>
                  {takenToday ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{med.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{med.dosage} • {med.frequency}</p>
                  {med.time && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      {med.time}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Patient Toggle */}
                {isPatient && onToggle && (
                  <div className="flex flex-col xs:flex-row gap-1.5">
                    <button
                      onClick={() => onToggle(med.id, true)}
                      disabled={togglingIds[med.id]}
                      className={`flex items-center justify-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        takenToday
                          ? 'bg-success text-white'
                          : 'bg-muted text-muted-foreground hover:bg-success/20 hover:text-success'
                      }`}
                    >
                      {togglingIds[med.id] ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" /> : <Check className="h-3 w-3" />} Taken
                    </button>
                    <button
                      onClick={() => onToggle(med.id, false)}
                      disabled={togglingIds[med.id]}
                      className={`flex items-center justify-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        takenToday === false
                          ? 'bg-destructive text-white'
                          : 'bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive'
                      }`}
                    >
                      {togglingIds[med.id] ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" /> : <X className="h-3 w-3" />} Missed
                    </button>
                  </div>
                )}

                {/* Doctor/Admin Badge */}
                {!isPatient && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    takenToday ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {takenToday ? 'Taken' : 'Missed'}
                  </span>
                )}
              </div>
            </div>

            {/* Refill Date Row — shown to everyone, prominent when urgent */}
            {refillStatus && (
              <div className={`mt-3 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium ${refillStatus.color}`}>
                {refillStatus.urgent
                  ? <AlertTriangle className="h-3 w-3 shrink-0" />
                  : <RefreshCcw className="h-3 w-3 shrink-0" />
                }
                {refillStatus.label}
              </div>
            )}
          </div>
        );
      })}

      {activeMeds.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">No medications prescribed.</p>
      )}
    </div>
  );
};

export default MedicationList;