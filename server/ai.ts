import { GoogleGenAI } from '@google/genai';
import type {
  InterventionLog,
  RiskAssessment,
  StudentRecord,
} from '../src/types.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const CRISIS_PATTERNS = [
  /\b(kill myself|end my life|suicide|suicidal|want to die|don'?t want to live|hurt myself|self[- ]?harm|cutting myself|no reason to live)\b/i,
  /\b(hopeless|can'?t go on|end it all|give up on life)\b/i,
];

export function detectCrisisSignals(message: string): boolean {
  return CRISIS_PATTERNS.some((regex) => regex.test(message));
}

export async function generateEmpatheticCounselorReply(params: {
  student: Pick<
    StudentRecord,
    | 'student_id'
    | 'name'
    | 'program'
    | 'term'
    | 'enrollment_status'
    | 'attendance_pct'
    | 'test_score'
    | 'assignment_pct'
    | 'assigned_counselor_name'
  >;
  assessment: Pick<
    RiskAssessment,
    'probability_score' | 'risk_level' | 'contributing_factors'
  >;
  recentHistory: InterventionLog[];
  userMessage: string;
}): Promise<{
  reply: string;
  crisisEscalated: boolean;
  usedFallback: boolean;
}> {
  const { student, assessment, recentHistory, userMessage } = params;
  const isCrisis = detectCrisisSignals(userMessage);

  if (isCrisis) {
    const firstName = student.name.split(' ')[0];
    return {
      crisisEscalated: true,
      usedFallback: false,
      reply: `${firstName}, I'm really glad you reached out and told me what you're carrying right now. Your safety and well-being matter far more than any class or grade, and you do not have to navigate this alone.

Please connect with trained crisis support right away:
• 988 Suicide & Crisis Lifeline: Call or text 988 (free, confidential, 24/7)
• Crisis Text Line: Text HOME to 741741
• Campus Counseling Emergency Desk: (555) 019-2840 or walk into Wellness Hall Room 102

I have also sent an urgent priority alert to your counselor, ${student.assigned_counselor_name}, so a human advisor can reach out and support you directly. Would you like to stay here and talk while you reach out to one of those resources?`,
    };
  }

  const ai = getGeminiClient();
  const factorsText = assessment.contributing_factors
    .map((f) => `- ${f.label}: ${f.detail}`)
    .join('\n');

  const conversationContext = recentHistory
    .filter((l) => l.log_type === 'ai_outreach' || l.log_type === 'ai_chat')
    .slice(-8)
    .map((l) => `${l.actor_role === 'student' ? 'Student' : 'Beacon'}: ${l.content}`)
    .join('\n');

  const systemInstruction = `You are Beacon, the Empathetic AI Counselling Assistant for the "AI-Based Student Dropout Prediction and Counselling System".
Your purpose is to provide warm, empathetic, non-judgmental, and constructive conversational support directly to students so they feel heard and empowered to stay on track to graduation.

Persona & Tone Guidelines:
- Tone: Empathetic, warm, non-judgmental, professional, encouraging, and clear. Never sound robotic, punitive, or clinical.
- Perspective: Act as a supportive educational mentor. Validate academic or emotional stressors authentically before suggesting practical next steps.
- Data Integrity: Ground any mention of academic numbers strictly in the verified metrics below—never fabricate grades, attendance numbers, or history.
- Practical Guidance: Offer concrete, bite-sized study strategies (e.g., Pomodoro 25-minute blocks, prioritizing one overdue assignment, office hours script), stress-management techniques, and clear paths to meet with their human counselor (${student.assigned_counselor_name}).
- Safety Boundary: Never claim to replace professional mental health or medical counseling. Keep responses concise (2-3 short, readable paragraphs or a short empathetic validation + 2-3 actionable bullet points).

Verified Student Context:
- Name: ${student.name} (${student.student_id})
- Program: ${student.program} · ${student.term}
- Enrollment Status: ${student.enrollment_status}
- Current Attendance: ${student.attendance_pct}%
- Current Test Average: ${student.test_score}/100
- Assignment Completion: ${student.assignment_pct}%
- Current Risk Standing: ${assessment.risk_level} (${assessment.probability_score.toFixed(2)})
- Key Contributing Factors:
${factorsText}
- Assigned Human Counselor: ${student.assigned_counselor_name}`;

  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in environment secrets. Please configure GEMINI_API_KEY in Settings > Secrets.'
    );
  }

  const prompt = conversationContext
    ? `Recent conversation:\n${conversationContext}\n\nStudent's latest message:\n${userMessage}`
    : `Student's message:\n${userMessage}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return {
    reply: text,
    crisisEscalated: false,
    usedFallback: false,
  };
}

export async function generateCounselorDossierBrief(params: {
  student: Pick<
    StudentRecord,
    | 'student_id'
    | 'name'
    | 'program'
    | 'term'
    | 'enrollment_status'
    | 'attendance_pct'
    | 'test_score'
    | 'assignment_pct'
  >;
  assessment: Pick<
    RiskAssessment,
    'probability_score' | 'risk_level' | 'contributing_factors'
  >;
  recentLogs: InterventionLog[];
}): Promise<string> {
  const { student, assessment, recentLogs } = params;
  const ai = getGeminiClient();

  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in environment secrets. Please configure GEMINI_API_KEY in Settings > Secrets.'
    );
  }

  const factorsText = assessment.contributing_factors
    .map((f) => `- ${f.label}: ${f.detail}`)
    .join('\n');

  const logsText =
    recentLogs.length > 0
      ? recentLogs
          .slice(-6)
          .map(
            (l) =>
              `[${l.created_at.slice(0, 10)} · ${l.actor_name} (${l.log_type})]: ${l.content}`
          )
          .join('\n')
      : 'No prior intervention logs recorded.';

  const systemInstruction = `You are an analytical academic advising assistant preparing a concise Risk Dossier Brief for a human counselor or faculty member.
- Be objective, warm, concise, and actionable.
- Strictly reference only the supplied metrics and logs without inventing statistics.
- Structure into 3 brief parts: (1) Key Warning Signs, (2) Context from Recent Interactions, (3) 3 Recommended Counselor Next Steps.`;

  const prompt = `Prepare a counselor dossier brief for:
Student: ${student.name} (${student.student_id}) — ${student.program}, ${student.term}
Enrollment Status: ${student.enrollment_status}
Metrics: Attendance ${student.attendance_pct}%, Test Avg ${student.test_score}/100, Assignment Completion ${student.assignment_pct}%
Risk Assessment: ${assessment.risk_level} (Probability ${assessment.probability_score.toFixed(2)})
Contributing Factors:
${factorsText}

Recent Intervention History:
${logsText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty dossier brief.');
  }

  return text;
}
