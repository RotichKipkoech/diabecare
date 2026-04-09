import { ReactNode, useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationPanel from './NotificationPanel';
import { Sun, Moon, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const Layout = ({ children, title, subtitle }: LayoutProps) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = user?.role || 'patient';
  const displayName = user?.full_name || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const profilePath = role === 'patient' ? '/profile' : '/my-profile';

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div className="lg:pl-64 pt-[52px] lg:pt-0">
        {/* Top bar */}
        <header className="sticky top-[52px] lg:top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 lg:py-4 gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold font-display text-foreground truncate">{title}</h1>
            {subtitle && <p className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-2 sm:ml-4 flex-shrink-0">

            {/* ── Dark / Light mode toggle ── */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground transition-colors overflow-hidden"
            >
              <Sun className={`absolute h-4 w-4 transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} />
              <Moon className={`absolute h-4 w-4 transition-all duration-300 ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
            </button>

            {/* ── Notifications ── */}
            <NotificationPanel />

            {/* ── Profile dropdown ── */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="flex items-center gap-1.5"
                title={displayName}
              >
                {/* Round avatar */}
                <div className="relative h-8 w-8 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-[10px]">
                      {initials}
                    </div>
                  )}
                </div>
                {/* Small chevron */}
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
                  >
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                      <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <Link
                        to={profilePath}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        My Profile
                      </Link>

                      <Link
                        to="/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        Settings
                      </Link>

                      <div className="mx-3 my-1 h-px bg-border/50" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Log Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;