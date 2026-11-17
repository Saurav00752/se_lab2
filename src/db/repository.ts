import { asc, desc, eq, sql } from 'drizzle-orm';
import { computeStudentRisk, evaluateAndPersistStudentRisk } from '../../server/riskEngine.ts';
import type {
  AlertStatus,
  CohortAnalytics,
  CounselorAlert,
  EnrollmentStatus,
  InterventionLog,
  MetricPoint,
  RiskFactor,
  RiskLevel,
  StudentRecord,
  SystemConfig,
  UserAccount,
  UserRole,
} from '../types.ts';
import { db } from './index.ts';
import {
  academicMetrics,
  counselorAlerts,
  interventionLogs,
  riskAssessments,
  students,
  systemConfig,
  users,
} from './schema.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const existingConfig = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.id, 1))
        .limit(1);

      if (existingConfig.length === 0) {
        await db
          .insert(systemConfig)
          .values({
            id: 1,
            highRiskThreshold: 0.7,
            mediumRiskThreshold: 0.4,
            weightAttendance: 0.4,
            weightTestScore: 0.35,
            weightAssignment: 0.25,
          })
          .onConflictDoNothing();
      }

      // Always ensure demo accounts exist in PostgreSQL for 1-click role login
      const demoUsers = [
        {
          uid: 'demo-admin-01',
          name: 'Dr. Eleanor Vance',
          email: 'e.vance@beacon.edu',
          role: 'admin',
          title: 'Dean of Academic Success',
          linkedStudentId: null,
          avatarUrl: '/src/assets/images/avatar_admin_dean_1794852022861.jpg',
        },
        {
          uid: 'demo-counselor-01',
          name: 'Marcus Sterling, LPC',
          email: 'm.sterling@beacon.edu',
          role: 'counselor',
          title: 'Senior Academic Counselor',
          linkedStudentId: null,
          avatarUrl: '/src/assets/images/avatar_counselor_advisor_1794852023500.jpg',
        },
        {
          uid: 'demo-counselor-02',
          name: 'Priya Nair, M.Ed.',
          email: 'p.nair@beacon.edu',
          role: 'counselor',
          title: 'Student Retention Advisor',
          linkedStudentId: null,
          avatarUrl: null,
        },
        {
          uid: 'demo-student-01',
          name: 'Maya Lin',
          email: 'maya.lin@student.beacon.edu',
          role: 'student',
          title: 'B.S. Computer Science · Junior',
          linkedStudentId: 'STU-1042',
          avatarUrl: '/src/assets/images/avatar_student_scholar_1794852023888.jpg',
        },
        {
          uid: 'demo-student-02',
          name: 'Jordan Alvarez',
          email: 'jordan.alvarez@student.beacon.edu',
          role: 'student',
          title: 'B.A. Economics · Sophomore',
          linkedStudentId: 'STU-1087',
          avatarUrl: null,
        },
        {
          uid: 'demo-student-03',
          name: 'Elena Rostova',
          email: 'elena.rostova@student.beacon.edu',
          role: 'student',
          title: 'B.S. Biology · Freshman',
          linkedStudentId: 'STU-1104',
          avatarUrl: null,
        },
      ];

      for (const u of demoUsers) {
        await db.insert(users).values(u).onConflictDoNothing();
      }

      const studentCountRes = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(students);

      if ((studentCountRes[0]?.count ?? 0) > 0) {
        return;
      }

      const config: SystemConfig = {
        id: 1,
        high_risk_threshold: 0.7,
        medium_risk_threshold: 0.4,
        weight_attendance: 0.4,
        weight_test_score: 0.35,
        weight_assignment: 0.25,
        updated_at: new Date().toISOString(),
      };

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
        await db
          .insert(students)
          .values({
            studentId: s.student_id,
            name: s.name,
            email: s.email,
            program: s.program,
            term: s.term,
            enrollmentStatus: s.enrollment_status,
            assignedCounselorName: s.assigned_counselor_name,
            attendancePct: latest.att,
            testScore: latest.test,
            assignmentPct: latest.assign,
          })
          .onConflictDoNothing();

        const historyPoints: MetricPoint[] = [];
        for (const m of s.series) {
          const [inserted] = await db
            .insert(academicMetrics)
            .values({
              studentId: s.student_id,
              recordedDate: m.date,
              attendancePct: m.att,
              testScore: m.test,
              assignmentPct: m.assign,
              notes: m.note ?? null,
            })
            .returning();
          historyPoints.push({
            id: inserted.id,
            student_id: inserted.studentId,
            recorded_date: inserted.recordedDate,
            attendance_pct: inserted.attendancePct,
            test_score: inserted.testScore,
            assignment_pct: inserted.assignmentPct,
            notes: inserted.notes,
          });
        }

        const computed = computeStudentRisk({
          studentId: s.student_id,
          studentName: s.name,
          enrollmentStatus: s.enrollment_status,
          attendancePct: latest.att,
          testScore: latest.test,
          assignmentPct: latest.assign,
          history: historyPoints,
          config,
        });

        await db.insert(riskAssessments).values({
          studentId: s.student_id,
          probabilityScore: computed.probabilityScore,
          riskLevel: computed.riskLevel,
          contributingFactorsJson: JSON.stringify(computed.contributingFactors),
          modelSummary: computed.modelSummary,
        });

        if (computed.riskLevel === 'HIGH' && s.enrollment_status !== 'Dropped') {
          const dossier = {
            probability_score: computed.probabilityScore,
            attendance_pct: latest.att,
            test_score: latest.test,
            assignment_pct: latest.assign,
            contributing_factors: computed.contributingFactors,
          };
          await db.insert(counselorAlerts).values({
            studentId: s.student_id,
            counselorName: s.assigned_counselor_name,
            triggerReason: `Risk score ${computed.probabilityScore.toFixed(2)} breached 0.70 threshold`,
            severity: 'HIGH',
            dossierJson: JSON.stringify(dossier),
            status: s.student_id === 'STU-1063' ? 'Acknowledged' : 'Unread',
          });

          const firstName = s.name.split(' ')[0];
          await db.insert(interventionLogs).values({
            studentId: s.student_id,
            actorRole: 'ai_counselor',
            actorName: 'Beacon AI Mentor',
            logType: 'ai_outreach',
            content: `Hi ${firstName}, I noticed the past few weeks have been tougher with attendance and coursework deadlines. You're not alone in feeling stretched—whenever you're ready, let's talk through what's weighing on you or map out a manageable plan for this week.`,
            scheduledFor: null,
          });
        }
      }

      await db.insert(interventionLogs).values([
        {
          studentId: 'STU-1042',
          actorRole: 'student',
          actorName: 'Maya Lin',
          logType: 'ai_chat',
          content:
            "I've been picking up extra evening shifts to cover rent and falling behind in Algorithms. Every time I miss a lecture I feel too embarrassed to show up the next day.",
          scheduledFor: null,
        },
        {
          studentId: 'STU-1042',
          actorRole: 'ai_counselor',
          actorName: 'Beacon AI Mentor',
          logType: 'ai_chat',
          content:
            "Thank you for being so honest about balancing work shifts and your Algorithms coursework, Maya. That kind of pressure is genuinely exhausting, and missing a class doesn't erase your capability—it just means your schedule needs breathing room. We can break your missing assignments into two 25-minute blocks this week, and I can also help you connect with Marcus Sterling to explore emergency campus aid or flexible lab hours. Which course task feels most urgent right now?",
          scheduledFor: null,
        },
        {
          studentId: 'STU-1063',
          actorRole: 'counselor',
          actorName: 'Priya Nair, M.Ed.',
          logType: 'counselor_session',
          content:
            'Met with Nadia for 30 minutes to discuss Research Methods lab backlog. Arranged peer tutoring twice a week and extended deadline on Lab 4.',
          scheduledFor: null,
        },
        {
          studentId: 'STU-1087',
          actorRole: 'counselor',
          actorName: 'Marcus Sterling, LPC',
          logType: 'scheduled_meeting',
          content:
            'Proactive mid-semester check-in scheduled to review Econometrics exam strategy.',
          scheduledFor: '2026-11-18T11:00:00',
        },
      ]);
    } catch (error) {
      seedPromise = null;
      console.error('Database seed failed:', error);
      throw new Error('Failed to initialize academic dataset.', { cause: error });
    }
  })();
  return seedPromise;
}

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const [row] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.id, 1))
      .limit(1);

    if (!row) {
      return {
        id: 1,
        high_risk_threshold: 0.7,
        medium_risk_threshold: 0.4,
        weight_attendance: 0.4,
        weight_test_score: 0.35,
        weight_assignment: 0.25,
        updated_at: new Date().toISOString(),
      };
    }

    return {
      id: row.id,
      high_risk_threshold: row.highRiskThreshold,
      medium_risk_threshold: row.mediumRiskThreshold,
      weight_attendance: row.weightAttendance,
      weight_test_score: row.weightTestScore,
      weight_assignment: row.weightAssignment,
      updated_at: row.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed (getSystemConfig):', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getStudentFull(
  studentId: string
): Promise<StudentRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1);

    if (!row) return null;

    const [assessmentRow] = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.studentId, studentId))
      .orderBy(desc(riskAssessments.id))
      .limit(1);

    const historyRows = await db
      .select()
      .from(academicMetrics)
      .where(eq(academicMetrics.studentId, studentId))
      .orderBy(asc(academicMetrics.recordedDate), asc(academicMetrics.id));

    return {
      student_id: row.studentId,
      name: row.name,
      email: row.email,
      program: row.program,
      term: row.term,
      enrollment_status: row.enrollmentStatus as EnrollmentStatus,
      assigned_counselor_id: 'CNS-STAFF',
      assigned_counselor_name: row.assignedCounselorName,
      attendance_pct: row.attendancePct,
      test_score: row.testScore,
      assignment_pct: row.assignmentPct,
      updated_at: row.updatedAt.toISOString(),
      assessment: assessmentRow
        ? {
            id: assessmentRow.id,
            student_id: assessmentRow.studentId,
            probability_score: assessmentRow.probabilityScore,
            risk_level: assessmentRow.riskLevel as RiskLevel,
            contributing_factors: JSON.parse(
              assessmentRow.contributingFactorsJson
            ) as RiskFactor[],
            model_summary: assessmentRow.modelSummary,
            assessed_at: assessmentRow.assessedAt.toISOString(),
          }
        : {
            id: 0,
            student_id: row.studentId,
            probability_score: 0,
            risk_level: 'LOW',
            contributing_factors: [],
            model_summary: 'Pending initial risk evaluation.',
            assessed_at: row.updatedAt.toISOString(),
          },
      metrics_history: historyRows.map((h) => ({
        id: h.id,
        student_id: h.studentId,
        recorded_date: h.recordedDate,
        attendance_pct: h.attendancePct,
        test_score: h.testScore,
        assignment_pct: h.assignmentPct,
        notes: h.notes,
      })),
    };
  } catch (error) {
    console.error('Database query failed (getStudentFull):', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getAllStudents(): Promise<StudentRecord[]> {
  try {
    const allStudents = await db
      .select()
      .from(students)
      .orderBy(asc(students.studentId));
    const allAssessments = await db
      .select()
      .from(riskAssessments)
      .orderBy(desc(riskAssessments.id));
    const allMetrics = await db
      .select()
      .from(academicMetrics)
      .orderBy(asc(academicMetrics.recordedDate), asc(academicMetrics.id));

    const latestAssessmentByStudent = new Map<
      string,
      typeof allAssessments[number]
    >();
    for (const a of allAssessments) {
      if (!latestAssessmentByStudent.has(a.studentId)) {
        latestAssessmentByStudent.set(a.studentId, a);
      }
    }

    const metricsByStudent = new Map<string, MetricPoint[]>();
    for (const m of allMetrics) {
      const list = metricsByStudent.get(m.studentId) ?? [];
      list.push({
        id: m.id,
        student_id: m.studentId,
        recorded_date: m.recordedDate,
        attendance_pct: m.attendancePct,
        test_score: m.testScore,
        assignment_pct: m.assignmentPct,
        notes: m.notes,
      });
      metricsByStudent.set(m.studentId, list);
    }

    const result: StudentRecord[] = allStudents.map((row) => {
      const a = latestAssessmentByStudent.get(row.studentId);
      return {
        student_id: row.studentId,
        name: row.name,
        email: row.email,
        program: row.program,
        term: row.term,
        enrollment_status: row.enrollmentStatus as EnrollmentStatus,
        assigned_counselor_id: 'CNS-STAFF',
        assigned_counselor_name: row.assignedCounselorName,
        attendance_pct: row.attendancePct,
        test_score: row.testScore,
        assignment_pct: row.assignmentPct,
        updated_at: row.updatedAt.toISOString(),
        assessment: a
          ? {
              id: a.id,
              student_id: a.studentId,
              probability_score: a.probabilityScore,
              risk_level: a.riskLevel as RiskLevel,
              contributing_factors: JSON.parse(
                a.contributingFactorsJson
              ) as RiskFactor[],
              model_summary: a.modelSummary,
              assessed_at: a.assessedAt.toISOString(),
            }
          : {
              id: 0,
              student_id: row.studentId,
              probability_score: 0,
              risk_level: 'LOW',
              contributing_factors: [],
              model_summary: 'Pending evaluation.',
              assessed_at: row.updatedAt.toISOString(),
            },
        metrics_history: metricsByStudent.get(row.studentId) ?? [],
      };
    });

    result.sort(
      (a, b) => b.assessment.probability_score - a.assessment.probability_score
    );
    return result;
  } catch (error) {
    console.error('Database query failed (getAllStudents):', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getAlerts(): Promise<CounselorAlert[]> {
  try {
    const rows = await db
      .select({
        alert: counselorAlerts,
        studentName: students.name,
        studentProgram: students.program,
      })
      .from(counselorAlerts)
      .innerJoin(students, eq(counselorAlerts.studentId, students.studentId))
      .orderBy(desc(counselorAlerts.id));

    const mapped: CounselorAlert[] = rows.map((r) => {
      const dossier = JSON.parse(r.alert.dossierJson) as {
        probability_score: number;
        contributing_factors: RiskFactor[];
      };
      return {
        id: r.alert.id,
        student_id: r.alert.studentId,
        student_name: r.studentName,
        student_program: r.studentProgram,
        counselor_id: 'CNS-STAFF',
        counselor_name: r.alert.counselorName,
        trigger_reason: r.alert.triggerReason,
        severity: r.alert.severity as 'URGENT' | 'HIGH',
        probability_score: dossier.probability_score ?? 0,
        contributing_factors: dossier.contributing_factors ?? [],
        status: r.alert.status as AlertStatus,
        created_at: r.alert.createdAt.toISOString(),
        resolved_at: r.alert.resolvedAt ? r.alert.resolvedAt.toISOString() : null,
      };
    });

    const rank: Record<AlertStatus, number> = {
      Unread: 0,
      Acknowledged: 1,
      Resolved: 2,
    };
    mapped.sort((a, b) => rank[a.status] - rank[b.status] || b.id - a.id);
    return mapped;
  } catch (error) {
    console.error('Database query failed (getAlerts):', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getInterventions(
  studentId?: string
): Promise<InterventionLog[]> {
  try {
    const rows = studentId
      ? await db
          .select({
            log: interventionLogs,
            studentName: students.name,
          })
          .from(interventionLogs)
          .innerJoin(students, eq(interventionLogs.studentId, students.studentId))
          .where(eq(interventionLogs.studentId, studentId))
          .orderBy(asc(interventionLogs.createdAt), asc(interventionLogs.id))
      : await db
          .select({
            log: interventionLogs,
            studentName: students.name,
          })
          .from(interventionLogs)
          .innerJoin(students, eq(interventionLogs.studentId, students.studentId))
          .orderBy(desc(interventionLogs.createdAt), desc(interventionLogs.id))
          .limit(60);

    return rows.map((r) => ({
      id: r.log.id,
      student_id: r.log.studentId,
      student_name: r.studentName,
      actor_role: r.log.actorRole as InterventionLog['actor_role'],
      actor_name: r.log.actorName,
      log_type: r.log.logType as InterventionLog['log_type'],
      content: r.log.content,
      scheduled_for: r.log.scheduledFor,
      created_at: r.log.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed (getInterventions):', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function computeCohortAnalytics(
  studentList: StudentRecord[]
): Promise<CohortAnalytics> {
  try {
    const total = studentList.length;
    const high = studentList.filter(
      (s) => s.assessment.risk_level === 'HIGH'
    ).length;
    const medium = studentList.filter(
      (s) => s.assessment.risk_level === 'MEDIUM'
    ).length;
    const low = studentList.filter(
      (s) => s.assessment.risk_level === 'LOW'
    ).length;

    const unreadAlertsRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(counselorAlerts)
      .where(eq(counselorAlerts.status, 'Unread'));
    const unreadAlerts = unreadAlertsRes[0]?.count ?? 0;

    const avgAtt =
      total > 0
        ? Math.round(
            studentList.reduce((acc, s) => acc + s.attendance_pct, 0) / total
          )
        : 0;
    const avgTest =
      total > 0
        ? Math.round(
            studentList.reduce((acc, s) => acc + s.test_score, 0) / total
          )
        : 0;
    const avgAssign =
      total > 0
        ? Math.round(
            studentList.reduce((acc, s) => acc + s.assignment_pct, 0) / total
          )
        : 0;

    const trendRows = await db
      .select({
        date: academicMetrics.recordedDate,
        avg_attendance: sql<number>`ROUND(AVG(${academicMetrics.attendancePct}), 1)::float`,
        avg_test_score: sql<number>`ROUND(AVG(${academicMetrics.testScore}), 1)::float`,
        avg_assignment: sql<number>`ROUND(AVG(${academicMetrics.assignmentPct}), 1)::float`,
      })
      .from(academicMetrics)
      .groupBy(academicMetrics.recordedDate)
      .orderBy(asc(academicMetrics.recordedDate))
      .limit(10);

    const buckets: Array<{
      label: string;
      min: number;
      max: number;
      level: RiskLevel;
    }> = [
      { label: '0.00–0.19', min: 0, max: 0.2, level: 'LOW' },
      { label: '0.20–0.39', min: 0.2, max: 0.4, level: 'LOW' },
      { label: '0.40–0.54', min: 0.4, max: 0.55, level: 'MEDIUM' },
      { label: '0.55–0.69', min: 0.55, max: 0.7, level: 'MEDIUM' },
      { label: '0.70–0.84', min: 0.7, max: 0.85, level: 'HIGH' },
      { label: '0.85–1.00', min: 0.85, max: 1.01, level: 'HIGH' },
    ];

    const riskDistribution = buckets.map((b) => ({
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
      trend_series: trendRows,
      risk_distribution: riskDistribution,
    };
  } catch (error) {
    console.error('Database query failed (computeCohortAnalytics):', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getAllUsers(): Promise<UserAccount[]> {
  try {
    const rows = await db
      .select()
      .from(users)
      .orderBy(asc(users.role), asc(users.id));
    return rows.map((u) => ({
      id: u.id,
      uid: u.uid,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      title: u.title,
      linked_student_id: u.linkedStudentId,
      avatar_url: u.avatarUrl,
      active: u.active,
      created_at: u.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed (getAllUsers):', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getDemoAccounts(): Promise<UserAccount[]> {
  const all = await getAllUsers();
  const roleOrder: Record<UserRole, number> = {
    admin: 0,
    counselor: 1,
    student: 2,
  };
  return all
    .filter(
      (u) =>
        u.active &&
        (u.uid.startsWith('demo-') || u.uid.startsWith('provisioned-'))
    )
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.id - b.id);
}

export async function createStudentRecord(input: {
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
  try {
    const sid = input.student_id.trim().toUpperCase();
    const att = Math.max(0, Math.min(100, Math.round(input.attendance_pct)));
    const test = Math.max(0, Math.min(100, Math.round(input.test_score)));
    const assign = Math.max(0, Math.min(100, Math.round(input.assignment_pct)));
    const today = new Date().toISOString().slice(0, 10);

    await db.insert(students).values({
      studentId: sid,
      name: input.name.trim(),
      email:
        input.email?.trim() ||
        `${input.name.trim().toLowerCase().replace(/\s+/g, '.')}@student.beacon.edu`,
      program: input.program.trim(),
      term: input.term?.trim() || 'Fall 2026',
      enrollmentStatus: input.enrollment_status || 'Active',
      assignedCounselorName:
        input.assigned_counselor_name || 'Marcus Sterling, LPC',
      attendancePct: att,
      testScore: test,
      assignmentPct: assign,
    });

    await db.insert(academicMetrics).values({
      studentId: sid,
      recordedDate: today,
      attendancePct: att,
      testScore: test,
      assignmentPct: assign,
      notes: 'Initial student enrollment metrics',
    });

    const outcome = await evaluateAndPersistStudentRisk(sid, {
      triggerAlerts: true,
    });
    const student = await getStudentFull(sid);
    return { student, outcome };
  } catch (error) {
    console.error('Database insert failed (createStudentRecord):', error);
    throw new Error('Failed to enroll student record.', { cause: error });
  }
}

export async function recordStudentMetrics(
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
  try {
    const [existing] = await db
      .select()
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1);

    if (!existing) return null;

    const att = Math.max(0, Math.min(100, Math.round(input.attendance_pct)));
    const test = Math.max(0, Math.min(100, Math.round(input.test_score)));
    const assign = Math.max(0, Math.min(100, Math.round(input.assignment_pct)));
    const nextStatus = input.enrollment_status || existing.enrollmentStatus;
    const dateStr = input.recorded_date || new Date().toISOString().slice(0, 10);

    await db
      .update(students)
      .set({
        attendancePct: att,
        testScore: test,
        assignmentPct: assign,
        enrollmentStatus: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(students.studentId, studentId));

    await db.insert(academicMetrics).values({
      studentId,
      recordedDate: dateStr,
      attendancePct: att,
      testScore: test,
      assignmentPct: assign,
      notes: input.notes ?? 'Daily check-in ingestion',
    });

    const outcome = await evaluateAndPersistStudentRisk(studentId, {
      triggerAlerts: true,
    });
    const student = await getStudentFull(studentId);
    return { student, outcome };
  } catch (error) {
    console.error('Database update failed (recordStudentMetrics):', error);
    throw new Error('Failed to record student metrics.', { cause: error });
  }
}

export async function bulkIngestMetrics(
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
  try {
    const today = new Date().toISOString().slice(0, 10);
    let processed = 0;
    let alertsTriggered = 0;
    let outreachStarted = 0;

    for (const row of rows) {
      if (!row.student_id) continue;
      const sid = String(row.student_id).trim().toUpperCase();
      const att = Math.max(0, Math.min(100, Math.round(Number(row.attendance_pct))));
      const test = Math.max(0, Math.min(100, Math.round(Number(row.test_score))));
      const assign = Math.max(
        0,
        Math.min(100, Math.round(Number(row.assignment_pct)))
      );
      if (Number.isNaN(att) || Number.isNaN(test) || Number.isNaN(assign)) {
        continue;
      }

      const [existing] = await db
        .select()
        .from(students)
        .where(eq(students.studentId, sid))
        .limit(1);

      if (existing) {
        await db
          .update(students)
          .set({
            attendancePct: att,
            testScore: test,
            assignmentPct: assign,
            enrollmentStatus: row.enrollment_status || existing.enrollmentStatus,
            updatedAt: new Date(),
          })
          .where(eq(students.studentId, sid));
      } else {
        const studentName = row.name?.trim() || `Student ${sid}`;
        await db.insert(students).values({
          studentId: sid,
          name: studentName,
          email: `${studentName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@student.beacon.edu`,
          program: row.program?.trim() || 'General Studies',
          term: 'Fall 2026',
          enrollmentStatus: row.enrollment_status || 'Active',
          assignedCounselorName: 'Marcus Sterling, LPC',
          attendancePct: att,
          testScore: test,
          assignmentPct: assign,
        });
      }

      await db.insert(academicMetrics).values({
        studentId: sid,
        recordedDate: row.recorded_date || today,
        attendancePct: att,
        testScore: test,
        assignmentPct: assign,
        notes: row.notes || 'Bulk CSV ingestion',
      });

      const outcome = await evaluateAndPersistStudentRisk(sid, {
        triggerAlerts: true,
      });
      processed += 1;
      if (outcome.alertTriggered) alertsTriggered += 1;
      if (outcome.outreachTriggered) outreachStarted += 1;
    }

    return {
      processed,
      alertsTriggered,
      outreachStarted,
      students: await getAllStudents(),
    };
  } catch (error) {
    console.error('Database bulk ingest failed:', error);
    throw new Error('Bulk metrics ingestion failed.', { cause: error });
  }
}

export async function updateSystemThresholds(input: Partial<SystemConfig>) {
  try {
    const current = await getSystemConfig();
    const nextHigh = Math.max(
      0.45,
      Math.min(0.95, Number(input.high_risk_threshold ?? current.high_risk_threshold))
    );
    const nextMed = Math.max(
      0.15,
      Math.min(
        nextHigh - 0.1,
        Number(input.medium_risk_threshold ?? current.medium_risk_threshold)
      )
    );
    const wAtt = Math.max(0, Number(input.weight_attendance ?? current.weight_attendance));
    const wTest = Math.max(0, Number(input.weight_test_score ?? current.weight_test_score));
    const wAssign = Math.max(0, Number(input.weight_assignment ?? current.weight_assignment));

    await db
      .update(systemConfig)
      .set({
        highRiskThreshold: nextHigh,
        mediumRiskThreshold: nextMed,
        weightAttendance: wAtt,
        weightTestScore: wTest,
        weightAssignment: wAssign,
        updatedAt: new Date(),
      })
      .where(eq(systemConfig.id, 1));

    const allIds = await db
      .select({ studentId: students.studentId })
      .from(students);

    let newlyFlagged = 0;
    for (const row of allIds) {
      const outcome = await evaluateAndPersistStudentRisk(row.studentId, {
        triggerAlerts: true,
      });
      if (outcome.alertTriggered) newlyFlagged += 1;
    }

    return {
      config: await getSystemConfig(),
      newlyFlagged,
      students: await getAllStudents(),
    };
  } catch (error) {
    console.error('Database config update failed:', error);
    throw new Error('Failed to update risk configuration.', { cause: error });
  }
}

export async function updateAlertStatus(
  alertId: number,
  status: AlertStatus
): Promise<CounselorAlert[]> {
  try {
    await db
      .update(counselorAlerts)
      .set({
        status,
        resolvedAt: status === 'Resolved' ? new Date() : null,
      })
      .where(eq(counselorAlerts.id, alertId));

    return await getAlerts();
  } catch (error) {
    console.error('Database alert update failed:', error);
    throw new Error('Failed to update counselor alert.', { cause: error });
  }
}

export async function insertInterventionLog(input: {
  student_id: string;
  actor_role: 'ai_counselor' | 'counselor' | 'student' | 'system';
  actor_name: string;
  log_type: InterventionLog['log_type'];
  content: string;
  scheduled_for?: string | null;
}): Promise<InterventionLog> {
  try {
    const [inserted] = await db
      .insert(interventionLogs)
      .values({
        studentId: input.student_id,
        actorRole: input.actor_role,
        actorName: input.actor_name,
        logType: input.log_type,
        content: input.content,
        scheduledFor: input.scheduled_for ?? null,
      })
      .returning();

    if (input.actor_role === 'counselor') {
      await db
        .update(counselorAlerts)
        .set({ status: 'Acknowledged' })
        .where(eq(counselorAlerts.studentId, input.student_id));
    }

    const [stu] = await db
      .select({ name: students.name })
      .from(students)
      .where(eq(students.studentId, input.student_id))
      .limit(1);

    return {
      id: inserted.id,
      student_id: inserted.studentId,
      student_name: stu?.name,
      actor_role: inserted.actorRole as InterventionLog['actor_role'],
      actor_name: inserted.actorName,
      log_type: inserted.logType as InterventionLog['log_type'],
      content: inserted.content,
      scheduled_for: inserted.scheduledFor,
      created_at: inserted.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Database intervention insert failed:', error);
    throw new Error('Failed to save intervention log.', { cause: error });
  }
}

export async function insertUrgentCrisisAlert(
  student: StudentRecord
): Promise<void> {
  try {
    const dossier = {
      probability_score: student.assessment.probability_score,
      attendance_pct: student.attendance_pct,
      test_score: student.test_score,
      assignment_pct: student.assignment_pct,
      contributing_factors: student.assessment.contributing_factors,
    };

    await db.insert(counselorAlerts).values({
      studentId: student.student_id,
      counselorName: student.assigned_counselor_name,
      triggerReason:
        'URGENT: Student expressed severe distress signals in AI support chat. Immediate human counselor check-in required.',
      severity: 'URGENT',
      dossierJson: JSON.stringify(dossier),
      status: 'Unread',
    });

    await db.insert(interventionLogs).values({
      studentId: student.student_id,
      actorRole: 'system',
      actorName: 'Safety Escalation Router',
      logType: 'escalation',
      content: `Urgent escalation alert dispatched to ${student.assigned_counselor_name} with campus crisis resource guidance displayed to student.`,
      scheduledFor: null,
    });
  } catch (error) {
    console.error('Database crisis escalation failed:', error);
    throw new Error('Failed to log urgent escalation alert.', { cause: error });
  }
}

export async function createUserAccount(input: {
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  linked_student_id?: string | null;
}): Promise<UserAccount> {
  try {
    const uid = `provisioned-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [created] = await db
      .insert(users)
      .values({
        uid,
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
        linkedStudentId:
          input.role === 'student' ? input.linked_student_id || 'STU-1042' : null,
        active: true,
      })
      .returning();

    return {
      id: created.id,
      uid: created.uid,
      name: created.name,
      email: created.email,
      role: created.role as UserRole,
      title: created.title,
      linked_student_id: created.linkedStudentId,
      avatar_url: created.avatarUrl,
      active: created.active,
      created_at: created.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Database user insert failed:', error);
    throw new Error('Failed to create user account.', { cause: error });
  }
}

export async function updateUserAccount(
  id: number,
  input: {
    active?: boolean;
    role?: UserRole;
    title?: string;
    linked_student_id?: string | null;
  }
): Promise<UserAccount | null> {
  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) return null;

    const [updated] = await db
      .update(users)
      .set({
        active: input.active ?? existing.active,
        role: input.role ?? existing.role,
        title: input.title ?? existing.title,
        linkedStudentId:
          input.linked_student_id !== undefined
            ? input.linked_student_id
            : existing.linkedStudentId,
      })
      .where(eq(users.id, id))
      .returning();

    return {
      id: updated.id,
      uid: updated.uid,
      name: updated.name,
      email: updated.email,
      role: updated.role as UserRole,
      title: updated.title,
      linked_student_id: updated.linkedStudentId,
      avatar_url: updated.avatarUrl,
      active: updated.active,
      created_at: updated.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Database user update failed:', error);
    throw new Error('Failed to update user account.', { cause: error });
  }
}
