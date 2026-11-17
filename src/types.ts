export type UserRole = 'admin' | 'counselor' | 'student';
export type EnrollmentStatus = 'Active' | 'Probation' | 'Dropped';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertStatus = 'Unread' | 'Acknowledged' | 'Resolved';
export type InterventionLogType =
  | 'ai_outreach'
  | 'ai_chat'
  | 'counselor_session'
  | 'scheduled_meeting'
  | 'escalation';

export interface UserAccount {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  linked_student_id: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
}

export interface SystemConfig {
  id: number;
  high_risk_threshold: number;
  medium_risk_threshold: number;
  weight_attendance: number;
  weight_test_score: number;
  weight_assignment: number;
  updated_at: string;
}

export interface MetricPoint {
  id: number;
  student_id: string;
  recorded_date: string;
  attendance_pct: number;
  test_score: number;
  assignment_pct: number;
  notes: string | null;
}

export interface RiskFactor {
  code: string;
  label: string;
  detail: string;
  impact: number;
  severity: 'high' | 'medium' | 'positive';
}

export interface RiskAssessment {
  id: number;
  student_id: string;
  probability_score: number;
  risk_level: RiskLevel;
  contributing_factors: RiskFactor[];
  model_summary: string;
  assessed_at: string;
}

export interface StudentRecord {
  student_id: string;
  name: string;
  email: string;
  program: string;
  term: string;
  enrollment_status: EnrollmentStatus;
  assigned_counselor_id: string;
  assigned_counselor_name: string;
  attendance_pct: number;
  test_score: number;
  assignment_pct: number;
  updated_at: string;
  assessment: RiskAssessment;
  metrics_history: MetricPoint[];
}

export interface CounselorAlert {
  id: number;
  student_id: string;
  student_name: string;
  student_program: string;
  counselor_id: string;
  counselor_name: string;
  trigger_reason: string;
  severity: 'URGENT' | 'HIGH';
  probability_score: number;
  contributing_factors: RiskFactor[];
  status: AlertStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface InterventionLog {
  id: number;
  student_id: string;
  student_name?: string;
  actor_role: 'ai_counselor' | 'counselor' | 'student' | 'system';
  actor_name: string;
  log_type: InterventionLogType;
  content: string;
  scheduled_for: string | null;
  created_at: string;
}

export interface CohortAnalytics {
  total_students: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  unread_alerts_count: number;
  avg_attendance: number;
  avg_test_score: number;
  avg_assignment_pct: number;
  trend_series: Array<{
    date: string;
    avg_attendance: number;
    avg_test_score: number;
    avg_assignment: number;
  }>;
  risk_distribution: Array<{
    bucket: string;
    count: number;
    level: RiskLevel;
  }>;
}
