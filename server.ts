import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  generateCounselorDossierBrief,
  generateEmpatheticCounselorReply,
} from './server/ai.ts';
import {
  bulkIngestMetrics,
  computeCohortAnalytics,
  createStudentRecord,
  createUserAccount,
  ensureSeeded,
  getAlerts,
  getAllStudents,
  getAllUsers,
  getDemoAccounts,
  getInterventions,
  getStudentFull,
  getSystemConfig,
  insertInterventionLog,
  insertUrgentCrisisAlert,
  recordStudentMetrics,
  updateAlertStatus,
  updateSystemThresholds,
  updateUserAccount,
} from './src/db/repository.ts';
import {
  type AuthRequest,
  requireAuth,
  requireRole,
} from './src/middleware/auth.ts';
import type {
  AlertStatus,
  EnrollmentStatus,
  SystemConfig,
  UserRole,
} from './src/types.ts';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Public demo account directory backed by Cloud SQL PostgreSQL
app.get('/api/demo-accounts', async (_req, res) => {
  try {
    await ensureSeeded();
    const accounts = await getDemoAccounts();
    res.json({ accounts });
  } catch (error) {
    console.error('Demo accounts error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load demo accounts.',
    });
  }
});

// Authenticated bootstrap payload scoped strictly to the user's RBAC role
app.get('/api/bootstrap', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const user = req.dbUser!;
    const effectiveRole = req.effectiveRole ?? user.role;
    const effectiveStudentId = req.effectiveStudentId ?? user.linked_student_id;
    const config = await getSystemConfig();

    if (effectiveRole === 'student') {
      const myStudent = effectiveStudentId
        ? await getStudentFull(effectiveStudentId)
        : null;
      const myInterventions = effectiveStudentId
        ? await getInterventions(effectiveStudentId)
        : [];

      res.json({
        user: { ...user, role: effectiveRole, linked_student_id: effectiveStudentId },
        baseRole: user.role,
        config,
        myStudent,
        interventions: myInterventions,
      });
      return;
    }

    const studentsList = await getAllStudents();
    const alerts = await getAlerts();
    const analytics = await computeCohortAnalytics(studentsList);
    const interventions = await getInterventions();
    const usersList =
      effectiveRole === 'admin' ? await getAllUsers() : undefined;

    res.json({
      user: { ...user, role: effectiveRole, linked_student_id: effectiveStudentId },
      baseRole: user.role,
      config,
      students: studentsList,
      alerts,
      analytics,
      interventions,
      users: usersList,
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load workspace.',
    });
  }
});

app.get(
  '/api/students',
  requireAuth,
  requireRole('admin', 'counselor'),
  async (req: AuthRequest, res) => {
    try {
      const { search, risk, status } = req.query as {
        search?: string;
        risk?: string;
        status?: string;
      };
      let list = await getAllStudents();
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.student_id.toLowerCase().includes(q) ||
            s.program.toLowerCase().includes(q)
        );
      }
      if (risk && risk !== 'ALL') {
        list = list.filter((s) => s.assessment.risk_level === risk);
      }
      if (status && status !== 'ALL') {
        list = list.filter((s) => s.enrollment_status === status);
      }
      res.json({ students: list });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch students.',
      });
    }
  }
);

app.get('/api/students/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const effectiveRole = req.effectiveRole ?? req.dbUser!.role;
    const effectiveStudentId =
      req.effectiveStudentId ?? req.dbUser!.linked_student_id;
    const studentId = String(req.params.id);

    if (effectiveRole === 'student' && effectiveStudentId !== studentId) {
      res.status(403).json({
        error: 'Students may only inspect their own academic profile and risk assessment.',
      });
      return;
    }

    const student = await getStudentFull(studentId);
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const interventions = await getInterventions(studentId);
    res.json({ student, interventions });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load student dossier.',
    });
  }
});

app.post(
  '/api/students',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    const {
      student_id,
      name,
      email,
      program,
      term,
      enrollment_status,
      attendance_pct,
      test_score,
      assignment_pct,
    } = req.body as {
      student_id?: string;
      name?: string;
      email?: string;
      program?: string;
      term?: string;
      enrollment_status?: EnrollmentStatus;
      attendance_pct?: number;
      test_score?: number;
      assignment_pct?: number;
    };

    if (!student_id || !name || !program) {
      res.status(400).json({ error: 'student_id, name, and program are required.' });
      return;
    }

    try {
      const result = await createStudentRecord({
        student_id,
        name,
        email,
        program,
        term,
        enrollment_status,
        attendance_pct: Number(attendance_pct ?? 85),
        test_score: Number(test_score ?? 80),
        assignment_pct: Number(assignment_pct ?? 85),
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to enroll student.',
      });
    }
  }
);

app.post(
  '/api/students/:id/metrics',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    const studentId = String(req.params.id);
    const {
      attendance_pct,
      test_score,
      assignment_pct,
      enrollment_status,
      notes,
      recorded_date,
    } = req.body as {
      attendance_pct: number;
      test_score: number;
      assignment_pct: number;
      enrollment_status?: EnrollmentStatus;
      notes?: string;
      recorded_date?: string;
    };

    try {
      const result = await recordStudentMetrics(studentId, {
        attendance_pct: Number(attendance_pct),
        test_score: Number(test_score),
        assignment_pct: Number(assignment_pct),
        enrollment_status,
        notes,
        recorded_date,
      });

      if (!result) {
        res.status(404).json({ error: 'Student not found.' });
        return;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update metrics.',
      });
    }
  }
);

app.post(
  '/api/students/bulk-ingest',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    const { rows } = req.body as {
      rows?: Array<{
        student_id: string;
        name?: string;
        program?: string;
        enrollment_status?: EnrollmentStatus;
        attendance_pct: number;
        test_score: number;
        assignment_pct: number;
        recorded_date?: string;
        notes?: string;
      }>;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      res
        .status(400)
        .json({ error: 'Provide a non-empty array of student metric rows.' });
      return;
    }

    try {
      const result = await bulkIngestMetrics(rows);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Bulk ingest failed.',
      });
    }
  }
);

app.put(
  '/api/config',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    try {
      const result = await updateSystemThresholds(
        req.body as Partial<SystemConfig>
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update config.',
      });
    }
  }
);

app.get(
  '/api/users',
  requireAuth,
  requireRole('admin'),
  async (_req, res) => {
    try {
      res.json({ users: await getAllUsers() });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch users.',
      });
    }
  }
);

app.post(
  '/api/users',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    const { name, email, role, title, linked_student_id } = req.body as {
      name?: string;
      email?: string;
      role?: UserRole;
      title?: string;
      linked_student_id?: string | null;
    };

    if (!name || !email || !role) {
      res.status(400).json({ error: 'Name, email, and role are required.' });
      return;
    }

    try {
      const user = await createUserAccount({
        name,
        email,
        role,
        title,
        linked_student_id,
      });
      res.status(201).json({ user });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Could not create user.',
      });
    }
  }
);

app.patch(
  '/api/users/:id',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    const targetId = Number(req.params.id);
    if (Number.isNaN(targetId)) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    try {
      const updated = await updateUserAccount(
        targetId,
        req.body as {
          active?: boolean;
          role?: UserRole;
          title?: string;
          linked_student_id?: string | null;
        }
      );
      if (!updated) {
        res.status(404).json({ error: 'User account not found.' });
        return;
      }
      res.json({ user: updated });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update user.',
      });
    }
  }
);

app.get(
  '/api/alerts',
  requireAuth,
  requireRole('admin', 'counselor'),
  async (_req, res) => {
    try {
      res.json({ alerts: await getAlerts() });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load alerts.',
      });
    }
  }
);

app.patch(
  '/api/alerts/:id',
  requireAuth,
  requireRole('admin', 'counselor'),
  async (req, res) => {
    const alertId = Number(req.params.id);
    const { status } = req.body as { status: AlertStatus };
    try {
      const alerts = await updateAlertStatus(alertId, status);
      res.json({ alerts });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update alert.',
      });
    }
  }
);

app.get('/api/interventions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const effectiveRole = req.effectiveRole ?? req.dbUser!.role;
    const effectiveStudentId =
      req.effectiveStudentId ?? req.dbUser!.linked_student_id;
    const queryStudentId = req.query.studentId as string | undefined;

    if (effectiveRole === 'student') {
      const logs = effectiveStudentId
        ? await getInterventions(effectiveStudentId)
        : [];
      res.json({ interventions: logs });
      return;
    }

    res.json({ interventions: await getInterventions(queryStudentId) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch interventions.',
    });
  }
});

app.post(
  '/api/interventions',
  requireAuth,
  requireRole('admin', 'counselor'),
  async (req: AuthRequest, res) => {
    const user = req.dbUser!;
    const { student_id, log_type, content, scheduled_for } = req.body as {
      student_id?: string;
      log_type?: 'counselor_session' | 'scheduled_meeting';
      content?: string;
      scheduled_for?: string | null;
    };

    if (!student_id || !content?.trim()) {
      res.status(400).json({ error: 'student_id and note content are required.' });
      return;
    }

    try {
      const intervention = await insertInterventionLog({
        student_id,
        actor_role: 'counselor',
        actor_name: user.name,
        log_type: log_type || 'counselor_session',
        content: content.trim(),
        scheduled_for: scheduled_for || null,
      });
      res.status(201).json({ intervention });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save intervention.',
      });
    }
  }
);

app.post('/api/chat', requireAuth, async (req: AuthRequest, res) => {
  const effectiveRole = req.effectiveRole ?? req.dbUser!.role;
  const effectiveStudentId =
    req.effectiveStudentId ?? req.dbUser!.linked_student_id;
  const { student_id, message } = req.body as {
    student_id?: string;
    message?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }

  const targetStudentId =
    effectiveRole === 'student' ? effectiveStudentId : student_id;

  if (!targetStudentId) {
    res.status(400).json({ error: 'Target student ID is required.' });
    return;
  }

  if (
    effectiveRole === 'student' &&
    student_id &&
    student_id !== effectiveStudentId
  ) {
    res.status(403).json({
      error: 'Students can only access their own private counseling chat.',
    });
    return;
  }

  try {
    const student = await getStudentFull(targetStudentId);
    if (!student) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    const cleanMessage = message.trim();

    await insertInterventionLog({
      student_id: student.student_id,
      actor_role: 'student',
      actor_name: student.name,
      log_type: 'ai_chat',
      content: cleanMessage,
    });

    const history = await getInterventions(student.student_id);

    try {
      const aiResult = await generateEmpatheticCounselorReply({
        student,
        assessment: student.assessment,
        recentHistory: history,
        userMessage: cleanMessage,
      });

      await insertInterventionLog({
        student_id: student.student_id,
        actor_role: 'ai_counselor',
        actor_name: 'Beacon AI Mentor',
        log_type: 'ai_chat',
        content: aiResult.reply,
      });

      if (aiResult.crisisEscalated) {
        await insertUrgentCrisisAlert(student);
      }

      const updatedLogs = await getInterventions(student.student_id);
      res.json({
        reply: aiResult.reply,
        crisisEscalated: aiResult.crisisEscalated,
        interventions: updatedLogs,
      });
    } catch (aiErr) {
      const errorMessage =
        aiErr instanceof Error
          ? aiErr.message
          : 'Unable to reach Gemini AI service.';
      res.status(502).json({
        error: errorMessage,
        interventions: history,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Chat processing failed.',
    });
  }
});

app.post(
  '/api/students/:id/ai-brief',
  requireAuth,
  requireRole('admin', 'counselor'),
  async (req, res) => {
    const studentId = String(req.params.id);
    try {
      const student = await getStudentFull(studentId);
      if (!student) {
        res.status(404).json({ error: 'Student not found.' });
        return;
      }

      const recentLogs = await getInterventions(studentId);
      const brief = await generateCounselorDossierBrief({
        student,
        assessment: student.assessment,
        recentLogs,
      });
      res.json({ brief });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to generate AI brief.';
      res.status(502).json({ error: msg });
    }
  }
);

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Beacon Express API Gateway listening on http://localhost:${PORT}`
    );
  });
}

startServer();
