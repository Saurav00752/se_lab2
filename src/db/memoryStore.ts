import { computeStudentRisk } from '../../server/riskEngine.ts';
import type {
  AlertStatus,
  CohortAnalytics,
  CounselorAlert,
  EnrollmentStatus,
  InterventionLog,
  MetricPoint,
  RiskAssessment,
  RiskLevel,
  StudentRecord,
  SystemConfig,
  UserAccount,
  UserRole,
} from '../types.ts';

interface MemoryState {
  initialized: boolean;
  nextId: number;
  config: SystemConfig;
  users: UserAccount[];
  students: Map<string, Omit<StudentRecord, 'assessment' | 'metrics_history'>>;
  metrics: Map<string, MetricPoint[]>;
  assessments: Map<string, RiskAssessment>;
  alerts: CounselorAlert[];
  interventions: InterventionLog[];
}

declare global {
  var _beaconMemoryState: MemoryState | undefined;
}

function getState(): MemoryState {
  if (!global._beaconMemoryState) {
    global._beaconMemoryState = {
      initialized: false,
      nextId: 100,
      config: {
        id: 1,
        high_risk_threshold: 0.7,
        medium_risk_threshold: 0.4,
        weight_attendance: 0.4,
        weight_test_score: 0.35,
        weight_assignment: 0.25,
        updated_at: '2026-11-16T09:30:00.000Z',
      },
      users: [],
      students: new Map(),
      metrics: new Map(),
      assessments: new Map(),
      alerts: [],
      interventions: [],
    };
  }
  if (!global._beaconMemoryState.initialized) {
    seedMemoryState(global._beaconMemoryState);
  }
  return global._beaconMemoryState;
}

function seedMemoryState(state: MemoryState): void {
  const now = '2026-11-16T09:30:00.000Z';

  state.users = [
    {
      id: 1,
      uid: 'demo-admin-01',
      name: 'Dr. Eleanor Vance',
      email: 'e.vance@beacon.edu',
      role: 'admin',
      title: 'Dean of Academic Success',
      linked_student_id: null,
      avatar_url: '/src/assets/images/avatar_admin_dean_1794852022861.jpg',
      active: true,
      created_at: now,
    },
    {
      id: 2,
      uid: 'demo-counselor-01',
      name: 'Marcus Sterling, LPC',
      email: 'm.sterling@beacon.edu',
      role: 'counselor',
      title: 'Senior Academic Counselor',
      linked_student_id: null,
      avatar_url: '/src/assets/images/avatar_counselor_advisor_1794852023500.jpg',
      active: true,
      created_at: now,
    },
    {
      id: 3,
      uid: 'demo-counselor-02',
      name: 'Priya Nair, M.Ed.',
      email: 'p.nair@beacon.edu',
      role: 'counselor',
      title: 'Student Retention Advisor',
      linked_student_id: null,
      avatar_url: null,
      active: true,
      created_at: now,
    },
    {
      id: 4,
      uid: 'demo-student-01',
      name: 'Maya Lin',
      email: 'maya.lin@student.beacon.edu',
      role: 'student',
      title: 'B.S. Computer Science · Junior',
      linked_student_id: 'STU-1042',
      avatar_url: '/src/assets/images/avatar_student_scholar_1794852023888.jpg',
      active: true,
      created_at: now,
    },
    {
      id: 5,
      uid: 'demo-student-02',
      name: 'Jordan Alvarez',
      email: 'jordan.alvarez@student.beacon.edu',
      role: 'student',
      title: 'B.A. Economics · Sophomore',
      linked_student_id: 'STU-1087',
      avatar_url: null,
      active: true,
      created_at: now,
    },
    {
      id: 6,
      uid: 'demo-student-03',
      name: 'Elena Rostova',
      email: 'elena.rostova@student.beacon.edu',
      role: 'student',
      title: 'B.S. Biology · Freshman',
      linked_student_id: 'STU-1104',
      avatar_url: null,
      active: true,
      created_at: now,
    },
  ];

  interface SeedStudent {
    student_id: string;
    name: string;
    email: string;
    program: string;
    term: string;
    enrollment_status: EnrollmentStatus;
    assigned_counselor_name: string;
    series: Array<{ date: string; att: number; test: number; assign: number; note?: string }>;
  }

  const seedStudents: SeedStudent[] = [
    {
      student_id: 'STU-1042',
      name: 'Maya Lin',
      email: 'maya.lin@student.beacon.edu',
      program: 'B.S. Computer Science',
      term: 'Fall 2026',
      enrollment_status: 'Probation',
      assigned_counselor_name: 'Marcus Sterling, LPC',
      series: [
        { date: '2026-10-05', att: 88, test: 76, assign: 84, note: 'Strong early semester start' },
        { date: '2026-10-12', att: 82, test: 71, assign: 75, note: 'Missed one lab section' },
        { date: '2026-10-19', att: 74, test: 65, assign: 68, note: 'Midterm pressure reported' },
        { date: '2026-10-26', att: 66, test: 58, assign: 56, note: 'Missed Algorithms quiz' },
        { date: '2026-11-02', att: 60, test: 54, assign: 48, note: 'Two consecutive lecture absences' },
        { date: '2026-11-09', att: 54, test: 51, assign: 44, note: 'Flagged by attendance monitor' },
      ],
    },
    {
      student_id: 'STU-1055',
      name: 'Devon Brooks',
      email: 'devon.brooks@student.beacon.edu',
      program: 'B.S. Mechanical Engineering',
      term: 'Fall 2026',
      enrollment_status: 'Active',
      assigned_counselor_name: 'Marcus Sterling, LPC',
      series: [
        { date: '2026-10-05', att: 80, test: 69, assign: 76 },
        { date: '2026-10-12', att: 76, test: 64, assign: 70 },
        { date: '2026-10-19', att: 68, test: 56, assign: 60 },
        { date: '2026-10-26', att: 61, test: 52, assign: 52 },
        { date: '2026-11-02', att: 55, test: 48, assign: 46 },
        { date: '2026-11-09', att: 52, test: 46, assign: 42, note: 'Thermodynamics exam score drop' },
      ],
    },
    {
      student_id: 'STU-1063',
      name: 'Nadia Patel',
      email: 'nadia.patel@student.beacon.edu',
      program: 'B.A. Psychology',
      term: 'Fall 2026',
      enrollment_status: 'Probation',
      assigned_counselor_name: 'Priya Nair, M.Ed.',
      series: [
        { date: '2026-10-05', att: 74, test: 66, assign: 72 },
        { date: '2026-10-12', att: 70, test: 62, assign: 64 },
        { date: '2026-10-19', att: 65, test: 59, assign: 58 },
        { date: '2026-10-26', att: 61, test: 55, assign: 51 },
        { date: '2026-11-02', att: 58, test: 53, assign: 49 },
        { date: '2026-11-09', att: 56, test: 50, assign: 45, note: 'Missing research methods labs' },
      ],
    },
    {
      student_id: 'STU-1087',
      name: 'Jordan Alvarez',
      email: 'jordan.alvarez@student.beacon.edu',
      program: 'B.A. Economics',
      term: 'Fall 2026',
      enrollment_status: 'Active',
      assigned_counselor_name: 'Marcus Sterling, LPC',
      series: [
        { date: '2026-10-05', att: 84, test: 72, assign: 82 },
        { date: '2026-10-12', att: 82, test: 69, assign: 78 },
        { date: '2026-10-19', att: 79, test: 66, assign: 74 },
        { date: '2026-10-26', att: 77, test: 63, assign: 71 },
        { date: '2026-11-02', att: 74, test: 61, assign: 69 },
        { date: '2026-11-09', att: 73, test: 62, assign: 70, note: 'Econometrics problem set struggles' },
      ],
    },
    {
      student_id: 'STU-1091',
      name: 'Marcus Boateng',
      email: 'marcus.boateng@student.beacon.edu',
      program: 'B.S. Data Science',
      term: 'Fall 2026',
      enrollment_status: 'Active',
      assigned_counselor_name: 'Priya Nair, M.Ed.',
      series: [
        { date: '2026-10-05', att: 78, test: 74, assign: 77 },
        { date: '2026-10-12', att: 76, test: 71, assign: 74 },
        { date: '2026-10-19', att: 75, test: 68, assign: 72 },
        { date: '2026-10-26', att: 72, test: 67, assign: 69 },
        { date: '2026-11-02', att: 74, test: 66, assign: 68 },
        { date: '2026-11-09', att: 75, test: 68, assign: 71 },
      ],
    },
    {
      student_id: 'STU-1098',
      name: 'Chloe Moreau',
      email: 'chloe.moreau@student.beacon.edu',
      program: 'B.F.A. Architecture',
      term: 'Fall 2026',
      enrollment_status: 'Active',
      assigned_counselor_name: 'Marcus Sterling, LPC',
      series: [
        { date: '2026-10-05', att: 89, test: 79, assign: 82 },
        { date: '2026-10-12', att: 85, test: 76, assign: 78 },
        { date: '2026-10-19', att: 80, test: 72, assign: 74 },
        { date: '2026-10-26', att: 76, test: 69, assign: 70 },
        { date: '2026-11-02', att: 78, test: 71, assign: 73 },
        { date: '2026-11-09', att: 80, test: 73, assign: 76 },
      ],
    },
    {
      student_id: 'STU-1104',
      name: 'Elena Rostova',
      email: 'elena.rostova@student.beacon.edu',
      program: 'B.S. Biology',
      term: 'Fall 2026',
      enrollment_status: 'Active',
      assigned_counselor_name: 'Priya Nair, M.Ed.',
      series: [
        { date: '2026-10-05', att: 94, test: 88, assign: 95 },
        { date: '2026-10-12', att: 95, test: 90, assign: 94 },
        { date: '2026-10-19', att: 93, test: 87, assign: 92 },
        { date: '2026-10-26', att: 96, test: 91, assign: 96 },
        { date: '2026-11-02', att: 94, test: 89, assign: 93 },
        { date: '2026-11-09', att: 95, test: 92, assign: 96, note: 'Dean list trajectory' },
      ],
    },
    {
      student_id: 'STU-1112',
      name: "Liam O'Connor",
      email: 'liam.oconnor@student.beacon.edu',
      program: 'B.S. Nursing',
      term: 'Fall 2026',
      enrollment_status: 'Active',
      assigned_counselor_name: 'Marcus Sterling, LPC',
      series: [
        { date: '2026-10-05', att: 91, test: 84, assign: 90 },
        { date: '2026-10-12', att: 92, test: 86, assign: 92 },
        { date: '2026-10-19', att: 90, test: 85, assign: 89 },
        { date: '2026-10-26', att: 93, test: 88, assign: 91 },
        { date: '2026-11-02', att: 91, test: 87, assign: 93 },
        { date: '2026-11-09', att: 92, test: 89, assign: 94 },
      ],
    },
    {
      student_id: 'STU-1120',
      name: 'Sora Takahashi',
      email: 'sora.takahashi@student.beacon.edu',
      program: 'B.A. History',
      term: 'Fall 2026',
      enrollment_status: 'Active',
      assigned_counselor_name: 'Priya Nair, M.Ed.',
      series: [
        { date: '2026-10-05', att: 86, test: 82, assign: 88 },
        { date: '2026-10-12', att: 88, test: 84, assign: 89 },
        { date: '2026-10-19', att: 87, test: 81, assign: 86 },
        { date: '2026-10-26', att: 89, test: 85, assign: 90 },
        { date: '2026-11-02', att: 90, test: 86, assign: 91 },
        { date: '2026-11-09', att: 91, test: 88, assign: 92 },
      ],
    },
    {
      student_id: 'STU-1135',
      name: 'Tariq Hassan',
      email: 'tariq.hassan@student.beacon.edu',
      program: 'B.S. Civil Engineering',
      term: 'Fall 2026',
      enrollment_status: 'Dropped',
      assigned_counselor_name: 'Marcus Sterling, LPC',
      series: [
        { date: '2026-10-05', att: 64, test: 58, assign: 55 },
        { date: '2026-10-12', att: 52, test: 49, assign: 42 },
        { date: '2026-10-19', att: 38, test: 44, assign: 30 },
        { date: '2026-10-26', att: 24, test: 35, assign: 18 },
        { date: '2026-11-02', att: 15, test: 30, assign: 10 },
        { date: '2026-11-09', att: 12, test: 28, assign: 10, note: 'Withdrew from fall term' },
      ],
    },
  ];

  for (const s of seedStudents) {
    const latest = s.series[s.series.length - 1];
    state.students.set(s.student_id, {
      student_id: s.student_id,
      name: s.name,
      email: s.email,
      program: s.program,
      term: s.term,
      enrollment_status: s.enrollment_status,
      assigned_counselor_id: 'CNS-STAFF',
      assigned_counselor_name: s.assigned_counselor_name,
      attendance_pct: latest.att,
      test_score: latest.test,
      assignment_pct: latest.assign,
      updated_at: now,
    });

    const historyPoints: MetricPoint[] = s.series.map((m) => ({
      id: state.nextId++,
      student_id: s.student_id,
      recorded_date: m.date,
      attendance_pct: m.att,
      test_score: m.test,
      assignment_pct: m.assign,
      notes: m.note ?? null,
    }));
    state.metrics.set(s.student_id, historyPoints);

    const computed = computeStudentRisk({
      studentId: s.student_id,
      studentName: s.name,
      enrollmentStatus: s.enrollment_status,
      attendancePct: latest.att,
      testScore: latest.test,
      assignmentPct: latest.assign,
      history: historyPoints,
      config: state.config,
    });

    state.assessments.set(s.student_id, {
      id: state.nextId++,
      student_id: s.student_id,
      probability_score: computed.probabilityScore,
      risk_level: computed.riskLevel,
      contributing_factors: computed.contributingFactors,
      model_summary: computed.modelSummary,
      assessed_at: now,
    });

    if (computed.riskLevel === 'HIGH' && s.enrollment_status !== 'Dropped') {
      state.alerts.push({
        id: state.nextId++,
        student_id: s.student_id,
        student_name: s.name,
        student_program: s.program,
        counselor_id: 'CNS-STAFF',
        counselor_name: s.assigned_counselor_name,
        trigger_reason: `Risk score ${computed.probabilityScore.toFixed(2)} breached 0.70 threshold`,
        severity: 'HIGH',
        probability_score: computed.probabilityScore,
        contributing_factors: computed.contributingFactors,
        status: s.student_id === 'STU-1063' ? 'Acknowledged' : 'Unread',
        created_at: '2026-11-15T14:20:00.000Z',
        resolved_at: null,
      });

      const firstName = s.name.split(' ')[0];
      state.interventions.push({
        id: state.nextId++,
        student_id: s.student_id,
        student_name: s.name,
        actor_role: 'ai_counselor',
        actor_name: 'Beacon AI Mentor',
        log_type: 'ai_outreach',
        content: `Hi ${firstName}, I noticed the past few weeks have been tougher with attendance and coursework deadlines. You're not alone in feeling stretched—whenever you're ready, let's talk through what's weighing on you or map out a manageable plan for this week.`,
        scheduled_for: null,
        created_at: '2026-11-15T14:21:00.000Z',
      });
    }
  }

  state.interventions.push(
    {
      id: state.nextId++,
      student_id: 'STU-1042',
      student_name: 'Maya Lin',
      actor_role: 'student',
      actor_name: 'Maya Lin',
      log_type: 'ai_chat',
      content:
        "I've been picking up extra evening shifts to cover rent and falling behind in Algorithms. Every time I miss a lecture I feel too embarrassed to show up the next day.",
      scheduled_for: null,
      created_at: '2026-11-15T16:10:00.000Z',
    },
    {
      id: state.nextId++,
      student_id: 'STU-1042',
      student_name: 'Maya Lin',
      actor_role: 'ai_counselor',
      actor_name: 'Beacon AI Mentor',
      log_type: 'ai_chat',
      content:
        "Thank you for being so honest about balancing work shifts and your Algorithms coursework, Maya. That kind of pressure is genuinely exhausting, and missing a class doesn't erase your capability—it just means your schedule needs breathing room. We can break your missing assignments into two 25-minute blocks this week, and I can also help you connect with Marcus Sterling to explore emergency campus aid or flexible lab hours. Which course task feels most urgent right now?",
      scheduled_for: null,
      created_at: '2026-11-15T16:11:00.000Z',
    },
    {
      id: state.nextId++,
      student_id: 'STU-1063',
      student_name: 'Nadia Patel',
      actor_role: 'counselor',
      actor_name: 'Priya Nair, M.Ed.',
      log_type: 'counselor_session',
      content:
        'Met with Nadia for 30 minutes to discuss Research Methods lab backlog. Arranged peer tutoring twice a week and extended deadline on Lab 4.',
      scheduled_for: null,
      created_at: '2026-11-15T17:00:00.000Z',
    },
    {
      id: state.nextId++,
      student_id: 'STU-1087',
      student_name: 'Jordan Alvarez',
      actor_role: 'counselor',
      actor_name: 'Marcus Sterling, LPC',
      log_type: 'scheduled_meeting',
      content:
        'Proactive mid-semester check-in scheduled to review Econometrics exam strategy.',
      scheduled_for: '2026-11-18T11:00:00',
      created_at: '2026-11-16T08:45:00.000Z',
    }
  );

  state.initialized = true;
}

function evaluateMemoryStudentRisk(
  state: MemoryState,
  studentId: string
): {
  probabilityScore: number;
  riskLevel: RiskLevel;
  alertTriggered: boolean;
  outreachTriggered: boolean;
} {
  const s = state.students.get(studentId);
  if (!s) throw new Error(`Student ${studentId} not found`);

  const history = state.metrics.get(studentId) ?? [];
  const prev = state.assessments.get(studentId);

  const computed = computeStudentRisk({
    studentId,
    studentName: s.name,
    enrollmentStatus: s.enrollment_status,
    attendancePct: s.attendance_pct,
    testScore: s.test_score,
    assignmentPct: s.assignment_pct,
    history,
    config: state.config,
  });

  const now = new Date().toISOString();
  state.assessments.set(studentId, {
    id: state.nextId++,
    student_id: studentId,
    probability_score: computed.probabilityScore,
    risk_level: computed.riskLevel,
    contributing_factors: computed.contributingFactors,
    model_summary: computed.modelSummary,
    assessed_at: now,
  });

  let alertTriggered = false;
  let outreachTriggered = false;

  if (computed.riskLevel === 'HIGH' && s.enrollment_status !== 'Dropped') {
    const hasOpen = state.alerts.some(
      (a) =>
        a.student_id === studentId &&
        (a.status === 'Unread' || a.status === 'Acknowledged')
    );

    if (!hasOpen) {
      const reason =
        prev && prev.risk_level !== 'HIGH'
          ? `Risk score rose from ${prev.probability_score.toFixed(2)} to ${computed.probabilityScore.toFixed(2)} (exceeding ${state.config.high_risk_threshold.toFixed(2)} threshold)`
          : `Risk score ${computed.probabilityScore.toFixed(2)} breached ${state.config.high_risk_threshold.toFixed(2)} threshold`;

      state.alerts.unshift({
        id: state.nextId++,
        student_id: studentId,
        student_name: s.name,
        student_program: s.program,
        counselor_id: 'CNS-STAFF',
        counselor_name: s.assigned_counselor_name,
        trigger_reason: reason,
        severity: 'HIGH',
        probability_score: computed.probabilityScore,
        contributing_factors: computed.contributingFactors,
        status: 'Unread',
        created_at: now,
        resolved_at: null,
      });
      alertTriggered = true;

      const hasOutreach = state.interventions.some(
        (l) => l.student_id === studentId && l.log_type === 'ai_outreach'
      );
      if (!hasOutreach) {
        const firstName = s.name.split(' ')[0];
        state.interventions.push({
          id: state.nextId++,
          student_id: studentId,
          student_name: s.name,
          actor_role: 'ai_counselor',
          actor_name: 'Beacon AI Mentor',
          log_type: 'ai_outreach',
          content: `Hi ${firstName}, I'm Beacon, your student support mentor. I noticed things might feel heavier with classes lately, and I wanted to check in gently—whenever you're ready, we can build a realistic plan together or connect with ${s.assigned_counselor_name}.`,
          scheduled_for: null,
          created_at: now,
        });
        outreachTriggered = true;
      }
    }
  }

  return {
    probabilityScore: computed.probabilityScore,
    riskLevel: computed.riskLevel,
    alertTriggered,
    outreachTriggered,
  };
}

export const memoryStore = {
  getSystemConfig(): SystemConfig {
    return { ...getState().config };
  },

  findUserByUid(uid: string): UserAccount | null {
    return getState().users.find((u) => u.uid === uid) ?? null;
  },

  getAllUsers(): UserAccount[] {
    return [...getState().users];
  },

  getDemoAccounts(): UserAccount[] {
    const roleOrder: Record<UserRole, number> = {
      admin: 0,
      counselor: 1,
      student: 2,
    };
    return getState()
      .users.filter((u) => u.active)
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.id - b.id);
  },

  getStudentFull(studentId: string): StudentRecord | null {
    const state = getState();
    const base = state.students.get(studentId);
    if (!base) return null;
    const assessment = state.assessments.get(studentId) ?? {
      id: 0,
      student_id: studentId,
      probability_score: 0,
      risk_level: 'LOW' as RiskLevel,
      contributing_factors: [],
      model_summary: 'Pending evaluation.',
      assessed_at: base.updated_at,
    };
    const metrics = state.metrics.get(studentId) ?? [];
    return {
      ...base,
      assessment,
      metrics_history: [...metrics],
    };
  },

  getAllStudents(): StudentRecord[] {
    const state = getState();
    const list: StudentRecord[] = [];
    for (const sid of state.students.keys()) {
      const full = memoryStore.getStudentFull(sid);
      if (full) list.push(full);
    }
    list.sort(
      (a, b) => b.assessment.probability_score - a.assessment.probability_score
    );
    return list;
  },

  getAlerts(): CounselorAlert[] {
    const rank: Record<AlertStatus, number> = {
      Unread: 0,
      Acknowledged: 1,
      Resolved: 2,
    };
    return [...getState().alerts].sort(
      (a, b) => rank[a.status] - rank[b.status] || b.id - a.id
    );
  },

  getInterventions(studentId?: string): InterventionLog[] {
    const logs = getState().interventions;
    if (studentId) {
      return logs.filter((l) => l.student_id === studentId);
    }
    return [...logs].reverse().slice(0, 60);
  },

  computeCohortAnalytics(studentList: StudentRecord[]): CohortAnalytics {
    const state = getState();
    const total = studentList.length;
    const high = studentList.filter((s) => s.assessment.risk_level === 'HIGH').length;
    const medium = studentList.filter((s) => s.assessment.risk_level === 'MEDIUM').length;
    const low = studentList.filter((s) => s.assessment.risk_level === 'LOW').length;
    const unreadAlerts = state.alerts.filter((a) => a.status === 'Unread').length;

    const avgAtt =
      total > 0
        ? Math.round(studentList.reduce((acc, s) => acc + s.attendance_pct, 0) / total)
        : 0;
    const avgTest =
      total > 0
        ? Math.round(studentList.reduce((acc, s) => acc + s.test_score, 0) / total)
        : 0;
    const avgAssign =
      total > 0
        ? Math.round(studentList.reduce((acc, s) => acc + s.assignment_pct, 0) / total)
        : 0;

    const byDate = new Map<string, { att: number[]; test: number[]; assign: number[] }>();
    for (const list of state.metrics.values()) {
      for (const m of list) {
        const entry = byDate.get(m.recorded_date) ?? { att: [], test: [], assign: [] };
        entry.att.push(m.attendance_pct);
        entry.test.push(m.test_score);
        entry.assign.push(m.assignment_pct);
        byDate.set(m.recorded_date, entry);
      }
    }

    const avg = (arr: number[]) =>
      Number((arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)).toFixed(1));

    const trend_series = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([date, vals]) => ({
        date,
        avg_attendance: avg(vals.att),
        avg_test_score: avg(vals.test),
        avg_assignment: avg(vals.assign),
      }));

    const buckets: Array<{ label: string; min: number; max: number; level: RiskLevel }> = [
      { label: '0.00–0.19', min: 0, max: 0.2, level: 'LOW' },
      { label: '0.20–0.39', min: 0.2, max: 0.4, level: 'LOW' },
      { label: '0.40–0.54', min: 0.4, max: 0.55, level: 'MEDIUM' },
      { label: '0.55–0.69', min: 0.55, max: 0.7, level: 'MEDIUM' },
      { label: '0.70–0.84', min: 0.7, max: 0.85, level: 'HIGH' },
      { label: '0.85–1.00', min: 0.85, max: 1.01, level: 'HIGH' },
    ];

    const risk_distribution = buckets.map((b) => ({
      bucket: b.label,
      count: studentList.filter(
        (s) =>
          s.assessment.probability_score >= b.min &&
          s.assessment.probability_score < b.max
      ).length,
      level: b.level,
    }));

    return {
      total_students: total,
      high_risk_count: high,
      medium_risk_count: medium,
      low_risk_count: low,
      unread_alerts_count: unreadAlerts,
      avg_attendance: avgAtt,
      avg_test_score: avgTest,
      avg_assignment_pct: avgAssign,
      trend_series,
      risk_distribution,
    };
  },

  createStudentRecord(input: {
    student_id: string;
    name: string;
    email?: string;
    program: string;
    term?: string;
    enrollment_status?: EnrollmentStatus;
    assigned_counselor_name?: string;
    attendance_pct: number;
    test_score: number;
    assignment_pct: number;
  }) {
    const state = getState();
    const sid = input.student_id.trim().toUpperCase();
    const att = Math.max(0, Math.min(100, Math.round(input.attendance_pct)));
    const test = Math.max(0, Math.min(100, Math.round(input.test_score)));
    const assign = Math.max(0, Math.min(100, Math.round(input.assignment_pct)));
    const now = new Date().toISOString();

    state.students.set(sid, {
      student_id: sid,
      name: input.name.trim(),
      email:
        input.email?.trim() ||
        `${input.name.trim().toLowerCase().replace(/\s+/g, '.')}@student.beacon.edu`,
      program: input.program.trim(),
      term: input.term?.trim() || 'Fall 2026',
      enrollment_status: input.enrollment_status || 'Active',
      assigned_counselor_id: 'CNS-STAFF',
      assigned_counselor_name: input.assigned_counselor_name || 'Marcus Sterling, LPC',
      attendance_pct: att,
      test_score: test,
      assignment_pct: assign,
      updated_at: now,
    });

    state.metrics.set(sid, [
      {
        id: state.nextId++,
        student_id: sid,
        recorded_date: now.slice(0, 10),
        attendance_pct: att,
        test_score: test,
        assignment_pct: assign,
        notes: 'Initial student enrollment metrics',
      },
    ]);

    const outcome = evaluateMemoryStudentRisk(state, sid);
    return { student: memoryStore.getStudentFull(sid), outcome };
  },

  recordStudentMetrics(
    studentId: string,
    input: {
      attendance_pct: number;
      test_score: number;
      assignment_pct: number;
      enrollment_status?: EnrollmentStatus;
      notes?: string;
      recorded_date?: string;
    }
  ) {
    const state = getState();
    const existing = state.students.get(studentId);
    if (!existing) return null;

    const att = Math.max(0, Math.min(100, Math.round(input.attendance_pct)));
    const test = Math.max(0, Math.min(100, Math.round(input.test_score)));
    const assign = Math.max(0, Math.min(100, Math.round(input.assignment_pct)));
    const now = new Date().toISOString();

    state.students.set(studentId, {
      ...existing,
      attendance_pct: att,
      test_score: test,
      assignment_pct: assign,
      enrollment_status: input.enrollment_status || existing.enrollment_status,
      updated_at: now,
    });

    const list = state.metrics.get(studentId) ?? [];
    list.push({
      id: state.nextId++,
      student_id: studentId,
      recorded_date: input.recorded_date || now.slice(0, 10),
      attendance_pct: att,
      test_score: test,
      assignment_pct: assign,
      notes: input.notes ?? 'Daily check-in ingestion',
    });
    state.metrics.set(studentId, list);

    const outcome = evaluateMemoryStudentRisk(state, studentId);
    return { student: memoryStore.getStudentFull(studentId), outcome };
  },

  bulkIngestMetrics(
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
  ) {
    const state = getState();
    const today = new Date().toISOString().slice(0, 10);
    let processed = 0;
    let alertsTriggered = 0;
    let outreachStarted = 0;

    for (const row of rows) {
      if (!row.student_id) continue;
      const sid = String(row.student_id).trim().toUpperCase();
      const att = Math.max(0, Math.min(100, Math.round(Number(row.attendance_pct))));
      const test = Math.max(0, Math.min(100, Math.round(Number(row.test_score))));
      const assign = Math.max(0, Math.min(100, Math.round(Number(row.assignment_pct))));
      if (Number.isNaN(att) || Number.isNaN(test) || Number.isNaN(assign)) continue;

      const existing = state.students.get(sid);
      const now = new Date().toISOString();
      if (existing) {
        state.students.set(sid, {
          ...existing,
          attendance_pct: att,
          test_score: test,
          assignment_pct: assign,
          enrollment_status: row.enrollment_status || existing.enrollment_status,
          updated_at: now,
        });
      } else {
        const studentName = row.name?.trim() || `Student ${sid}`;
        state.students.set(sid, {
          student_id: sid,
          name: studentName,
          email: `${studentName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@student.beacon.edu`,
          program: row.program?.trim() || 'General Studies',
          term: 'Fall 2026',
          enrollment_status: row.enrollment_status || 'Active',
          assigned_counselor_id: 'CNS-STAFF',
          assigned_counselor_name: 'Marcus Sterling, LPC',
          attendance_pct: att,
          test_score: test,
          assignment_pct: assign,
          updated_at: now,
        });
      }

      const list = state.metrics.get(sid) ?? [];
      list.push({
        id: state.nextId++,
        student_id: sid,
        recorded_date: row.recorded_date || today,
        attendance_pct: att,
        test_score: test,
        assignment_pct: assign,
        notes: row.notes || 'Bulk CSV ingestion',
      });
      state.metrics.set(sid, list);

      const outcome = evaluateMemoryStudentRisk(state, sid);
      processed += 1;
      if (outcome.alertTriggered) alertsTriggered += 1;
      if (outcome.outreachTriggered) outreachStarted += 1;
    }

    return {
      processed,
      alertsTriggered,
      outreachStarted,
      students: memoryStore.getAllStudents(),
    };
  },

  updateSystemThresholds(input: Partial<SystemConfig>) {
    const state = getState();
    const nextHigh = Math.max(
      0.45,
      Math.min(0.95, Number(input.high_risk_threshold ?? state.config.high_risk_threshold))
    );
    const nextMed = Math.max(
      0.15,
      Math.min(
        nextHigh - 0.1,
        Number(input.medium_risk_threshold ?? state.config.medium_risk_threshold)
      )
    );
    state.config = {
      ...state.config,
      high_risk_threshold: nextHigh,
      medium_risk_threshold: nextMed,
      weight_attendance: Math.max(
        0,
        Number(input.weight_attendance ?? state.config.weight_attendance)
      ),
      weight_test_score: Math.max(
        0,
        Number(input.weight_test_score ?? state.config.weight_test_score)
      ),
      weight_assignment: Math.max(
        0,
        Number(input.weight_assignment ?? state.config.weight_assignment)
      ),
      updated_at: new Date().toISOString(),
    };

    let newlyFlagged = 0;
    for (const sid of state.students.keys()) {
      const outcome = evaluateMemoryStudentRisk(state, sid);
      if (outcome.alertTriggered) newlyFlagged += 1;
    }

    return {
      config: { ...state.config },
      newlyFlagged,
      students: memoryStore.getAllStudents(),
    };
  },

  updateAlertStatus(alertId: number, status: AlertStatus): CounselorAlert[] {
    const state = getState();
    const target = state.alerts.find((a) => a.id === alertId);
    if (target) {
      target.status = status;
      target.resolved_at = status === 'Resolved' ? new Date().toISOString() : null;
    }
    return memoryStore.getAlerts();
  },

  insertInterventionLog(input: {
    student_id: string;
    actor_role: 'ai_counselor' | 'counselor' | 'student' | 'system';
    actor_name: string;
    log_type: InterventionLog['log_type'];
    content: string;
    scheduled_for?: string | null;
  }): InterventionLog {
    const state = getState();
    const stu = state.students.get(input.student_id);
    const entry: InterventionLog = {
      id: state.nextId++,
      student_id: input.student_id,
      student_name: stu?.name,
      actor_role: input.actor_role,
      actor_name: input.actor_name,
      log_type: input.log_type,
      content: input.content,
      scheduled_for: input.scheduled_for ?? null,
      created_at: new Date().toISOString(),
    };
    state.interventions.push(entry);

    if (input.actor_role === 'counselor') {
      for (const a of state.alerts) {
        if (a.student_id === input.student_id && a.status === 'Unread') {
          a.status = 'Acknowledged';
        }
      }
    }

    return entry;
  },

  insertUrgentCrisisAlert(student: StudentRecord): void {
    const state = getState();
    const now = new Date().toISOString();
    state.alerts.unshift({
      id: state.nextId++,
      student_id: student.student_id,
      student_name: student.name,
      student_program: student.program,
      counselor_id: 'CNS-STAFF',
      counselor_name: student.assigned_counselor_name,
      trigger_reason:
        'URGENT: Student expressed severe distress signals in AI support chat. Immediate human counselor check-in required.',
      severity: 'URGENT',
      probability_score: student.assessment.probability_score,
      contributing_factors: student.assessment.contributing_factors,
      status: 'Unread',
      created_at: now,
      resolved_at: null,
    });
    state.interventions.push({
      id: state.nextId++,
      student_id: student.student_id,
      student_name: student.name,
      actor_role: 'system',
      actor_name: 'Safety Escalation Router',
      log_type: 'escalation',
      content: `Urgent escalation alert dispatched to ${student.assigned_counselor_name} with campus crisis resource guidance displayed to student.`,
      scheduled_for: null,
      created_at: now,
    });
  },

  createUserAccount(input: {
    name: string;
    email: string;
    role: UserRole;
    title?: string;
    linked_student_id?: string | null;
  }): UserAccount {
    const state = getState();
    const id = state.nextId++;
    const user: UserAccount = {
      id,
      uid: `provisioned-${Date.now()}-${id}`,
      name: input.name.trim(),
      email: input.email.trim(),
      role: input.role,
      title:
        input.title?.trim() ||
        (input.role === 'admin'
          ? 'Faculty Administrator'
          : input.role === 'counselor'
            ? 'Academic Counselor'
            : 'Undergraduate Student'),
      linked_student_id:
        input.role === 'student' ? input.linked_student_id || 'STU-1042' : null,
      avatar_url: null,
      active: true,
      created_at: new Date().toISOString(),
    };
    state.users.push(user);
    return user;
  },

  updateUserAccount(
    id: number,
    input: {
      active?: boolean;
      role?: UserRole;
      title?: string;
      linked_student_id?: string | null;
    }
  ): UserAccount | null {
    const state = getState();
    const user = state.users.find((u) => u.id === id);
    if (!user) return null;
    if (input.active !== undefined) user.active = input.active;
    if (input.role !== undefined) user.role = input.role;
    if (input.title !== undefined) user.title = input.title;
    if (input.linked_student_id !== undefined) {
      user.linked_student_id = input.linked_student_id;
    }
    return { ...user };
  },
};
