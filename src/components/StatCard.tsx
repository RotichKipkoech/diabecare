import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  delay?: number;
}

const variantStyles = {
  default: 'bg-card',
  primary: 'gradient-primary text-primary-foreground',
  success: 'bg-card border-l-4 border-l-success',
  warning: 'bg-card border-l-4 border-l-warning',
  danger: 'bg-card border-l-4 border-l-destructive',
};

const iconVariantStyles = {
  default: 'bg-secondary text-secondary-foreground',
  primary: 'bg-primary-foreground/20 text-primary-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

const StatCard = ({ title, value, icon: Icon, trend, trendUp, variant = 'default', delay = 0 }: StatCardProps) => {
  const isPrimary = variant === 'primary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-xl border border-border p-5 shadow-card ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${isPrimary ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {title}
          </p>
          <p className={`mt-2 text-3xl font-bold font-display ${isPrimary ? '' : 'text-foreground'}`}>
            {value}
          </p>
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trendUp ? 'text-success' : 'text-destructive'} ${isPrimary ? '!text-primary-foreground/80' : ''}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconVariantStyles[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
