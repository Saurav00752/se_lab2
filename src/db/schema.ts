import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('student'),
  title: text('title').notNull().default('Student'),
  linkedStudentId: text('linked_student_id'),
  avatarUrl: text('avatar_url'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemConfig = pgTable('system_config', {
  id: integer('id').primaryKey(),
  highRiskThreshold: doublePrecision('high_risk_threshold').notNull().default(0.7),
  mediumRiskThreshold: doublePrecision('medium_risk_threshold').notNull().default(0.4),
  weightAttendance: doublePrecision('weight_attendance').notNull().default(0.4),
  weightTestScore: doublePrecision('weight_test_score').notNull().default(0.35),
  weightAssignment: doublePrecision('weight_assignment').notNull().default(0.25),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const students = pgTable('students', {
  studentId: text('student_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  program: text('program').notNull(),
  term: text('term').notNull(),
  enrollmentStatus: text('enrollment_status').notNull().default('Active'),
  assignedCounselorName: text('assigned_counselor_name').notNull(),
  attendancePct: integer('attendance_pct').notNull(),
  testScore: integer('test_score').notNull(),
  assignmentPct: integer('assignment_pct').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const academicMetrics = pgTable('academic_metrics', {
  id: serial('id').primaryKey(),
  studentId: text('student_id')
    .references(() => students.studentId, { onDelete: 'cascade' })
    .notNull(),
  recordedDate: text('recorded_date').notNull(),
  attendancePct: integer('attendance_pct').notNull(),
  testScore: integer('test_score').notNull(),
  assignmentPct: integer('assignment_pct').notNull(),
  notes: text('notes'),
});

export const riskAssessments = pgTable('risk_assessments', {
  id: serial('id').primaryKey(),
  studentId: text('student_id')
    .references(() => students.studentId, { onDelete: 'cascade' })
    .notNull(),
  probabilityScore: doublePrecision('probability_score').notNull(),
  riskLevel: text('risk_level').notNull(),
  contributingFactorsJson: text('contributing_factors_json').notNull(),
  modelSummary: text('model_summary').notNull(),
  assessedAt: timestamp('assessed_at').defaultNow().notNull(),
});

export const counselorAlerts = pgTable('counselor_alerts', {
  id: serial('id').primaryKey(),
  studentId: text('student_id')
    .references(() => students.studentId, { onDelete: 'cascade' })
    .notNull(),
  counselorName: text('counselor_name').notNull(),
  triggerReason: text('trigger_reason').notNull(),
  severity: text('severity').notNull(),
  dossierJson: text('dossier_json').notNull(),
  status: text('status').notNull().default('Unread'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

export const interventionLogs = pgTable('intervention_logs', {
  id: serial('id').primaryKey(),
  studentId: text('student_id')
    .references(() => students.studentId, { onDelete: 'cascade' })
    .notNull(),
  actorRole: text('actor_role').notNull(),
  actorName: text('actor_name').notNull(),
  logType: text('log_type').notNull(),
  content: text('content').notNull(),
  scheduledFor: text('scheduled_for'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  metrics: many(academicMetrics),
  assessments: many(riskAssessments),
  alerts: many(counselorAlerts),
  interventions: many(interventionLogs),
}));

export const academicMetricsRelations = relations(academicMetrics, ({ one }) => ({
  student: one(students, {
    fields: [academicMetrics.studentId],
    references: [students.studentId],
  }),
}));

export const riskAssessmentsRelations = relations(riskAssessments, ({ one }) => ({
  student: one(students, {
    fields: [riskAssessments.studentId],
    references: [students.studentId],
  }),
}));

export const counselorAlertsRelations = relations(counselorAlerts, ({ one }) => ({
  student: one(students, {
    fields: [counselorAlerts.studentId],
    references: [students.studentId],
  }),
}));

export const interventionLogsRelations = relations(interventionLogs, ({ one }) => ({
  student: one(students, {
    fields: [interventionLogs.studentId],
    references: [students.studentId],
  }),
}));
