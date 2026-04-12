import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Pill, CalendarDays, UserPlus,
  Heart, UserCog, Settings2, UserCircle, UserCheck,
  Settings, ClipboardList, PlusCircle, User, FileBarChart2,
  Menu, X, MessageSquare, Radio, Stethoscope,
} from 'lucide-react';
import { useAuth, UserRole } from '@/contexts/AuthContext';

type NavItem = { path: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[] };

const navItems: NavItem[] = [
  { path: '/',                      label: 'Dashboard',           icon: LayoutDashboard, roles: ['admin', 'doctor', 'patient'] },
  { path: '/users',                 label: 'User Management',     icon: UserCog,         roles: ['admin'] },
  { path: '/dashboard-features',   label: 'Dashboard Features',  icon: Settings2,       roles: ['admin'] },
  { path: '/activity-log',         label: 'Activity Log',         icon: ClipboardList,   roles: ['admin'] },
  { path: '/add-patient',          label: 'Add Patient',          icon: UserPlus,        roles: ['admin'] },
  { path: '/patients',             label: 'Patients',             icon: Users,           roles: ['admin', 'doctor'] },
  { path: '/medications',          label: 'Medications',          icon: Pill,            roles: ['admin', 'doctor'] },
  { path: '/health-report',        label: 'Health Report',        icon: FileBarChart2,   roles: ['admin', 'doctor'] },
  { path: '/appointments',         label: 'Appointments',         icon: CalendarDays,    roles: ['admin', 'doctor', 'patient'] },
  { path: '/appointments/request', label: 'Request Appointment',  icon: PlusCircle,      roles: ['patient'] },
  { path: '/profile',              label: 'My Profile',           icon: UserCircle,      roles: ['patient'] },
  { path: '/broadcast',            label: 'Broadcast',            icon: Radio,           roles: ['admin', 'doctor'] },
  { path: '/sms-logs',             label: 'SMS Logs',             icon: MessageSquare,   roles: ['admin'] },
  { path: '/reassign-patients',     label: 'Reassign Patients',    icon: UserCheck,       roles: ['admin'] },
  { path: '/doctor-management',    label: 'Doctor Management',    icon: Stethoscope,     roles: ['admin'] },
  { path: '/my-profile',           label: 'My Profile',           icon: User,            roles: ['admin', 'doctor'] },
  { path: '/settings',             label: 'Settings',             icon: Settings,        roles: ['admin', 'doctor', 'patient'] },
];

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role: UserRole = user?.role || 'admin';
  const displayName = user?.full_name || 'User';
  const visibleItems = navItems.filter(item => item.roles.includes(role));


  const renderItem = (item: NavItem) => {
    const isActive =
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className="relative block"
      >
        {isActive && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-lg bg-sidebar-accent"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        <div className={`relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'text-sidebar-primary'
            : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        }`}>
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{item.label}</span>
          {item.path === '/appointments/request' && (
            <span className="ml-auto text-[9px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">NEW</span>
          )}
        </div>
      </Link>
    );
  };

  const sidebarInner = (
    <div className="h-full w-64 gradient-hero flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary flex-shrink-0">
          <Heart className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold font-display text-sidebar-foreground">DiabeCare</h1>
          <p className="text-xs text-sidebar-muted">Medication Tracker</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden text-sidebar-muted hover:text-sidebar-foreground transition-colors flex-shrink-0"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(renderItem)}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between px-2">
          <Link
            to={role === 'patient' ? '/profile' : '/my-profile'}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 group flex-1 min-w-0"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName}
                className="h-8 w-8 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/30"
              />
            ) : (
              <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-xs">
                {displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate group-hover:text-sidebar-primary transition-colors">
                {displayName}
              </p>
              <p className="text-[11px] text-sidebar-muted capitalize">{role}</p>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop: fixed sidebar ── */}
      <div className="hidden lg:block fixed left-0 top-0 z-40 h-screen w-64">
        {sidebarInner}
      </div>

      {/* ── Mobile: sticky top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between gradient-hero px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary flex-shrink-0">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold font-display text-sidebar-foreground">DiabeCare</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ── Mobile: slide-in drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-50 h-screen lg:hidden"
            >
              {sidebarInner}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;