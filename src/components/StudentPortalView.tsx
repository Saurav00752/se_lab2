import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  HeartHandshake,
  PhoneCall,
  Send,
  Sparkles,
} from 'lucide-react';
import { api, type RequestAuthContext } from '../api';
import type { InterventionLog, StudentRecord, UserAccount } from '../types';
import { StudentTrajectoryChart } from './AnalyticsCharts';
import { EnrollmentStatusLabel, RiskIndicator } from './RiskIndicator';

interface StudentPortalViewProps {
  authCtx: RequestAuthContext;
  activeUser: UserAccount;
  student: StudentRecord;
  initialInterventions: InterventionLog[];
  onInterventionsUpdated: (logs: InterventionLog[]) => void;
}

const STARTER_PROMPTS = [
  "I've been falling behind on assignments and feel overwhelmed.",
  'Can you help me build a realistic 3-day study catch-up plan?',
  "I missed class this week and I'm nervous about talking to my professor.",
];

export function StudentPortalView({
  authCtx,
  student,
  initialInterventions,
  onInterventionsUpdated,
}: StudentPortalViewProps) {
  const [messages, setMessages] = useState<InterventionLog[]>(initialInterventions);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [crisisActive, setCrisisActive] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initialInterventions);
    setCrisisActive(
      initialInterventions.some((l) => l.log_type === 'escalation')
    );
  }, [initialInterventions, student.student_id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const chatThread = messages.filter(
    (m) =>
      m.log_type === 'ai_outreach' ||
      m.log_type === 'ai_chat' ||
      m.log_type === 'escalation'
  );

  const upcomingMeetings = messages.filter(
    (m) => m.log_type === 'scheduled_meeting'
  );

  const handleSend = async (textToSend?: string) => {
    const content = (textToSend ?? draft).trim();
    if (!content || sending) return;

    setChatError(null);
    if (!textToSend) setDraft('');

    const optimisticMsg: InterventionLog = {
      id: Date.now(),
      student_id: student.student_id,
      actor_role: 'student',
      actor_name: student.name,
      log_type: 'ai_chat',
      content,
      scheduled_for: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);

    try {
      const res = await api.sendChatMessage(authCtx, {
        student_id: student.student_id,
        message: content,
      });
      setMessages(res.interventions);
      onInterventionsUpdated(res.interventions);
      if (res.crisisEscalated) {
        setCrisisActive(true);
      }
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Beacon AI Mentor right now.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Personal Standing & Supportive Guidance */}
      <div className="lg:col-span-5 space-y-6">
        <section className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-[#5C645E]">
                Personal Academic Snapshot
              </div>
              <h2 className="font-display text-2xl font-semibold text-[#1F2421] mt-0.5">
                Welcome back, {student.name.split(' ')[0]}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5C645E]">
                <span className="font-mono tabular-nums">{student.student_id}</span>
                <span aria-hidden="true">·</span>
                <span>{student.program}</span>
                <span aria-hidden="true">·</span>
                <EnrollmentStatusLabel status={student.enrollment_status} />
              </div>
            </div>
            <RiskIndicator
              level={student.assessment.risk_level}
              score={student.assessment.probability_score}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-lg bg-[#FAF8F5] border border-[#E5DFD5] p-3">
              <div className="text-[11px] text-[#5C645E]">Attendance</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-[#1F2421]">
                {student.attendance_pct}%
              </div>
            </div>
            <div className="rounded-lg bg-[#FAF8F5] border border-[#E5DFD5] p-3">
              <div className="text-[11px] text-[#5C645E]">Test Avg</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-[#1F2421]">
                {student.test_score}
              </div>
            </div>
            <div className="rounded-lg bg-[#FAF8F5] border border-[#E5DFD5] p-3">
              <div className="text-[11px] text-[#5C645E]">Assignments</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-[#1F2421]">
                {student.assignment_pct}%
              </div>
            </div>
          </div>

          <div className="pt-2">
            <StudentTrajectoryChart history={student.metrics_history} />
          </div>
        </section>

        <section className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-3">
          <h3 className="text-sm font-semibold text-[#1F2421]">
            What Shapes Your Standing
          </h3>
          <p className="text-xs text-[#5C645E] leading-relaxed">
            These indicators help your advising team spot when a semester gets heavy so we can offer tutoring, flexible deadlines, or personal support early.
          </p>
          <div className="divide-y divide-[#E5DFD5]">
            {student.assessment.contributing_factors.map((f) => (
              <div key={f.code} className="py-2.5 first:pt-1 last:pb-1">
                <div className="text-sm font-medium text-[#1F2421]">{f.label}</div>
                <div className="text-xs text-[#5C645E] mt-0.5">{f.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#1F2421]">
              Your Human Advising Team
            </h3>
            <span className="text-xs font-medium text-[#4D7C5F]">
              Available Mon–Fri
            </span>
          </div>
          <p className="text-sm text-[#1F2421]">
            Assigned Counselor:{' '}
            <strong className="font-semibold">
              {student.assigned_counselor_name}
            </strong>
          </p>

          {upcomingMeetings.length > 0 ? (
            <div className="pt-2 border-t border-[#E5DFD5] space-y-2">
              <div className="text-xs font-medium text-[#5C645E]">
                Scheduled Advising Sessions
              </div>
              {upcomingMeetings.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-lg bg-[#F1F7F3] border border-[#C7E0CF] text-xs space-y-1"
                >
                  <div className="flex items-center gap-1.5 font-medium text-[#15803D]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">
                      {m.scheduled_for?.replace('T', ' ') || 'Upcoming'}
                    </span>
                  </div>
                  <p className="text-[#1F2421]">{m.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5C645E]">
              You can ask Beacon AI Mentor anytime to help prepare questions or request a 1-on-1 advising meeting.
            </p>
          )}
        </section>
      </div>

      {/* Right Column: Empathetic Gemini AI Counselling Chat */}
      <section className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg flex flex-col h-[680px]">
        <div className="px-6 py-4 border-b border-[#E5DFD5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F1F7F3] border border-[#C7E0CF] flex items-center justify-center text-[#4D7C5F]">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-[#1F2421]">
                Beacon AI Support Mentor
              </h2>
              <p className="text-xs text-[#5C645E]">
                Private, judgment-free guidance for coursework, stress, and study planning
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4D7C5F]">
            <Sparkles className="w-3.5 h-3.5" />
            Empathetic Chat
          </span>
        </div>

        {crisisActive && (
          <div className="mx-6 mt-4 p-4 rounded-lg bg-[#FDF2F2] border border-[#F5C6C6] text-xs text-[#1F2421] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#B91C1C]">
              <PhoneCall className="w-4 h-4" />
              Immediate Support & Counselor Escalation Active
            </div>
            <p className="leading-relaxed">
              Your counselor ({student.assigned_counselor_name}) has been alerted for priority human outreach. If you need immediate support right now, call or text{' '}
              <strong className="font-mono">988</strong> (24/7 Lifeline) or text{' '}
              <strong className="font-mono">HOME</strong> to{' '}
              <strong className="font-mono">741741</strong>.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {chatThread.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
              <div className="w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#E5DFD5] flex items-center justify-center text-[#4D7C5F]">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-[#1F2421]">
                A supportive space to check in
              </h3>
              <p className="text-sm text-[#5C645E] leading-relaxed">
                Whether a class feels overwhelming, you missed a few sessions, or you just want a manageable plan for this week, I'm here to help.
              </p>
            </div>
          ) : (
            chatThread.map((msg) => {
              const isStudent = msg.actor_role === 'student';
              const isSystem = msg.actor_role === 'system';

              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="mx-auto max-w-lg text-center text-xs text-[#B91C1C] bg-[#FDF2F2] border border-[#F5C6C6] rounded-lg px-4 py-2"
                  >
                    {msg.content}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isStudent ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="text-[11px] text-[#5C645E] mb-1 px-1">
                    {isStudent ? 'You' : msg.actor_name} ·{' '}
                    <span className="font-mono tabular-nums">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isStudent
                        ? 'bg-[#1F2421] text-white'
                        : 'bg-[#FAF8F5] border border-[#E5DFD5] text-[#1F2421]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex flex-col items-start">
              <div className="text-[11px] text-[#5C645E] mb-1 px-1">
                Beacon AI Mentor
              </div>
              <div className="rounded-lg px-4 py-3 bg-[#FAF8F5] border border-[#E5DFD5] text-sm text-[#5C645E]">
                Thinking through a supportive response...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="px-6 py-4 border-t border-[#E5DFD5] bg-[#FAF8F5] space-y-3 rounded-b-lg">
          {chatError && (
            <div className="p-3 rounded-lg bg-[#FEF9EC] border border-[#F3DFB1] text-xs text-[#B45309]">
              {chatError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={sending}
                onClick={() => handleSend(prompt)}
                className="text-left text-xs px-3 py-1.5 rounded-lg border border-[#E5DFD5] bg-[#FFFFFF] text-[#5C645E] hover:text-[#1F2421] hover:border-[#C2593F] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2.5"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share what's on your mind or ask for study strategies..."
              disabled={sending}
              className="flex-1 rounded-lg border border-[#E5DFD5] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#1F2421] placeholder:text-[#8B918C] focus:outline-none focus:border-[#C2593F]"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C2593F] text-white text-sm font-medium hover:bg-[#A64630] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
