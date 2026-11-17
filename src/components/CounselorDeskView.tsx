import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  Search,
} from 'lucide-react';
import { api, type RequestAuthContext } from '../api';
import type {
  CohortAnalytics,
  CounselorAlert,
  EnrollmentStatus,
  InterventionLog,
  RiskLevel,
  StudentRecord,
  SystemConfig,
} from '../types';
import {
  CohortTrendChart,
  RiskDistributionChart,
} from './AnalyticsCharts';
import { EnrollmentStatusLabel, RiskIndicator } from './RiskIndicator';

interface CounselorDeskViewProps {
  authCtx: RequestAuthContext;
  section: 'overview' | 'students' | 'alerts' | 'counseling';
  students: StudentRecord[];
  alerts: CounselorAlert[];
  analytics: CohortAnalytics;
  interventions: InterventionLog[];
  config: SystemConfig;
  onSelectStudent: (studentId: string) => void;
  onAlertsUpdated: (alerts: CounselorAlert[], message: string) => void;
}

export function CounselorDeskView({
  authCtx,
  section,
  students,
  alerts,
  analytics,
  interventions,
  config,
  onSelectStudent,
  onAlertsUpdated,
}: CounselorDeskViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EnrollmentStatus>('ALL');
  const [updatingAlertId, setUpdatingAlertId] = useState<number | null>(null);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.program.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk =
        riskFilter === 'ALL' || s.assessment.risk_level === riskFilter;
      const matchesStatus =
        statusFilter === 'ALL' || s.enrollment_status === statusFilter;
      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [students, searchQuery, riskFilter, statusFilter]);

  const handleAlertStatus = async (
    alertId: number,
    status: 'Acknowledged' | 'Resolved'
  ) => {
    setUpdatingAlertId(alertId);
    try {
      const res = await api.updateAlertStatus(authCtx, alertId, status);
      onAlertsUpdated(res.alerts, `Alert marked as ${status}.`);
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const openAlerts = alerts.filter((a) => a.status !== 'Resolved');

  return (
    <div className="space-y-8">
      {/* KPI Overview Strip — always shown on Overview */}
      {section === 'overview' && (
        <>
          <section aria-label="Cohort summary metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5">
              <div className="text-xs text-[#5C645E]">Monitored Students</div>
              <div className="mt-2 text-3xl font-mono tabular-nums font-semibold text-[#1F2421]">
                {analytics.total_students}
              </div>
              <div className="mt-1.5 text-xs text-[#5C645E] font-mono tabular-nums">
                {analytics.low_risk_count} Low · {analytics.medium_risk_count} Med
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5">
              <div className="text-xs text-[#5C645E]">Flagged High Risk</div>
              <div className="mt-2 text-3xl font-mono tabular-nums font-semibold text-[#B91C1C]">
                {analytics.high_risk_count}
              </div>
              <div className="mt-1.5 text-xs text-[#5C645E] font-mono tabular-nums">
                Threshold ≥ {config.high_risk_threshold.toFixed(2)}
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5">
              <div className="text-xs text-[#5C645E]">Unread Counselor Alerts</div>
              <div className="mt-2 text-3xl font-mono tabular-nums font-semibold text-[#C2593F]">
                {analytics.unread_alerts_count}
              </div>
              <div className="mt-1.5 text-xs text-[#5C645E]">
                Automated dossier routing
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5">
              <div className="text-xs text-[#5C645E]">Cohort Avg Attendance</div>
              <div className="mt-2 text-3xl font-mono tabular-nums font-semibold text-[#4D7C5F]">
                {analytics.avg_attendance}%
              </div>
              <div className="mt-1.5 text-xs text-[#5C645E] font-mono tabular-nums">
                Test {analytics.avg_test_score} · Assign {analytics.avg_assignment_pct}%
              </div>
            </div>
          </section>

          {/* Charts Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold text-[#1F2421]">
                  Cohort Attendance & Performance Trends
                </h2>
                <p className="text-xs text-[#5C645E] mt-0.5">
                  Weekly average attendance, exam scores, and assignment completion across enrolled students.
                </p>
              </div>
              <CohortTrendChart series={analytics.trend_series} />
            </div>

            <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold text-[#1F2421]">
                  Dropout Risk Distribution
                </h2>
                <p className="text-xs text-[#5C645E] mt-0.5">
                  Student count grouped by predicted dropout probability score.
                </p>
              </div>
              <RiskDistributionChart
                distribution={analytics.risk_distribution}
                threshold={config.high_risk_threshold}
              />
            </div>
          </section>
        </>
      )}

      {/* Priority Alerts Panel (shown on Overview and Alerts tabs) */}
      {(section === 'overview' || section === 'alerts') && (
        <section className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#1F2421] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#C2593F]" />
                Counselor Alert Queue
              </h2>
              <p className="text-xs text-[#5C645E] mt-0.5">
                Automatically dispatched when students breach the risk threshold or express acute distress.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#5C645E]">
              {openAlerts.length} active · {alerts.length} total
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#5C645E]">
              No counselor alerts triggered yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E5DFD5]">
              {(section === 'overview' ? openAlerts.slice(0, 4) : alerts).map((alert) => (
                <div
                  key={alert.id}
                  className="py-4 first:pt-1 last:pb-1 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${
                          alert.severity === 'URGENT'
                            ? 'bg-[#FDF2F2] text-[#B91C1C] border-[#F5C6C6]'
                            : 'bg-[#FEF9EC] text-[#B45309] border-[#F3DFB1]'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {alert.severity === 'URGENT' ? 'Urgent Escalation' : 'Threshold Breach'}
                      </span>
                      <span className="font-semibold text-sm text-[#1F2421]">
                        {alert.student_name}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-[#5C645E]">
                        {alert.student_id} · Score {alert.probability_score.toFixed(2)}
                      </span>
                      <span className="text-xs text-[#5C645E]">
                        · Status: <strong className="font-medium text-[#1F2421]">{alert.status}</strong>
                      </span>
                    </div>
                    <p className="text-sm text-[#5C645E]">{alert.trigger_reason}</p>
                    <div className="text-xs text-[#5C645E]">
                      Assigned to {alert.counselor_name} ·{' '}
                      <span className="font-mono tabular-nums">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {alert.status === 'Unread' && (
                      <button
                        type="button"
                        disabled={updatingAlertId === alert.id}
                        onClick={() => handleAlertStatus(alert.id, 'Acknowledged')}
                        className="px-3 py-1.5 rounded-lg border border-[#E5DFD5] text-xs font-medium text-[#1F2421] hover:bg-[#F3EFEA] transition-colors whitespace-nowrap"
                      >
                        Acknowledge
                      </button>
                    )}
                    {alert.status !== 'Resolved' && (
                      <button
                        type="button"
                        disabled={updatingAlertId === alert.id}
                        onClick={() => handleAlertStatus(alert.id, 'Resolved')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#C7E0CF] bg-[#F1F7F3] text-xs font-medium text-[#15803D] hover:bg-[#E4F1E8] transition-colors whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectStudent(alert.student_id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1F2421] text-white text-xs font-medium hover:bg-[#343B37] transition-colors whitespace-nowrap"
                    >
                      Inspect Dossier
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Live Student Risk Roster (shown on Overview and Students tabs) */}
      {(section === 'overview' || section === 'students') && (
        <section className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#1F2421]">
                Student Risk & Engagement Roster
              </h2>
              <p className="text-xs text-[#5C645E] mt-0.5">
                Sorted by predicted dropout probability. Select any student to inspect contributing factors and intervention logs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#5C645E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, ID, program..."
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] text-sm text-[#1F2421] placeholder:text-[#8B918C] focus:outline-none focus:border-[#C2593F] w-56"
                />
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#F3EFEA]">
                {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setRiskFilter(tier)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      riskFilter === tier
                        ? 'bg-[#FFFFFF] text-[#1F2421] shadow-xs'
                        : 'text-[#5C645E] hover:text-[#1F2421]'
                    }`}
                  >
                    {tier === 'ALL'
                      ? 'All Risks'
                      : tier === 'HIGH'
                        ? 'High'
                        : tier === 'MEDIUM'
                          ? 'Medium'
                          : 'Low'}
                  </button>
                ))}
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'ALL' | EnrollmentStatus)
                }
                aria-label="Filter by enrollment status"
                className="rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-[#1F2421]"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Probation">Probation</option>
                <option value="Dropped">Dropped</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5DFD5] text-xs font-medium text-[#5C645E]">
                  <th className="py-2.5 pr-4">Student</th>
                  <th className="py-2.5 px-3">Standing</th>
                  <th className="py-2.5 px-3 text-right">Attendance</th>
                  <th className="py-2.5 px-3 text-right">Tests</th>
                  <th className="py-2.5 px-3 text-right">Assignments</th>
                  <th className="py-2.5 px-3">Risk Assessment</th>
                  <th className="py-2.5 pl-3 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD5] text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#5C645E]">
                      No students match the current search or risk filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr
                      key={s.student_id}
                      onClick={() => onSelectStudent(s.student_id)}
                      className="hover:bg-[#FAF8F5] cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[#1F2421]">{s.name}</div>
                        <div className="text-xs text-[#5C645E]">
                          <span className="font-mono tabular-nums">{s.student_id}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{s.program}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <EnrollmentStatusLabel status={s.enrollment_status} />
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#1F2421]">
                        {s.attendance_pct}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#1F2421]">
                        {s.test_score}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#1F2421]">
                        {s.assignment_pct}%
                      </td>
                      <td className="py-3 px-3">
                        <RiskIndicator
                          level={s.assessment.risk_level}
                          score={s.assessment.probability_score}
                        />
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStudent(s.student_id);
                          }}
                          className="text-xs font-medium text-[#C2593F] hover:text-[#A64630] whitespace-nowrap"
                        >
                          Open Dossier
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Persistent Counseling & Intervention Activity Feed */}
      {(section === 'counseling' || section === 'overview') && (
        <section className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#1F2421]">
                Recent Intervention & Counselling Logs
              </h2>
              <p className="text-xs text-[#5C645E] mt-0.5">
                Chronological audit of AI outreach transcripts, scheduled advising sessions, and counselor notes.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#5C645E]">
              {interventions.length} entries
            </span>
          </div>

          <div className="divide-y divide-[#E5DFD5]">
            {(section === 'overview' ? interventions.slice(0, 6) : interventions).map(
              (log) => (
                <div
                  key={log.id}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onSelectStudent(log.student_id)}
                        className="font-semibold text-[#1F2421] hover:text-[#C2593F] underline-offset-2 hover:underline"
                      >
                        {log.student_name || log.student_id}
                      </button>
                      <span className="text-[#5C645E]">·</span>
                      <span className="text-[#5C645E]">{log.actor_name}</span>
                      <span className="text-[#5C645E]">·</span>
                      <span
                        className={`font-medium ${
                          log.log_type === 'escalation'
                            ? 'text-[#B91C1C]'
                            : log.log_type === 'counselor_session' ||
                                log.log_type === 'scheduled_meeting'
                              ? 'text-[#4D7C5F]'
                              : 'text-[#C2593F]'
                        }`}
                      >
                        {log.log_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-[#1F2421] leading-relaxed">
                      {log.content}
                    </p>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[#5C645E] shrink-0">
                    {new Date(log.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
