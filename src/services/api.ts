const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Shared types ─────────────────────────────────────────────────────────────
type AnyRecord = Record<string, unknown>;

// ── Notifications API ─────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => request<AnyRecord[]>("/notifications"),
  markRead: (id: number) =>
    id === -1
      ? request<AnyRecord>("/notifications/mark-all-read", { method: "PUT" })
      : request<AnyRecord>(`/notifications/${id}/read`, { method: "PUT" }),
  delete: (id: number) => request<AnyRecord>(`/notifications/${id}`, { method: "DELETE" }),
};

// ── Users / Auth API ──────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: AnyRecord }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  listUsers: () => request<AnyRecord[]>("/auth/users"),
  registerUser: (data: AnyRecord) =>
    request<AnyRecord>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: AnyRecord) =>
    request<AnyRecord>(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    request<AnyRecord>(`/auth/users/${id}`, { method: "DELETE" }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    request<AnyRecord>("/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
  updateProfile: (data: { full_name?: string; email?: string; phone?: string }) =>
    request<AnyRecord>("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),
  getActivityLog: () => request<AnyRecord[]>("/auth/activity-log"),
};

// ── Stats API ─────────────────────────────────────────────────────────────────
export const statsApi = {
  dashboard: () => request<AnyRecord>("/stats/dashboard"),
};

// ── Appointments API ──────────────────────────────────────────────────────────
export const appointmentsApi = {
  list: () => request<AnyRecord[]>("/appointments"),
  create: (data: AnyRecord) =>
    request<AnyRecord>("/appointments", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: AnyRecord) =>
    request<AnyRecord>(`/appointments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<AnyRecord>(`/appointments/${id}`, { method: "DELETE" }),
  request: (data: { requested_date: string; type: string; notes?: string }) =>
    request<AnyRecord>("/appointments/request", { method: "POST", body: JSON.stringify(data) }),
};

// ── Patients API ──────────────────────────────────────────────────────────────
export const patientsApi = {
  list: () => request<AnyRecord[]>("/patients"),
  get: (id: number) => request<AnyRecord>(`/patients/${id}`),
  create: (data: AnyRecord) =>
    request<AnyRecord>("/patients", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: AnyRecord) =>
    request<AnyRecord>(`/patients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<AnyRecord>(`/patients/${id}`, { method: "DELETE" }),
};

// ── Features API ──────────────────────────────────────────────────────────────
export const featuresApi = {
  list: () => request<AnyRecord[]>("/features"),
  create: (data: AnyRecord) =>
    request<{ feature: AnyRecord }>("/features", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: AnyRecord) =>
    request<{ feature: AnyRecord }>(`/features/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: number) =>
    request<{ feature: AnyRecord }>(`/features/${id}/toggle`, { method: "PUT" }),
  delete: (id: number) =>
    request<AnyRecord>(`/features/${id}`, { method: "DELETE" }),
};

// ── Medications API ───────────────────────────────────────────────────────────
export const medicationsApi = {
  listByPatient: (patientId: number | string) =>
    request<AnyRecord[]>(`/medications/patientf/${Number(patientId)}`),
  create: (data: AnyRecord) =>
    request<AnyRecord>("/medications", { method: "POST", body: JSON.stringify(data) }),
  markTaken: (id: number, taken: boolean) =>
    request<AnyRecord>(`/medications/${id}/toggle`, {
      method: "PUT",
      body: JSON.stringify({ taken }),
    }),
  delete: (id: number) =>
    request<AnyRecord>(`/medications/${id}`, { method: "DELETE" }),
  updateRefill: (id: number, refill_date: string | null) =>
    request<AnyRecord>(`/medications/${id}`, { method: "PUT", body: JSON.stringify({ refill_date }) }),
  markComplete: (id: number) =>
    request<AnyRecord>(`/medications/${id}`, { method: "PUT", body: JSON.stringify({ completed: true }) }),
};

// ── SMS Logs API (admin only) ─────────────────────────────────────────────
export const smsLogsApi = {
  getLogs: (params?: { page?: number; per_page?: number; status?: string; category?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page)     q.set('page',     String(params.page));
    if (params?.per_page) q.set('per_page', String(params.per_page));
    if (params?.status)   q.set('status',   params.status);
    if (params?.category) q.set('category', params.category);
    if (params?.search)   q.set('search',   params.search);
    return request<AnyRecord>(`/sms/logs?${q.toString()}`);
  },
  getStats: () => request<AnyRecord>('/sms/logs/stats'),
  clearLogs: () => request<AnyRecord>('/sms/logs', { method: 'DELETE' }),
  retrySms: (logId: number) => request<AnyRecord>(`/sms/logs/${logId}/retry`, { method: 'POST' }),
};

// ── Reassign API (admin only) ─────────────────────────────────────────────
export const reassignApi = {
  reassignPatient: (patientId: number, doctorId: number) =>
    request<AnyRecord>(`/patients/${patientId}/reassign`, {
      method: 'PUT',
      body: JSON.stringify({ doctor_id: doctorId }),
    }),
  reassignBulk: (fromDoctorId: number, toDoctorId: number) =>
    request<AnyRecord>('/patients/reassign-bulk', {
      method: 'PUT',
      body: JSON.stringify({ from_doctor_id: fromDoctorId, to_doctor_id: toDoctorId }),
    }),
};