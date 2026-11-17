import { useEffect, useState } from 'react';
import {
  Calendar,
  FileText,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react';
import { api, type RequestAuthContext } from '../api';
import type {
  EnrollmentStatus,
  InterventionLog,
  StudentRecord,
  UserRole,
} from '../types';
import { StudentTrajectoryChart } from './AnalyticsCharts';
import { EnrollmentStatusLabel, RiskIndicator } from './RiskIndicator';

interface StudentDossierDrawerProps {
  studentId: string | null;
  authCtx: RequestAuthContext;
  activeRole: UserRole;
  onClose: () => void;
  onDataMutated: (message: string) => void;
}

export function StudentDossierDrawer({
  studentId,
  authCtx,
  activeRole,
  onClose,
  onDataMutated,
}: StudentDossierDrawerProps) {
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [interventions, setInterventions] = useState<InterventionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counseling note / scheduling state
  const [logType, setLogType] = useState<'counselor_session' | 'scheduled_meeting'>(
    'counselor_session'
  );
  const [noteContent, setNoteContent] = useState('');
  const [scheduledFor, setScheduledFor] = useState('2026-11-20T14:00');
  const [savingNote, setSavingNote] = useState(false);

  // AI Brief state
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Admin quick metric ingestion state
  const [attInput, setAttInput] = useState(0);
  const [testInput, setTestInput] = useState(0);
  const [assignInput, setAssignInput] = useState(0);
  const [statusInput, setStatusInput] = useState<EnrollmentStatus>('Active');
  const [savingMetrics, setSavingMetrics] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      setInterventions([]);
      setAiBrief(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setAiBrief(null);
    setBriefError(null);

    api
      .getStudent(authCtx, studentId)
      .then((res) => {
        if (cancelled) return;
        setStudent(res.student);
        setInterventions(res.interventions);
        setAttInput(res.student.attendance_pct);
        setTestInput(res.student.test_score);
        setAssignInput(res.student.assignment_pct);
        setStatusInput(res.student.enrollment_status);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load dossier.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, authCtx]);

  if (!studentId) return null;

  const handleSaveIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      const res = await api.logIntervention(authCtx, {
        student_id: student.student_id,
        log_type: logType,
        content: noteContent.trim(),
        scheduled_for: logType === 'scheduled_meeting' ? scheduledFor : null,
      });
      setInterventions((prev) => [...prev, res.intervention]);
      setNoteContent('');
      onDataMutated(
        logType === 'scheduled_meeting'
          ? `Counseling session scheduled for ${student.name}.`
          : `Session note recorded for ${student.name}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save log.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleGenerateBrief = async () => {
    if (!student) return;
    setLoadingBrief(true);
    setBriefError(null);
    try {
      const res = await api.generateAiBrief(authCtx, student.student_id);
      setAiBrief(res.brief);
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : 'Could not generate AI dossier brief.'
      );
    } finally {
      setLoadingBrief(false);
    }
  };

  const handleUpdateMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setSavingMetrics(true);
    try {
      const res = await api.updateStudentMetrics(authCtx, student.student_id, {
        attendance_pct: attInput,
        test_score: testInput,
        assignment_pct: assignInput,
        enrollment_status: statusInput,
        notes: 'Updated via dossier metric check-in',
      });
      setStudent(res.student);
      onDataMutated(
        `Metrics updated for ${student.name} · Risk ${res.outcome.riskLevel} (${res.outcome.probabilityScore.toFixed(2)})`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update metrics.');
    } finally {
      setSavingMetrics(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#1F2421]/30 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Student Risk Dossier"
    >
      <div className="w-full max-w-2xl bg-[#FAF8F5] h-full overflow-y-auto border-l border-[#E5DFD5] flex flex-col">
        <div className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#E5DFD5] px-6 py-4 flex items-start justify-between gap-4">
          <div>
            {student ? (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-xl font-semibold text-[#1F2421]">
                    {student.name}
                  </h2>
                  <RiskIndicator
                    level={student.assessment.risk_level}
                    score={student.assessment.probability_score}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5C645E]">
                  <span className="font-mono tabular-nums">{student.student_id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{student.program}</span>
                  <span aria-hidden="true">·</span>
                  <span>{student.term}</span>
                  <span aria-hidden="true">·</span>
                  <EnrollmentStatusLabel status={student.enrollment_status} />
                </div>
              </>
            ) : (
              <h2 className="font-display text-xl font-semibold text-[#1F2421]">
                Student Dossier
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-[#E5DFD5] text-[#5C645E] hover:text-[#1F2421] hover:bg-[#F3EFEA] transition-colors"
            aria-label="Close dossier"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center text-sm text-[#5C645E]">
              Loading student dossier...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#F5C6C6] text-sm text-[#B91C1C]">
              {error}
            </div>
          )}

          {student && !loading && (
            <>
              {/* Metric strip */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-4">
                  <div className="text-xs text-[#5C645E]">Attendance</div>
                  <div className="mt-1 text-2xl font-mono tabular-nums font-semibold text-[#1F2421]">
                    {student.attendance_pct}%
                  </div>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-4">
                  <div className="text-xs text-[#5C645E]">Test Average</div>
                  <div className="mt-1 text-2xl font-mono tabular-nums font-semibold text-[#1F2421]">
                    {student.test_score}
                    <span className="text-xs text-[#5C645E] font-normal">/100</span>
                  </div>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-4">
                  <div className="text-xs text-[#5C645E]">Assignments</div>
                  <div className="mt-1 text-2xl font-mono tabular-nums font-semibold text-[#1F2421]">
                    {student.assignment_pct}%
                  </div>
                </div>
              </div>

              {/* Trajectory Chart */}
              <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5">
                <h3 className="text-sm font-semibold text-[#1F2421] mb-3">
                  Academic Engagement Trajectory
                </h3>
                <StudentTrajectoryChart history={student.metrics_history} />
              </div>

              {/* Explainable D2 Risk Factors */}
              <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-[#1F2421]">
                    Explainable Risk Factors
                  </h3>
                  <span className="text-xs text-[#5C645E]">
                    Advisor: {student.assigned_counselor_name}
                  </span>
                </div>
                <p className="text-sm text-[#5C645E] leading-relaxed">
                  {student.assessment.model_summary}
                </p>
                <div className="divide-y divide-[#E5DFD5] border-t border-[#E5DFD5] pt-1">
                  {student.assessment.contributing_factors.map((factor) => (
                    <div
                      key={factor.code}
                      className="py-2.5 flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#1F2421]">
                          {factor.label}
                        </div>
                        <div className="text-xs text-[#5C645E] mt-0.5">
                          {factor.detail}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono tabular-nums shrink-0 font-medium ${
                          factor.severity === 'high'
                            ? 'text-[#B91C1C]'
                            : factor.severity === 'medium'
                              ? 'text-[#B45309]'
                              : 'text-[#15803D]'
                        }`}
                      >
                        {factor.impact > 0
                          ? `+${factor.impact.toFixed(2)}`
                          : factor.impact < 0
                            ? factor.impact.toFixed(2)
                            : 'Nominal'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gemini AI Dossier Brief */}
              <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1F2421]">
                      AI Counselor Dossier Brief
                    </h3>
                    <p className="text-xs text-[#5C645E]">
                      Synthesizes verified metrics and recent student interactions into recommended steps.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBrief}
                    disabled={loadingBrief}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#4D7C5F] text-white hover:bg-[#3B624A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {loadingBrief ? 'Generating...' : 'Generate Brief'}
                  </button>
                </div>

                {briefError && (
                  <div className="p-3 rounded-lg bg-[#FEF9EC] border border-[#F3DFB1] text-xs text-[#B45309]">
                    {briefError}
                  </div>
                )}

                {aiBrief && (
                  <div className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E5DFD5] text-sm text-[#1F2421] whitespace-pre-wrap leading-relaxed">
                    {aiBrief}
                  </div>
                )}
              </div>

              {/* Admin-only quick metric check-in */}
              {activeRole === 'admin' && (
                <form
                  onSubmit={handleUpdateMetrics}
                  className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5 space-y-4"
                >
                  <h3 className="text-sm font-semibold text-[#1F2421]">
                    Record Daily Metric Check-In (Admin)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="block">
                      <span className="text-xs text-[#5C645E]">Attendance %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={attInput}
                        onChange={(e) => setAttInput(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm font-mono tabular-nums"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[#5C645E]">Test Score</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={testInput}
                        onChange={(e) => setTestInput(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm font-mono tabular-nums"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[#5C645E]">Assignment %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={assignInput}
                        onChange={(e) => setAssignInput(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm font-mono tabular-nums"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[#5C645E]">Standing</span>
                      <select
                        value={statusInput}
                        onChange={(e) =>
                          setStatusInput(e.target.value as EnrollmentStatus)
                        }
                        className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-2.5 py-1.5 text-sm"
                      >
                        <option value="Active">Active</option>
                        <option value="Probation">Probation</option>
                        <option value="Dropped">Dropped</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingMetrics}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1F2421] text-white hover:bg-[#343B37] disabled:opacity-60 transition-colors"
                    >
                      {savingMetrics ? 'Recalculating...' : 'Save Metrics & Assess Risk'}
                    </button>
                  </div>
                </form>
              )}

              {/* Log Counseling Session / Schedule Meeting */}
              <form
                onSubmit={handleSaveIntervention}
                className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#1F2421]">
                    Record Counseling Intervention
                  </h3>
                  <div className="inline-flex rounded-lg bg-[#F3EFEA] p-1">
                    <button
                      type="button"
                      onClick={() => setLogType('counselor_session')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        logType === 'counselor_session'
                          ? 'bg-[#FFFFFF] text-[#1F2421] shadow-xs'
                          : 'text-[#5C645E] hover:text-[#1F2421]'
                      }`}
                    >
                      Session Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogType('scheduled_meeting')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        logType === 'scheduled_meeting'
                          ? 'bg-[#FFFFFF] text-[#1F2421] shadow-xs'
                          : 'text-[#5C645E] hover:text-[#1F2421]'
                      }`}
                    >
                      Schedule Meeting
                    </button>
                  </div>
                </div>

                {logType === 'scheduled_meeting' && (
                  <label className="block">
                    <span className="text-xs text-[#5C645E]">
                      Proposed Date & Time
                    </span>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-2 text-sm font-mono"
                    />
                  </label>
                )}

                <textarea
                  rows={3}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder={
                    logType === 'scheduled_meeting'
                      ? 'Add meeting agenda, support goals, or location...'
                      : 'Document session observations, student stressors, and agreed next steps...'
                  }
                  className="w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1F2421] placeholder:text-[#8B918C] focus:outline-none focus:border-[#C2593F]"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !noteContent.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-[#C2593F] text-white hover:bg-[#A64630] disabled:opacity-50 transition-colors"
                  >
                    {savingNote
                      ? 'Saving...'
                      : logType === 'scheduled_meeting'
                        ? 'Schedule Session'
                        : 'Save Session Note'}
                  </button>
                </div>
              </form>

              {/* Persistent Intervention & AI Chat Transcript Log */}
              <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-[#1F2421]">
                  Intervention & AI Support History ({interventions.length})
                </h3>
                {interventions.length === 0 ? (
                  <p className="text-sm text-[#5C645E]">
                    No interventions or AI outreach sessions logged for this student yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E5DFD5]">
                    {interventions.map((log) => (
                      <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2 text-xs text-[#5C645E]">
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#1F2421]">
                            {log.log_type === 'scheduled_meeting' ? (
                              <Calendar className="w-3.5 h-3.5 text-[#4D7C5F]" />
                            ) : log.log_type === 'counselor_session' ? (
                              <FileText className="w-3.5 h-3.5 text-[#C2593F]" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5 text-[#5C645E]" />
                            )}
                            {log.actor_name}
                          </span>
                          <span className="font-mono tabular-nums">
                            {new Date(log.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {log.scheduled_for && (
                          <div className="mt-1 text-xs font-mono text-[#4D7C5F]">
                            Scheduled for: {log.scheduled_for.replace('T', ' ')}
                          </div>
                        )}
                        <p className="mt-1.5 text-sm text-[#1F2421] leading-relaxed whitespace-pre-wrap">
                          {log.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
