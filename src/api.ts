import type {
  CohortAnalytics,
  CounselorAlert,
  EnrollmentStatus,
  InterventionLog,
  StudentRecord,
  SystemConfig,
  UserAccount,
  UserRole,
} from './types';

export interface RequestAuthContext {
  getToken: () => Promise<string>;
}

async function request<T>(
  path: string,
  authCtx: RequestAuthContext,
  options?: RequestInit
): Promise<T> {
  const demoUserUid = await authCtx.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-demo-user-id': demoUserUid,
  };

  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export interface BootstrapPayload {
  user: UserAccount;
  baseRole: UserRole;
  config: SystemConfig;
  students?: StudentRecord[];
  alerts?: CounselorAlert[];
  analytics?: CohortAnalytics;
  interventions?: InterventionLog[];
  users?: UserAccount[];
  myStudent?: StudentRecord | null;
}

export const api = {
  bootstrap: (authCtx: RequestAuthContext) =>
    request<BootstrapPayload>('/api/bootstrap', authCtx),

  getStudent: (authCtx: RequestAuthContext, studentId: string) =>
    request<{ student: StudentRecord; interventions: InterventionLog[] }>(
      `/api/students/${encodeURIComponent(studentId)}`,
      authCtx
    ),

  createStudent: (
    authCtx: RequestAuthContext,
    payload: {
      student_id: string;
      name: string;
      email?: string;
      program: string;
      term?: string;
      enrollment_status: EnrollmentStatus;
      attendance_pct: number;
      test_score: number;
      assignment_pct: number;
    }
  ) =>
    request<{
      student: StudentRecord;
      outcome: {
        probabilityScore: number;
        riskLevel: string;
        alertTriggered: boolean;
        outreachTriggered: boolean;
      };
    }>('/api/students', authCtx, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateStudentMetrics: (
    authCtx: RequestAuthContext,
    studentId: string,
    payload: {
      attendance_pct: number;
      test_score: number;
      assignment_pct: number;
      enrollment_status?: EnrollmentStatus;
      notes?: string;
    }
  ) =>
    request<{
      student: StudentRecord;
      outcome: {
        probabilityScore: number;
        riskLevel: string;
        alertTriggered: boolean;
        outreachTriggered: boolean;
      };
    }>(`/api/students/${encodeURIComponent(studentId)}/metrics`, authCtx, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bulkIngest: (
    authCtx: RequestAuthContext,
    rows: Array<{
      student_id: string;
      name?: string;
      program?: string;
      enrollment_status?: EnrollmentStatus;
      attendance_pct: number;
      test_score: number;
      assignment_pct: number;
      recorded_date?: string;
      notes?: string;
    }>
  ) =>
    request<{
      processed: number;
      alertsTriggered: number;
      outreachStarted: number;
      students: StudentRecord[];
    }>('/api/students/bulk-ingest', authCtx, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  updateConfig: (
    authCtx: RequestAuthContext,
    payload: Partial<SystemConfig>
  ) =>
    request<{
      config: SystemConfig;
      newlyFlagged: number;
      students: StudentRecord[];
    }>('/api/config', authCtx, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  createUser: (
    authCtx: RequestAuthContext,
    payload: {
      name: string;
      email: string;
      role: UserRole;
      title?: string;
      linked_student_id?: string | null;
    }
  ) =>
    request<{ user: UserAccount }>('/api/users', authCtx, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (
    authCtx: RequestAuthContext,
    targetUserId: number,
    payload: { active?: boolean; role?: UserRole; title?: string }
  ) =>
    request<{ user: UserAccount }>(`/api/users/${targetUserId}`, authCtx, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateAlertStatus: (
    authCtx: RequestAuthContext,
    alertId: number,
    status: 'Unread' | 'Acknowledged' | 'Resolved'
  ) =>
    request<{ alerts: CounselorAlert[] }>(`/api/alerts/${alertId}`, authCtx, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  logIntervention: (
    authCtx: RequestAuthContext,
    payload: {
      student_id: string;
      log_type: 'counselor_session' | 'scheduled_meeting';
      content: string;
      scheduled_for?: string | null;
    }
  ) =>
    request<{ intervention: InterventionLog }>('/api/interventions', authCtx, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendChatMessage: (
    authCtx: RequestAuthContext,
    payload: { student_id?: string; message: string }
  ) =>
    request<{
      reply: string;
      crisisEscalated: boolean;
      interventions: InterventionLog[];
    }>('/api/chat', authCtx, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateAiBrief: (authCtx: RequestAuthContext, studentId: string) =>
    request<{ brief: string }>(
      `/api/students/${encodeURIComponent(studentId)}/ai-brief`,
      authCtx,
      { method: 'POST' }
    ),
};
