import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, LogOut, X } from 'lucide-react';
import { api, type BootstrapPayload, type RequestAuthContext } from './api';
import { AdminConsoleView } from './components/AdminConsoleView';
import { CounselorDeskView } from './components/CounselorDeskView';
import { PersonaAvatar } from './components/RiskIndicator';
import { StudentDossierDrawer } from './components/StudentDossierDrawer';
import { StudentPortalView } from './components/StudentPortalView';
import { useAuth } from './context/AuthContext';
import type { CounselorAlert, InterventionLog, UserAccount } from './types';

type ActiveSection =
  | 'overview'
  | 'students'
  | 'alerts'
  | 'counseling'
  | 'admin';

export default function App() {
  const {
    demoAccounts,
    activeDemoUser,
    loadingAuth,
    authError,
    selectDemoAccount,
    refreshDemoAccounts,
    signOutDemo,
    getToken,
  } = useAuth();

  const authCtx: RequestAuthContext = useMemo(
    () => ({ getToken }),
    [getToken]
  );

  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [section, setSection] = useState<ActiveSection>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadWorkspace = useCallback(async () => {
    if (!activeDemoUser) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bootRes = await api.bootstrap(authCtx);
      setData(bootRes);
      if (bootRes.user.role === 'student') {
        setSelectedStudentId(null);
        setSection('overview');
      } else if (bootRes.user.role === 'counselor' && section === 'admin') {
        setSection('overview');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load workspace data.'
      );
    } finally {
      setLoading(false);
    }
  }, [activeDemoUser, authCtx, section]);

  useEffect(() => {
    loadWorkspace();
  }, [activeDemoUser, authCtx]);

  const handleSelectDemo = (account: UserAccount) => {
    setSelectedStudentId(null);
    setSection('overview');
    selectDemoAccount(account);
  };

  const handleDataMutated = (message: string) => {
    showToast(message);
    loadWorkspace();
    refreshDemoAccounts();
  };

  const handleAlertsUpdated = (alerts: CounselorAlert[], message: string) => {
    showToast(message);
    setData((prev) =>
      prev
        ? {
            ...prev,
            alerts,
            analytics: prev.analytics
              ? {
                  ...prev.analytics,
                  unread_alerts_count: alerts.filter(
                    (a) => a.status === 'Unread'
                  ).length,
                }
              : prev.analytics,
          }
        : prev
    );
  };

  const handleStudentInterventionsUpdated = (logs: InterventionLog[]) => {
    setData((prev) => (prev ? { ...prev, interventions: logs } : prev));
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-sm text-[#5C645E]">
        Loading demo accounts...
      </div>
    );
  }

  // Demo Account Sign-In Screen
  if (!activeDemoUser) {
    const adminAccounts = demoAccounts.filter((a) => a.role === 'admin');
    const counselorAccounts = demoAccounts.filter((a) => a.role === 'counselor');
    const studentAccounts = demoAccounts.filter((a) => a.role === 'student');

    const groups = [
      {
        heading: 'Admin & Faculty',
        subtitle: 'Bulk CSV ingestion, risk threshold rules, and user accounts',
        items: adminAccounts,
      },
      {
        heading: 'Counselors & Advisors',
        subtitle: 'Live at-risk queues, dossier inspection, and intervention logs',
        items: counselorAccounts,
      },
      {
        heading: 'Student Support Portal',
        subtitle: 'Personal standing overview and Gemini AI empathetic chat',
        items: studentAccounts,
      },
    ];

    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1F2421] flex flex-col justify-between px-6 py-10">
        <header className="max-w-[1100px] w-full mx-auto flex items-center justify-between">
          <span className="font-display text-2xl font-semibold tracking-tight text-[#1F2421]">
            Beacon
          </span>
          <span className="text-xs text-[#5C645E]">
            Student Dropout Prediction & Counselling
          </span>
        </header>

        <main className="max-w-[1100px] w-full mx-auto my-10 space-y-8">
          <div className="max-w-2xl space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#1F2421] text-balance">
              Select a Demo Account to Enter
            </h1>
            <p className="text-sm text-[#5C645E] leading-relaxed">
              Sign in with one click using any pre-seeded PostgreSQL role profile. Role-based permissions are enforced server-side across every endpoint.
            </p>
          </div>

          {authError && (
            <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#F5C6C6] flex items-center justify-between gap-4 text-xs text-[#B91C1C]">
              <span>{authError}</span>
              <button
                type="button"
                onClick={refreshDemoAccounts}
                className="px-3 py-1.5 rounded-md bg-[#B91C1C] text-white font-medium"
              >
                Retry
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <section
                key={group.heading}
                className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#1F2421]">
                    {group.heading}
                  </h2>
                  <p className="text-xs text-[#5C645E] mt-1">
                    {group.subtitle}
                  </p>
                </div>

                <div className="divide-y divide-[#E5DFD5] border-t border-[#E5DFD5]">
                  {group.items.map((account) => (
                    <button
                      key={account.uid}
                      type="button"
                      onClick={() => handleSelectDemo(account)}
                      className="w-full py-3.5 first:pt-3.5 last:pb-1 flex items-center justify-between gap-3 text-left hover:bg-[#FAF8F5] px-2 -mx-2 rounded-md transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PersonaAvatar
                          src={account.avatar_url}
                          name={account.name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1F2421] truncate">
                            {account.name}
                          </div>
                          <div className="text-xs text-[#5C645E] truncate">
                            {account.title}
                          </div>
                          <div className="text-[11px] font-mono text-[#5C645E] truncate">
                            {account.email}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#5C645E] group-hover:text-[#C2593F] shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>

        <footer className="max-w-[1100px] w-full mx-auto text-center text-xs text-[#5C645E]">
          Beacon Early-Warning & Student Counselling System · Cloud SQL PostgreSQL
        </footer>
      </div>
    );
  }

  const activeUser = data?.user ?? activeDemoUser;
  const unreadCount = data?.analytics?.unread_alerts_count ?? 0;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F2421] flex flex-col">
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E5DFD5]">
        <div className="max-w-[1380px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setSection('overview')}
            className="font-display text-xl font-semibold tracking-tight text-[#1F2421] whitespace-nowrap shrink-0 text-left cursor-pointer"
          >
            Beacon
          </button>

          <nav
            aria-label="Primary workspace navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {activeUser.role === 'student' ? (
              <>
                <a
                  href="#student-portal"
                  className="text-[#1F2421] border-b-2 border-[#C2593F] py-5 whitespace-nowrap shrink-0"
                >
                  Academic Standing
                </a>
                <a
                  href="#student-portal"
                  className="text-[#5C645E] hover:text-[#1F2421] py-5 whitespace-nowrap shrink-0 transition-colors"
                >
                  AI Support Mentor
                </a>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSection('overview')}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    section === 'overview'
                      ? 'border-[#C2593F] text-[#1F2421]'
                      : 'border-transparent text-[#5C645E] hover:text-[#1F2421]'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setSection('students')}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    section === 'students'
                      ? 'border-[#C2593F] text-[#1F2421]'
                      : 'border-transparent text-[#5C645E] hover:text-[#1F2421]'
                  }`}
                >
                  Students
                </button>
                <button
                  type="button"
                  onClick={() => setSection('alerts')}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    section === 'alerts'
                      ? 'border-[#C2593F] text-[#1F2421]'
                      : 'border-transparent text-[#5C645E] hover:text-[#1F2421]'
                  }`}
                >
                  Alerts{unreadCount > 0 ? ` (${unreadCount})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setSection('counseling')}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    section === 'counseling'
                      ? 'border-[#C2593F] text-[#1F2421]'
                      : 'border-transparent text-[#5C645E] hover:text-[#1F2421]'
                  }`}
                >
                  Counseling Logs
                </button>
                {activeUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setSection('admin')}
                    className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      section === 'admin'
                        ? 'border-[#C2593F] text-[#1F2421]'
                        : 'border-transparent text-[#5C645E] hover:text-[#1F2421]'
                    }`}
                  >
                    Ingestion & Rules
                  </button>
                )}
              </>
            )}
          </nav>

          <div className="shrink-0">
            {activeUser.role === 'admin' ? (
              <button
                type="button"
                onClick={() => setSection('admin')}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[#C2593F] text-white hover:bg-[#A64630] transition-colors whitespace-nowrap shrink-0"
              >
                Import Metrics
              </button>
            ) : activeUser.role === 'counselor' ? (
              <button
                type="button"
                onClick={() => setSection('alerts')}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[#C2593F] text-white hover:bg-[#A64630] transition-colors whitespace-nowrap shrink-0"
              >
                Review Alerts
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>(
                    '#student-portal input[type="text"]'
                  );
                  input?.focus();
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[#4D7C5F] text-white hover:bg-[#3B624A] transition-colors whitespace-nowrap shrink-0"
              >
                Message Mentor
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Active Demo Account & Quick Role Switcher Toolbar */}
      <div className="bg-[#F3EFEA] border-b border-[#E5DFD5]">
        <div className="max-w-[1380px] mx-auto px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PersonaAvatar
              src={activeUser.avatar_url}
              name={activeUser.name}
              size="md"
            />
            <div>
              <div className="text-sm font-semibold text-[#1F2421]">
                {activeUser.name}
              </div>
              <div className="text-xs text-[#5C645E]">
                <span className="capitalize font-medium text-[#1F2421]">
                  {activeUser.role}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{activeUser.title}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[#5C645E] mr-1">
              Demo Account:
            </span>
            {demoAccounts.map((acc) => {
              const isSelected = acc.uid === activeDemoUser.uid;
              return (
                <button
                  key={acc.uid}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#1F2421] text-white'
                      : 'bg-[#FFFFFF] border border-[#E5DFD5] text-[#5C645E] hover:text-[#1F2421]'
                  }`}
                >
                  {acc.name.split(',')[0]} ({acc.role})
                </button>
              );
            })}
            <button
              type="button"
              onClick={signOutDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5DFD5] bg-[#FFFFFF] text-xs font-medium text-[#5C645E] hover:text-[#1F2421] transition-colors whitespace-nowrap ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Tabs */}
      {activeUser.role !== 'student' && (
        <div className="md:hidden bg-[#FFFFFF] border-b border-[#E5DFD5] px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {(
            [
              ['overview', 'Overview'],
              ['students', 'Students'],
              ['alerts', `Alerts${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
              ['counseling', 'Counseling'],
              ...(activeUser.role === 'admin'
                ? ([['admin', 'Ingestion & Rules']] as const)
                : []),
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                section === key
                  ? 'bg-[#1F2421] text-white'
                  : 'text-[#5C645E] hover:text-[#1F2421]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Toast Confirmation */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-md bg-[#1F2421] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 text-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-[#84C59C] shrink-0" />
          <span className="leading-relaxed">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-white/70 hover:text-white ml-1"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-8">
        <div className="mb-7">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1F2421] text-balance">
            {activeUser.role === 'student'
              ? 'Student Success & Support Portal'
              : section === 'admin'
                ? 'Data Ingestion, Risk Rules & Access Control'
                : section === 'alerts'
                  ? 'Automated Alert Queue & Triage'
                  : section === 'students'
                    ? 'Cohort Risk & Engagement Directory'
                    : section === 'counseling'
                      ? 'Counseling Sessions & Intervention Logs'
                      : 'Student Retention & Early-Warning Overview'}
          </h1>
          <p className="mt-1 text-sm text-[#5C645E]">
            {activeUser.role === 'student'
              ? 'Review your live academic trajectory and connect with Beacon AI Mentor for supportive guidance.'
              : 'Explainable dropout risk intelligence paired with timely faculty alerts and compassionate student outreach.'}
          </p>
        </div>

        {loading && !data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-lg bg-[#FFFFFF] border border-[#E5DFD5] p-5 animate-pulse"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="p-5 rounded-lg bg-[#FDF2F2] border border-[#F5C6C6] flex items-center justify-between gap-4 mb-6">
            <div className="text-sm text-[#B91C1C]">{error}</div>
            <button
              type="button"
              onClick={loadWorkspace}
              className="px-3.5 py-1.5 rounded-lg bg-[#B91C1C] text-white text-xs font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            {activeUser.role === 'student' ? (
              data.myStudent ? (
                <div id="student-portal">
                  <StudentPortalView
                    authCtx={authCtx}
                    activeUser={activeUser}
                    student={data.myStudent}
                    initialInterventions={data.interventions ?? []}
                    onInterventionsUpdated={handleStudentInterventionsUpdated}
                  />
                </div>
              ) : (
                <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-8 text-center text-sm text-[#5C645E]">
                  No student academic profile is linked to this account yet.
                </div>
              )
            ) : section === 'admin' && activeUser.role === 'admin' ? (
              <AdminConsoleView
                authCtx={authCtx}
                currentUserId={activeUser.id}
                config={data.config}
                users={data.users ?? []}
                onRefreshNeeded={handleDataMutated}
              />
            ) : (
              data.analytics && (
                <CounselorDeskView
                  authCtx={authCtx}
                  section={section === 'admin' ? 'overview' : section}
                  students={data.students ?? []}
                  alerts={data.alerts ?? []}
                  analytics={data.analytics}
                  interventions={data.interventions ?? []}
                  config={data.config}
                  onSelectStudent={(sid) => setSelectedStudentId(sid)}
                  onAlertsUpdated={handleAlertsUpdated}
                />
              )
            )}
          </>
        )}
      </main>

      <footer className="border-t border-[#E5DFD5] bg-[#FFFFFF]">
        <div className="max-w-[1380px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#5C645E]">
          <span>Beacon Early-Warning & Student Counselling System</span>
          <span className="font-mono tabular-nums">
            Active High-Risk Threshold: {data?.config.high_risk_threshold.toFixed(2) ?? '0.70'}
          </span>
        </div>
      </footer>

      {activeUser.role !== 'student' && (
        <StudentDossierDrawer
          studentId={selectedStudentId}
          authCtx={authCtx}
          activeRole={activeUser.role}
          onClose={() => setSelectedStudentId(null)}
          onDataMutated={handleDataMutated}
        />
      )}
    </div>
  );
}
