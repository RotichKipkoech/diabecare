import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const API_URL = import.meta.env.VITE_API_URL || "https://diabecare.onrender.com/api";

const STORAGE_KEY = 'diabecare_maintenance';

export interface MaintenancePage {
  id: string;
  label: string;
  path: string;
  roles: ('doctor' | 'patient')[];
}

export const MAINTAINABLE_PAGES: MaintenancePage[] = [
  { id: 'dashboard',     label: 'Dashboard',            path: '/',                     roles: ['doctor', 'patient'] },
  { id: 'appointments',  label: 'Appointments',          path: '/appointments',         roles: ['doctor', 'patient'] },
  { id: 'medications',   label: 'Medications',           path: '/medications',          roles: ['doctor'] },
  { id: 'patients',      label: 'Patients',              path: '/patients',             roles: ['doctor'] },
  { id: 'health-report', label: 'Health Report',         path: '/health-report',        roles: ['doctor'] },
  { id: 'profile',       label: 'My Profile (Patient)',  path: '/profile',              roles: ['patient'] },
  { id: 'my-profile',    label: 'My Profile (Staff)',    path: '/my-profile',           roles: ['doctor'] },
  { id: 'settings',      label: 'Settings',              path: '/settings',             roles: ['doctor', 'patient'] },
  { id: 'request-appt',  label: 'Request Appointment',   path: '/appointments/request', roles: ['patient'] },
];

export interface MaintenanceState {
  pages: Record<string, boolean>;
  message: string;
  estimatedTime: string;
}

const defaultState: MaintenanceState = {
  pages: {},
  message: "We're making improvements to enhance your experience.",
  estimatedTime: '',
};

function loadLocal(): MaintenanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState, ...JSON.parse(raw) };
  } catch {}
  return defaultState;
}

function saveLocal(state: MaintenanceState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

async function fetchFromBackend(): Promise<MaintenanceState | null> {
  try {
    const res = await fetch(`${API_URL}/auth/maintenance`);
    if (!res.ok) return null;
    const data = await res.json();
    return { ...defaultState, ...data };
  } catch {
    return null;
  }
}

async function saveToBackend(state: MaintenanceState): Promise<void> {
  const token = localStorage.getItem('access_token');
  await fetch(`${API_URL}/auth/maintenance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(state),
  });
}

interface MaintenanceContextValue {
  state: MaintenanceState;
  isUnderMaintenance: (path: string, role: string) => boolean;
  togglePage: (id: string) => void;
  setMessage: (msg: string) => void;
  setEstimatedTime: (time: string) => void;
  activeCount: number;
  refresh: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

export const MaintenanceProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<MaintenanceState>(loadLocal);

  // On mount: fetch from backend (source of truth), fall back to localStorage
  const refresh = useCallback(async () => {
    const remote = await fetchFromBackend();
    if (remote) {
      setState(remote);
      saveLocal(remote);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-fetch every 60s so non-admin users get updates without reloading
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setState({ ...defaultState, ...JSON.parse(e.newValue) }); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const persist = useCallback((next: MaintenanceState) => {
    setState(next);
    saveLocal(next);
    saveToBackend(next).catch(() => {});
  }, []);

  const togglePage = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, pages: { ...prev.pages, [id]: !prev.pages[id] } };
      saveLocal(next);
      saveToBackend(next).catch(() => {});
      return next;
    });
  }, []);

  const setMessage = useCallback((message: string) => {
    setState(prev => { const next = { ...prev, message }; persist(next); return next; });
  }, [persist]);

  const setEstimatedTime = useCallback((estimatedTime: string) => {
    setState(prev => { const next = { ...prev, estimatedTime }; persist(next); return next; });
  }, [persist]);

  const isUnderMaintenance = useCallback((path: string, role: string) => {
    if (role === 'admin') return false;
    const page = MAINTAINABLE_PAGES.find(p =>
      path === p.path || (p.path !== '/' && path.startsWith(p.path))
    );
    if (!page) return false;
    if (!page.roles.includes(role as any)) return false;
    return !!state.pages[page.id];
  }, [state.pages]);

  const activeCount = Object.values(state.pages).filter(Boolean).length;

  return (
    <MaintenanceContext.Provider value={{ state, isUnderMaintenance, togglePage, setMessage, setEstimatedTime, activeCount, refresh }}>
      {children}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error('useMaintenance must be used within MaintenanceProvider');
  return ctx;
};