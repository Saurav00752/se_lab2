import { useState } from 'react';
import { AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import type { EnrollmentStatus, RiskLevel } from '../types';

export function RiskIndicator({
  level,
  score,
  compact = false,
}: {
  level: RiskLevel;
  score?: number;
  compact?: boolean;
}) {
  const styles: Record<
    RiskLevel,
    { bg: string; text: string; border: string; label: string; Icon: typeof AlertTriangle }
  > = {
    HIGH: {
      bg: 'bg-[#FDF2F2]',
      text: 'text-[#B91C1C]',
      border: 'border-[#F5C6C6]',
      label: 'High Risk',
      Icon: AlertTriangle,
    },
    MEDIUM: {
      bg: 'bg-[#FEF9EC]',
      text: 'text-[#B45309]',
      border: 'border-[#F3DFB1]',
      label: 'Medium Risk',
      Icon: TrendingDown,
    },
    LOW: {
      bg: 'bg-[#F1F7F3]',
      text: 'text-[#15803D]',
      border: 'border-[#C7E0CF]',
      label: 'Low Risk',
      Icon: CheckCircle2,
    },
  };

  const cfg = styles[level];
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
      {score !== undefined && !compact && (
        <span className="font-mono tabular-nums opacity-85">
          {score.toFixed(2)}
        </span>
      )}
    </span>
  );
}

export function EnrollmentStatusLabel({ status }: { status: EnrollmentStatus }) {
  const colorMap: Record<EnrollmentStatus, string> = {
    Active: 'text-[#15803D]',
    Probation: 'text-[#B45309]',
    Dropped: 'text-[#B91C1C]',
  };
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${colorMap[status]}`}>
      {status}
    </span>
  );
}

export function PersonaAvatar({
  src,
  name,
  size = 'md',
}: {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(' ')
    .filter((p) => p.length > 0 && !p.endsWith('.'))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const sizeClass =
    size === 'sm'
      ? 'w-7 h-7 text-[11px]'
      : size === 'lg'
        ? 'w-12 h-12 text-sm'
        : 'w-9 h-9 text-xs';

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} rounded-lg bg-[#F3EFEA] border border-[#E5DFD5] text-[#1F2421] font-semibold flex items-center justify-center shrink-0 select-none`}
        aria-label={name}
      >
        {initials || 'U'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-lg object-cover border border-[#E5DFD5] shrink-0`}
    />
  );
}
