import {
  createContext, useContext, useState, useEffect, useRef,
  useCallback, ReactNode, Dispatch, SetStateAction,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

export type UserRole = "admin" | "doctor" | "patient";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  avatar_url?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: (reason?: "manual" | "inactivity") => void;
  isAuthenticated: boolean;
  initializing: boolean;
  refreshUser: () => Promise<void>;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ── Constants ────────────────────────────────────────────────────────────────
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;   // 10 minutes → auto logout
const WARNING_BEFORE     = 60 * 1000;        // show warning 1 minute before logout
const ACTIVITY_EVENTS    = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

// ── Session Warning Modal ────────────────────────────────────────────────────
const SessionWarningModal = ({
  secondsLeft,
  onStay,
  onLogout,
}: {
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}) => (
  <AnimatePresence>
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted w-full">
          <motion.div
            className="h-full bg-amber-500"
            initial={{ width: "100%" }}
            animate={{ width: `${(secondsLeft / 60) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>

        <div className="p-6 text-center">
          {/* Icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <svg className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          <h2 className="text-base font-black text-foreground mb-1">Session Expiring Soon</h2>
          <p className="text-sm text-muted-foreground mb-1">
            You've been inactive for a while.
          </p>
          <p className="text-2xl font-black text-amber-500 mb-5 tabular-nums">
            {secondsLeft}s
          </p>

          <div className="flex gap-3">
            <button
              onClick={onLogout}
              className="flex-1 rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-all"
            >
              Log Out
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStay}
              className="flex-1 rounded-2xl gradient-primary px-4 py-2.5 text-sm font-black text-white shadow-md hover:opacity-90 transition-all"
            >
              Stay Logged In
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  </AnimatePresence>
);

// ── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("access_token")
  );
  const [showWarning, setShowWarning]   = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [secondsLeft, setSecondsLeft]   = useState(60);

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Logout — calls backend to blacklist token ───────────────────
  const logout = useCallback(async (reason: "manual" | "inactivity" = "manual") => {
    const currentToken = localStorage.getItem("access_token");
    if (currentToken) {
      // Fire-and-forget — don't block UI on network
      fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ reason }),
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    setShowWarning(false);
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  }, []);

  // ── Clear all timers ────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current)    clearTimeout(warningTimer.current);
    if (countdownRef.current)    clearInterval(countdownRef.current);
  }, []);

  // ── Reset inactivity clock ──────────────────────────────────────
  const resetInactivity = useCallback(() => {
    if (!localStorage.getItem("access_token")) return;
    clearTimers();
    setShowWarning(false);

    // Show warning 1 min before timeout
    warningTimer.current = setTimeout(() => {
      setSecondsLeft(60);
      setShowWarning(true);
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    // Auto logout after full timeout
    inactivityTimer.current = setTimeout(() => {
      logout("inactivity");
    }, INACTIVITY_TIMEOUT);
  }, [clearTimers, logout]);

  // ── Attach activity listeners when logged in ────────────────────
  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }
    resetInactivity();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetInactivity, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetInactivity));
    };
  }, [user, resetInactivity, clearTimers]);

  // ── Login ───────────────────────────────────────────────────────
  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    const accessToken = data.token || data.access_token;
    if (!accessToken) throw new Error("No token returned from server");
    setToken(accessToken);
    setUser(data.user);
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  // ── Refresh user ────────────────────────────────────────────────
  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to refresh user");
      const data = await res.json();
      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
    } catch {
      logout("manual");
    }
  };

  // Auto-refresh on mount if token exists — set initializing=false when done
  useEffect(() => {
    if (token && !user) {
      refreshUser().finally(() => setInitializing(false));
    } else {
      setInitializing(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!user, initializing, refreshUser, setUser }}
    >
      {children}

      {/* Session warning modal — rendered at root level */}
      {showWarning && (
        <SessionWarningModal
          secondsLeft={secondsLeft}
          onStay={() => {
            resetInactivity();
            setShowWarning(false);
          }}
          onLogout={() => logout("manual")}
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};