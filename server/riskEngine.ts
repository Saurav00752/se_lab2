import { desc, eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import {
  academicMetrics,
  counselorAlerts,
  interventionLogs,
  riskAssessments,
  students,
  systemConfig,
} from '../src/db/schema.ts';
import type {
  EnrollmentStatus,
  MetricPoint,
  RiskFactor,
  RiskLevel,
  SystemConfig,
} from '../src/types.ts';

interface ComputeRiskInput {
  studentId: string;
  studentName: string;
  enrollmentStatus: EnrollmentStatus;
  attendancePct: number;
  testScore: number;
  assignmentPct: number;
  history: MetricPoint[];
  config: SystemConfig;
}

export interface ComputedRiskOutput {
  probabilityScore: number;
  riskLevel: RiskLevel;
  contributingFactors: RiskFactor[];
  modelSummary: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computeStudentRisk(input: ComputeRiskInput): ComputedRiskOutput {
  const {
    studentName,
    enrollmentStatus,
    attendancePct,
    testScore,
    assignmentPct,
    history,
    config,
  } = input;

  const rawSum =
    config.weight_attendance + config.weight_test_score + config.weight_assignment;
  const wAtt = rawSum > 0 ? config.weight_attendance / rawSum : 0.4;
  const wTest = rawSum > 0 ? config.weight_test_score / rawSum : 0.35;
  const wAssign = rawSum > 0 ? config.weight_assignment / rawSum : 0.25;

  const attDeficit =
    attendancePct >= 90
      ? 0.04
      : attendancePct >= 75
        ? ((90 - attendancePct) / 15) * 0.28 + 0.04
        : clamp(0.32 + ((75 - attendancePct) / 75) * 0.82, 0.32, 1.0);

  const testDeficit =
    testScore >= 85
      ? 0.05
      : testScore >= 65
        ? ((85 - testScore) / 20) * 0.35 + 0.05
        : clamp(0.4 + ((65 - testScore) / 65) * 0.78, 0.4, 1.0);

  const assignDeficit =
    assignmentPct >= 88
      ? 0.04
      : assignmentPct >= 65
        ? ((88 - assignmentPct) / 23) * 0.32 + 0.04
        : clamp(0.36 + ((65 - assignmentPct) / 65) * 0.8, 0.36, 1.0);

  let baseScore =
    attDeficit * wAtt + testDeficit * wTest + assignDeficit * wAssign;

  let trajectoryDelta = 0;
  if (history.length >= 2) {
    const sorted = [...history].sort((a, b) =>
      a.recorded_date.localeCompare(b.recorded_date)
    );
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const earlyComposite =
      (earliest.attendance_pct + earliest.test_score + earliest.assignment_pct) /
      3;
    const latestComposite =
      (latest.attendance_pct + latest.test_score + latest.assignment_pct) / 3;
    trajectoryDelta = Math.round(latestComposite - earlyComposite);
  }

  if (trajectoryDelta <= -10) {
    baseScore += clamp(Math.abs(trajectoryDelta) / 100, 0.06, 0.16);
  } else if (trajectoryDelta >= 8) {
    baseScore -= 0.05;
  }

  if (enrollmentStatus === 'Probation') {
    baseScore += 0.09;
  } else if (enrollmentStatus === 'Dropped') {
    baseScore = Math.max(baseScore, 0.94);
  }

  const probabilityScore = Number(clamp(baseScore, 0.03, 0.98).toFixed(2));

  let riskLevel: RiskLevel = 'LOW';
  if (probabilityScore >= config.high_risk_threshold) {
    riskLevel = 'HIGH';
  } else if (probabilityScore >= config.medium_risk_threshold) {
    riskLevel = 'MEDIUM';
  }

  const contributingFactors: RiskFactor[] = [];

  if (attendancePct < 75) {
    contributingFactors.push({
      code: 'ATTENDANCE_CRITICAL',
      label: 'Low Class Attendance',
      detail: `${attendancePct}% attendance falls significantly below the 80% persistence benchmark.`,
      impact: Number((attDeficit * wAtt).toFixed(2)),
      severity: 'high',
    });
  } else if (attendancePct < 85) {
    contributingFactors.push({
      code: 'ATTENDANCE_WATCH',
      label: 'Irregular Attendance',
      detail: `${attendancePct}% attendance shows emerging class absences worth monitoring.`,
      impact: Number((attDeficit * wAtt).toFixed(2)),
      severity: 'medium',
    });
  }

  if (testScore < 65) {
    contributingFactors.push({
      code: 'TEST_SCORE_LOW',
      label: 'Struggling Exam Performance',
      detail: `${testScore}/100 test average indicates core conceptual gaps requiring academic tutoring.`,
      impact: Number((testDeficit * wTest).toFixed(2)),
      severity: 'high',
    });
  } else if (testScore < 76) {
    contributingFactors.push({
      code: 'TEST_SCORE_MODERATE',
      label: 'Borderline Test Scores',
      detail: `${testScore}/100 assessment average sits near the course pass margin.`,
      impact: Number((testDeficit * wTest).toFixed(2)),
      severity: 'medium',
    });
  }

  if (assignmentPct < 65) {
    contributingFactors.push({
      code: 'ASSIGNMENT_DEFICIT',
      label: 'Missed Coursework Submissions',
      detail: `${assignmentPct}% assignment completion signals disengagement or workload overload.`,
      impact: Number((assignDeficit * wAssign).toFixed(2)),
      severity: 'high',
    });
  } else if (assignmentPct < 80) {
    contributingFactors.push({
      code: 'ASSIGNMENT_SLIPPAGE',
      label: 'Inconsistent Assignment Delivery',
      detail: `${assignmentPct}% assignment completion reflects periodic missed deadlines.`,
      impact: Number((assignDeficit * wAssign).toFixed(2)),
      severity: 'medium',
    });
  }

  if (trajectoryDelta <= -10) {
    contributingFactors.push({
      code: 'NEGATIVE_TRAJECTORY',
      label: 'Recent Downward Trend',
      detail: `Composite academic engagement declined by ${Math.abs(trajectoryDelta)} percentage points over recent weeks.`,
      impact: 0.12,
      severity: 'high',
    });
  } else if (trajectoryDelta >= 6) {
    contributingFactors.push({
      code: 'POSITIVE_RECOVERY',
      label: 'Positive Recovery Momentum',
      detail: `Composite metrics improved by +${trajectoryDelta} percentage points across recent check-ins.`,
      impact: -0.05,
      severity: 'positive',
    });
  }

  if (enrollmentStatus === 'Probation') {
    contributingFactors.push({
      code: 'PROBATION_STATUS',
      label: 'Academic Probation Standing',
      detail:
        'Current probation status increases sensitivity to any missed coursework or exams.',
      impact: 0.09,
      severity: 'high',
    });
  }

  if (contributingFactors.length === 0) {
    contributingFactors.push({
      code: 'STEADY_ENGAGEMENT',
      label: 'Strong Academic Continuity',
      detail: `Consistent attendance (${attendancePct}%), test performance (${testScore}/100), and coursework (${assignmentPct}%).`,
      impact: 0,
      severity: 'positive',
    });
  }

  contributingFactors.sort((a, b) => b.impact - a.impact);

  const primaryLabels = contributingFactors
    .filter((f) => f.severity !== 'positive')
    .slice(0, 2)
    .map((f) => f.label.toLowerCase());

  let modelSummary = '';
  if (riskLevel === 'HIGH') {
    modelSummary = `${studentName} is flagged at High Risk (${probabilityScore.toFixed(2)}) driven primarily by ${primaryLabels.join(' and ') || 'multiple academic indicators'}. Immediate counselor review and supportive outreach are active.`;
  } else if (riskLevel === 'MEDIUM') {
    modelSummary = `${studentName} shows Medium Risk (${probabilityScore.toFixed(2)}) with early warning signals in ${primaryLabels.join(' and ') || 'recent coursework'}. Proactive advisor check-in recommended.`;
  } else {
    modelSummary = `${studentName} is on track at Low Risk (${probabilityScore.toFixed(2)}) with healthy engagement across attendance and assessments.`;
  }

  return {
    probabilityScore,
    riskLevel,
    contributingFactors,
    modelSummary,
  };
}

export async function evaluateAndPersistStudentRisk(
  studentId: string,
  options?: { triggerAlerts?: boolean }
): Promise<{
  probabilityScore: number;
  riskLevel: RiskLevel;
  alertTriggered: boolean;
  outreachTriggered: boolean;
}> {
  const triggerAlerts = options?.triggerAlerts ?? true;

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, studentId))
    .limit(1);

  if (!student) {
    throw new Error(`Student ${studentId} not found`);
  }

  const [cfgRow] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.id, 1))
    .limit(1);

  const config: SystemConfig = cfgRow
    ? {
        id: cfgRow.id,
        high_risk_threshold: cfgRow.highRiskThreshold,
        medium_risk_threshold: cfgRow.mediumRiskThreshold,
        weight_attendance: cfgRow.weightAttendance,
        weight_test_score: cfgRow.weightTestScore,
        weight_assignment: cfgRow.weightAssignment,
        updated_at: cfgRow.updatedAt.toISOString(),
      }
    : {
        id: 1,
        high_risk_threshold: 0.7,
        medium_risk_threshold: 0.4,
        weight_attendance: 0.4,
        weight_test_score: 0.35,
        weight_assignment: 0.25,
        updated_at: new Date().toISOString(),
      };

  const historyRows = await db
    .select()
    .from(academicMetrics)
    .where(eq(academicMetrics.studentId, studentId));

  const history: MetricPoint[] = historyRows.map((h) => ({
    id: h.id,
    student_id: h.studentId,
    recorded_date: h.recordedDate,
    attendance_pct: h.attendancePct,
    test_score: h.testScore,
    assignment_pct: h.assignmentPct,
    notes: h.notes,
  }));

  const [previousAssessment] = await db
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.studentId, studentId))
    .orderBy(desc(riskAssessments.id))
    .limit(1);

  const computed = computeStudentRisk({
    studentId: student.studentId,
    studentName: student.name,
    enrollmentStatus: student.enrollmentStatus as EnrollmentStatus,
    attendancePct: student.attendancePct,
    testScore: student.testScore,
    assignmentPct: student.assignmentPct,
    history,
    config,
  });

  await db.insert(riskAssessments).values({
    studentId: student.studentId,
    probabilityScore: computed.probabilityScore,
    riskLevel: computed.riskLevel,
    contributingFactorsJson: JSON.stringify(computed.contributingFactors),
    modelSummary: computed.modelSummary,
  });

  let alertTriggered = false;
  let outreachTriggered = false;

  if (
    triggerAlerts &&
    computed.riskLevel === 'HIGH' &&
    student.enrollmentStatus !== 'Dropped'
  ) {
    const openAlerts = await db
      .select()
      .from(counselorAlerts)
      .where(eq(counselorAlerts.studentId, student.studentId));

    const hasOpenAlert = openAlerts.some(
      (a) => a.status === 'Unread' || a.status === 'Acknowledged'
    );

    if (!hasOpenAlert) {
      const dossier = {
        probability_score: computed.probabilityScore,
        attendance_pct: student.attendancePct,
        test_score: student.testScore,
        assignment_pct: student.assignmentPct,
        contributing_factors: computed.contributingFactors,
      };

      const reason =
        previousAssessment && previousAssessment.riskLevel !== 'HIGH'
          ? `Risk score rose from ${previousAssessment.probabilityScore.toFixed(2)} to ${computed.probabilityScore.toFixed(2)} (exceeding ${config.high_risk_threshold.toFixed(2)} threshold)`
          : `Risk score ${computed.probabilityScore.toFixed(2)} breached ${config.high_risk_threshold.toFixed(2)} threshold`;

      await db.insert(counselorAlerts).values({
        studentId: student.studentId,
        counselorName: student.assignedCounselorName,
        triggerReason: reason,
        severity: 'HIGH',
        dossierJson: JSON.stringify(dossier),
        status: 'Unread',
      });

      alertTriggered = true;

      const existingLogs = await db
        .select()
        .from(interventionLogs)
        .where(eq(interventionLogs.studentId, student.studentId));

      const hasOutreach = existingLogs.some((l) => l.logType === 'ai_outreach');
      if (!hasOutreach) {
        const firstName = student.name.split(' ')[0];
        const mainChallenge =
          student.attendancePct < 75
            ? 'keeping up with classes lately'
            : student.assignmentPct < 65
              ? 'staying on top of recent coursework deadlines'
              : 'recent exam preparation';

        const outreachMessage = `Hi ${firstName}, I'm Beacon, your student support mentor. I noticed things might feel a bit heavier with ${mainChallenge}, and I wanted to check in gently—no judgment at all. Would you like to talk through what's been getting in the way, build a realistic study plan together, or connect with ${student.assignedCounselorName} in advising?`;

        await db.insert(interventionLogs).values({
          studentId: student.studentId,
          actorRole: 'ai_counselor',
          actorName: 'Beacon AI Mentor',
          logType: 'ai_outreach',
          content: outreachMessage,
          scheduledFor: null,
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
