import { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Sliders,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { api, type RequestAuthContext } from '../api';
import type {
  EnrollmentStatus,
  SystemConfig,
  UserAccount,
  UserRole,
} from '../types';

interface AdminConsoleViewProps {
  authCtx: RequestAuthContext;
  currentUserId: number;
  config: SystemConfig;
  users: UserAccount[];
  onRefreshNeeded: (toastMessage: string) => void;
}

const SAMPLE_CSV = `student_id,name,program,enrollment_status,attendance_pct,test_score,assignment_pct,notes
STU-1087,Jordan Alvarez,B.A. Economics,Active,58,54,48,Sharp drop after midterms
STU-1091,Marcus Boateng,B.S. Data Science,Active,71,65,62,Missed two weekly labs
STU-1148,Hannah Sterling,B.S. Chemistry,Probation,49,44,39,New transfer check-in`;

interface ParsedIngestRow {
  student_id: string;
  name?: string;
  program?: string;
  enrollment_status?: EnrollmentStatus;
  attendance_pct: number;
  test_score: number;
  assignment_pct: number;
  notes?: string;
}

function parseCsvText(csvText: string): ParsedIngestRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: ParsedIngestRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? '';
    });

    if (!obj.student_id) continue;
    const att = Number(obj.attendance_pct);
    const test = Number(obj.test_score);
    const assign = Number(obj.assignment_pct);
    if (Number.isNaN(att) || Number.isNaN(test) || Number.isNaN(assign)) continue;

    const status =
      obj.enrollment_status === 'Probation' || obj.enrollment_status === 'Dropped'
        ? obj.enrollment_status
        : 'Active';

    rows.push({
      student_id: obj.student_id,
      name: obj.name || undefined,
      program: obj.program || undefined,
      enrollment_status: status,
      attendance_pct: Math.max(0, Math.min(100, att)),
      test_score: Math.max(0, Math.min(100, test)),
      assignment_pct: Math.max(0, Math.min(100, assign)),
      notes: obj.notes || undefined,
    });
  }
  return rows;
}

export function AdminConsoleView({
  authCtx,
  currentUserId,
  config,
  users,
  onRefreshNeeded,
}: AdminConsoleViewProps) {
  // Bulk ingestion state
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Add student state
  const [newStuId, setNewStuId] = useState('');
  const [newStuName, setNewStuName] = useState('');
  const [newStuProgram, setNewStuProgram] = useState('B.S. Computer Science');
  const [newStuStatus, setNewStuStatus] = useState<EnrollmentStatus>('Active');
  const [newStuAtt, setNewStuAtt] = useState(84);
  const [newStuTest, setNewStuTest] = useState(78);
  const [newStuAssign, setNewStuAssign] = useState(82);
  const [addingStudent, setAddingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  // Threshold & weights state
  const [highThreshold, setHighThreshold] = useState(config.high_risk_threshold);
  const [medThreshold, setMedThreshold] = useState(config.medium_risk_threshold);
  const [wAtt, setWAtt] = useState(config.weight_attendance);
  const [wTest, setWTest] = useState(config.weight_test_score);
  const [wAssign, setWAssign] = useState(config.weight_assignment);
  const [savingConfig, setSavingConfig] = useState(false);

  // User account creation state
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('counselor');
  const [userTitle, setUserTitle] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const parsedPreview = useMemo(() => parseCsvText(csvText), [csvText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleCommitBulk = async () => {
    setIngestError(null);
    if (parsedPreview.length === 0) {
      setIngestError('No valid CSV rows detected. Ensure header row and numeric metrics are present.');
      return;
    }
    setIngesting(true);
    try {
      const res = await api.bulkIngest(authCtx, parsedPreview);
      onRefreshNeeded(
        `Ingested ${res.processed} records · ${res.alertsTriggered} new alerts · ${res.outreachStarted} AI outreach sessions started.`
      );
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Bulk import failed.');
    } finally {
      setIngesting(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError(null);
    if (!newStuId.trim() || !newStuName.trim()) {
      setStudentError('Student ID and Name are required.');
      return;
    }
    setAddingStudent(true);
    try {
      const res = await api.createStudent(authCtx, {
        student_id: newStuId.trim(),
        name: newStuName.trim(),
        program: newStuProgram.trim(),
        enrollment_status: newStuStatus,
        attendance_pct: newStuAtt,
        test_score: newStuTest,
        assignment_pct: newStuAssign,
      });
      setNewStuId('');
      setNewStuName('');
      onRefreshNeeded(
        `Added ${res.student.name} (${res.outcome.riskLevel} Risk · ${res.outcome.probabilityScore.toFixed(2)}).`
      );
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : 'Could not add student.');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await api.updateConfig(authCtx, {
        high_risk_threshold: highThreshold,
        medium_risk_threshold: medThreshold,
        weight_attendance: wAtt,
        weight_test_score: wTest,
        weight_assignment: wAssign,
      });
      onRefreshNeeded(
        `Risk thresholds updated (High ≥ ${res.config.high_risk_threshold.toFixed(2)}). ${res.newlyFlagged} new high-risk alerts dispatched.`
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    if (!userName.trim() || !userEmail.trim()) {
      setUserError('Name and email are required.');
      return;
    }
    setCreatingUser(true);
    try {
      const res = await api.createUser(authCtx, {
        name: userName.trim(),
        email: userEmail.trim(),
        role: userRole,
        title: userTitle.trim() || undefined,
      });
      setUserName('');
      setUserEmail('');
      setUserTitle('');
      onRefreshNeeded(`Created ${res.user.role} account for ${res.user.name}.`);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserActive = async (target: UserAccount) => {
    await api.updateUser(authCtx, target.id, { active: !target.active });
    onRefreshNeeded(
      `${target.name} account ${target.active ? 'deactivated' : 'reactivated'}.`
    );
  };

  return (
    <div className="space-y-8">
      {/* Row 1: Bulk Data Ingestion + Risk Threshold Tuning */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Bulk Data Ingestion (D1) */}
        <section className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#1F2421] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#C2593F]" />
                Bulk Student Metrics Ingestion
              </h2>
              <p className="text-xs text-[#5C645E] mt-0.5">
                Import daily attendance, test scores, and assignment completion via CSV to trigger real-time D2 risk scoring and D3 alerts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] text-xs font-medium text-[#1F2421] hover:bg-[#F3EFEA] cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setCsvText(SAMPLE_CSV)}
                className="px-3 py-1.5 rounded-lg border border-[#E5DFD5] text-xs font-medium text-[#5C645E] hover:text-[#1F2421] transition-colors whitespace-nowrap"
              >
                Load Sample
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            aria-label="CSV bulk student metrics input"
            className="w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] p-3 text-xs font-mono text-[#1F2421] focus:outline-none focus:border-[#C2593F]"
          />

          {ingestError && (
            <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F5C6C6] text-xs text-[#B91C1C]">
              {ingestError}
            </div>
          )}

          <div className="border border-[#E5DFD5] rounded-lg overflow-hidden">
            <div className="bg-[#FAF8F5] px-3 py-2 border-b border-[#E5DFD5] flex items-center justify-between text-xs text-[#5C645E]">
              <span>Parsed Preview ({parsedPreview.length} valid rows)</span>
              <span className="font-mono">0–100% bounds enforced</span>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-[#E5DFD5] text-xs">
              {parsedPreview.map((r, idx) => (
                <div
                  key={`${r.student_id}-${idx}`}
                  className="px-3 py-2 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="font-mono font-medium text-[#1F2421]">
                      {r.student_id}
                    </span>
                    {r.name && (
                      <span className="text-[#5C645E]"> · {r.name}</span>
                    )}
                  </div>
                  <div className="font-mono tabular-nums text-[#5C645E]">
                    Att {r.attendance_pct}% · Test {r.test_score} · Assign {r.assignment_pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCommitBulk}
              disabled={ingesting || parsedPreview.length === 0}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-[#C2593F] text-white hover:bg-[#A64630] disabled:opacity-50 transition-colors"
            >
              {ingesting
                ? 'Ingesting & Assessing Cohort...'
                : `Ingest ${parsedPreview.length} Records & Run Risk Engine`}
            </button>
          </div>
        </section>

        {/* AI Risk Threshold Configurator (D2) */}
        <form
          onSubmit={handleSaveConfig}
          className="lg:col-span-5 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-5"
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1F2421] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#4D7C5F]" />
              AI Risk Thresholds & Weights
            </h2>
            <p className="text-xs text-[#5C645E] mt-0.5">
              Adjusting thresholds immediately re-evaluates all students and dispatches alerts for newly flagged cohorts.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-[#1F2421]">
                  High-Risk Alert Threshold
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#B91C1C]">
                  {highThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={0.9}
                step={0.05}
                value={highThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHighThreshold(val);
                  if (medThreshold >= val - 0.1) {
                    setMedThreshold(Number((val - 0.15).toFixed(2)));
                  }
                }}
                className="w-full accent-[#C2593F]"
              />
            </label>

            <label className="block">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-[#1F2421]">
                  Medium-Risk Watch Threshold
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                  {medThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={Number((highThreshold - 0.1).toFixed(2))}
                step={0.05}
                value={medThreshold}
                onChange={(e) => setMedThreshold(Number(e.target.value))}
                className="w-full accent-[#B45309]"
              />
            </label>

            <div className="pt-2 border-t border-[#E5DFD5] space-y-3">
              <div className="text-xs font-medium text-[#5C645E]">
                Model Feature Weights (auto-normalized)
              </div>

              <label className="block">
                <div className="flex justify-between text-xs mb-1">
                  <span>Attendance Deficit Weight</span>
                  <span className="font-mono tabular-nums">{wAtt.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.7}
                  step={0.05}
                  value={wAtt}
                  onChange={(e) => setWAtt(Number(e.target.value))}
                  className="w-full accent-[#4D7C5F]"
                />
              </label>

              <label className="block">
                <div className="flex justify-between text-xs mb-1">
                  <span>Test Score Weight</span>
                  <span className="font-mono tabular-nums">{wTest.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.7}
                  step={0.05}
                  value={wTest}
                  onChange={(e) => setWTest(Number(e.target.value))}
                  className="w-full accent-[#4D7C5F]"
                />
              </label>

              <label className="block">
                <div className="flex justify-between text-xs mb-1">
                  <span>Assignment Completion Weight</span>
                  <span className="font-mono tabular-nums">{wAssign.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.7}
                  step={0.05}
                  value={wAssign}
                  onChange={(e) => setWAssign(Number(e.target.value))}
                  className="w-full accent-[#4D7C5F]"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="w-full py-2.5 rounded-lg text-xs font-medium bg-[#1F2421] text-white hover:bg-[#343B37] disabled:opacity-50 transition-colors"
          >
            {savingConfig ? 'Recalculating Cohort...' : 'Save Thresholds & Recalculate Cohort'}
          </button>
        </form>
      </div>

      {/* Row 2: Add Single Student + User Account Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Enroll New Student */}
        <form
          onSubmit={handleCreateStudent}
          className="lg:col-span-5 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold text-[#1F2421] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#C2593F]" />
            Enroll Student Profile
          </h2>

          {studentError && (
            <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F5C6C6] text-xs text-[#B91C1C]">
              {studentError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[#5C645E]">Student ID</span>
              <input
                type="text"
                value={newStuId}
                onChange={(e) => setNewStuId(e.target.value)}
                placeholder="STU-1201"
                className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[#5C645E]">Enrollment Status</span>
              <select
                value={newStuStatus}
                onChange={(e) => setNewStuStatus(e.target.value as EnrollmentStatus)}
                className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-2.5 py-1.5 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Probation">Probation</option>
                <option value="Dropped">Dropped</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-[#5C645E]">Full Name</span>
            <input
              type="text"
              value={newStuName}
              onChange={(e) => setNewStuName(e.target.value)}
              placeholder="e.g. Aiden Mercer"
              className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[#5C645E]">Academic Program</span>
            <input
              type="text"
              value={newStuProgram}
              onChange={(e) => setNewStuProgram(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm"
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-[#5C645E]">Attendance %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={newStuAtt}
                onChange={(e) => setNewStuAtt(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm font-mono tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[#5C645E]">Test Avg</span>
              <input
                type="number"
                min={0}
                max={100}
                value={newStuTest}
                onChange={(e) => setNewStuTest(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm font-mono tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[#5C645E]">Assignments %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={newStuAssign}
                onChange={(e) => setNewStuAssign(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-sm font-mono tabular-nums"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={addingStudent}
            className="w-full py-2 rounded-lg text-xs font-medium bg-[#4D7C5F] text-white hover:bg-[#3B624A] disabled:opacity-50 transition-colors"
          >
            {addingStudent ? 'Enrolling...' : 'Add Student & Assess Risk'}
          </button>
        </form>

        {/* RBAC User Account Management */}
        <section className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD5] rounded-lg p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1F2421] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4D7C5F]" />
              User Accounts & RBAC Directory
            </h2>
            <p className="text-xs text-[#5C645E] mt-0.5">
              Provision faculty, counselor, and student portal accounts and manage active access.
            </p>
          </div>

          <form
            onSubmit={handleCreateUser}
            className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1"
          >
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Full name"
              className="rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-xs"
            />
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="Email address"
              className="rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-3 py-1.5 text-xs"
            />
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as UserRole)}
              className="rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] px-2.5 py-1.5 text-xs"
            >
              <option value="counselor">Counselor</option>
              <option value="admin">Admin / Faculty</option>
              <option value="student">Student</option>
            </select>
            <button
              type="submit"
              disabled={creatingUser}
              className="rounded-lg bg-[#1F2421] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#343B37] disabled:opacity-50 transition-colors"
            >
              {creatingUser ? 'Adding...' : 'Create Account'}
            </button>
          </form>

          {userError && (
            <div className="p-2.5 rounded-lg bg-[#FDF2F2] border border-[#F5C6C6] text-xs text-[#B91C1C]">
              {userError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD5] text-[#5C645E]">
                  <th className="py-2 pr-3">Name & Email</th>
                  <th className="py-2 px-3">Role</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD5]">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-[#1F2421]">{u.name}</div>
                      <div className="text-[#5C645E] font-mono">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-3 capitalize text-[#1F2421]">
                      {u.role}
                      {u.linked_student_id ? ` · ${u.linked_student_id}` : ''}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          u.active
                            ? 'text-[#15803D] font-medium'
                            : 'text-[#5C645E]'
                        }
                      >
                        {u.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      {u.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleToggleUserActive(u)}
                          className="text-xs font-medium text-[#C2593F] hover:text-[#A64630]"
                        >
                          {u.active ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
