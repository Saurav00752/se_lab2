import { useState } from 'react';
import type { CohortAnalytics, MetricPoint, RiskLevel } from '../types';

export function CohortTrendChart({
  series,
}: {
  series: CohortAnalytics['trend_series'];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!series || series.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-[#5C645E]">
        No historical cohort metrics recorded yet.
      </div>
    );
  }

  const width = 560;
  const height = 210;
  const pad = { top: 18, right: 18, bottom: 30, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const getX = (i: number) =>
    series.length === 1
      ? pad.left + plotW / 2
      : pad.left + (i / (series.length - 1)) * plotW;

  const getY = (val: number) => pad.top + ((100 - val) / 100) * plotH;

  const buildPath = (extractor: (p: CohortAnalytics['trend_series'][number]) => number) =>
    series
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(extractor(pt)).toFixed(1)}`)
      .join(' ');

  const activePt = hoveredIdx !== null ? series[hoveredIdx] : series[series.length - 1];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-4 text-xs text-[#5C645E]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#C2593F] inline-block" />
            Attendance
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#4D7C5F] inline-block" />
            Test Scores
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#1F2421] inline-block" />
            Assignments
          </span>
        </div>
        {activePt && (
          <div className="text-xs font-mono tabular-nums text-[#5C645E]">
            {activePt.date} · Att {activePt.avg_attendance}% · Test {activePt.avg_test_score} · Assign {activePt.avg_assignment}%
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Cohort attendance, test score, and assignment completion trend chart"
      >
        {[20, 40, 60, 80, 100].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="#E5DFD5"
                strokeDasharray={tick === 80 ? '4 3' : undefined}
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-[#5C645E] text-[10px] font-mono"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <path
          d={buildPath((p) => p.avg_attendance)}
          fill="none"
          stroke="#C2593F"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={buildPath((p) => p.avg_test_score)}
          fill="none"
          stroke="#4D7C5F"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={buildPath((p) => p.avg_assignment)}
          fill="none"
          stroke="#1F2421"
          strokeWidth={1.8}
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {series.map((pt, i) => {
          const x = getX(i);
          const isHovered = hoveredIdx === i;
          return (
            <g
              key={pt.date}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {isHovered && (
                <line
                  x1={x}
                  x2={x}
                  y1={pad.top}
                  y2={height - pad.bottom}
                  stroke="#D6CEC2"
                  strokeWidth={1}
                />
              )}
              <circle
                cx={x}
                cy={getY(pt.avg_attendance)}
                r={isHovered ? 4.5 : 3}
                fill="#C2593F"
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <circle
                cx={x}
                cy={getY(pt.avg_test_score)}
                r={isHovered ? 4.5 : 3}
                fill="#4D7C5F"
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <circle
                cx={x}
                cy={getY(pt.avg_assignment)}
                r={isHovered ? 4 : 2.5}
                fill="#1F2421"
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="fill-[#5C645E] text-[10px] font-mono"
              >
                {pt.date.slice(5)}
              </text>
              <rect
                x={x - 22}
                y={pad.top}
                width={44}
                height={plotH}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function RiskDistributionChart({
  distribution,
  threshold,
}: {
  distribution: CohortAnalytics['risk_distribution'];
  threshold: number;
}) {
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));
  const barColor: Record<RiskLevel, string> = {
    LOW: '#4D7C5F',
    MEDIUM: '#D97706',
    HIGH: '#B91C1C',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[#5C645E]">
        <span>Cohort probability score buckets</span>
        <span className="font-mono tabular-nums text-[#B91C1C] font-medium">
          High-Risk Threshold: {threshold.toFixed(2)}
        </span>
      </div>

      <div className="space-y-2.5 pt-1">
        {distribution.map((bucket) => {
          const pct = Math.round((bucket.count / maxCount) * 100);
          return (
            <div key={bucket.bucket} className="grid grid-cols-[78px_1fr_32px] items-center gap-3">
              <span className="text-xs font-mono tabular-nums text-[#5C645E]">
                {bucket.bucket}
              </span>
              <div className="h-5 bg-[#F3EFEA] rounded overflow-hidden flex items-center">
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{
                    width: `${bucket.count > 0 ? Math.max(6, pct) : 0}%`,
                    backgroundColor: barColor[bucket.level],
                  }}
                />
              </div>
              <span className="text-xs font-mono tabular-nums text-right font-medium text-[#1F2421]">
                {bucket.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StudentTrajectoryChart({ history }: { history: MetricPoint[] }) {
  if (!history || history.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-[#5C645E]">
        No metric snapshots available.
      </div>
    );
  }

  const width = 480;
  const height = 165;
  const pad = { top: 14, right: 14, bottom: 26, left: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const getX = (i: number) =>
    history.length === 1
      ? pad.left + plotW / 2
      : pad.left + (i / (history.length - 1)) * plotW;
  const getY = (v: number) => pad.top + ((100 - v) / 100) * plotH;

  const pathFor = (fn: (m: MetricPoint) => number) =>
    history
      .map((m, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(fn(m)).toFixed(1)}`)
      .join(' ');

  return (
    <div>
      <div className="flex items-center gap-4 text-[11px] text-[#5C645E] mb-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-[#C2593F] inline-block" />
          Attendance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-[#4D7C5F] inline-block" />
          Tests
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-[#1F2421] inline-block" />
          Assignments
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {[25, 50, 75, 100].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="#E5DFD5"
                strokeWidth={1}
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#5C645E] text-[9px] font-mono"
              >
                {tick}
              </text>
            </g>
          );
        })}
        <path
          d={pathFor((m) => m.attendance_pct)}
          fill="none"
          stroke="#C2593F"
          strokeWidth={2}
        />
        <path
          d={pathFor((m) => m.test_score)}
          fill="none"
          stroke="#4D7C5F"
          strokeWidth={2}
        />
        <path
          d={pathFor((m) => m.assignment_pct)}
          fill="none"
          stroke="#1F2421"
          strokeWidth={1.6}
          strokeDasharray="3 3"
        />
        {history.map((m, i) => (
          <g key={m.id}>
            <circle cx={getX(i)} cy={getY(m.attendance_pct)} r={2.8} fill="#C2593F" />
            <circle cx={getX(i)} cy={getY(m.test_score)} r={2.8} fill="#4D7C5F" />
            <circle cx={getX(i)} cy={getY(m.assignment_pct)} r={2.4} fill="#1F2421" />
            <text
              x={getX(i)}
              y={height - 6}
              textAnchor="middle"
              className="fill-[#5C645E] text-[9px] font-mono"
            >
              {m.recorded_date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
