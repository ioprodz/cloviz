import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { format, differenceInHours, differenceInDays, startOfDay, startOfHour } from "date-fns";
import { useApi } from "../hooks/useApi";
import { formatCost, formatDuration } from "../utils/format";
import { classifySession, KANBAN_COLUMNS } from "../utils/session-classify";
import { TOOLTIP_STYLE } from "../utils/chart-theme";
import type { EnrichedSession } from "./SessionCard";

interface ProjectCommit {
  id: number;
  hash: string;
  short_hash: string;
  subject: string;
  timestamp: string;
  session_ids: string[];
  is_claude_authored: number;
}

interface CommitsResponse {
  commits: ProjectCommit[];
  total: number;
}

interface EnrichedSessionsResponse {
  sessions: EnrichedSession[];
  planSessionMap: Record<string, string[]>;
  total: number;
}

interface GanttChartProps {
  projectId: string;
}

const TIME_PRESETS = [
  { key: "1d", label: "1 day" },
  { key: "1w", label: "1 week" },
  { key: "1m", label: "1 month" },
  { key: "all", label: "All" },
] as const;
type TimePreset = (typeof TIME_PRESETS)[number]["key"];

const LEFT_MARGIN = 40;
const RIGHT_MARGIN = 20;
const ROW_HEIGHT = 32;
const BAR_HEIGHT = 20;
const TOP_MARGIN = 30;
const BOTTOM_MARGIN = 20;
const MIN_BAR_WIDTH = 4;
const LANE_GAP_MS = 5 * 60 * 1000; // 5 minute gap buffer between sessions in a lane

function computeTimeRange(preset: TimePreset): { since: string; until: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  const until = now.toISOString();
  let since: Date;
  switch (preset) {
    case "1d":
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "1w":
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1m":
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }
  return { since: since.toISOString(), until };
}

function assignLanes(sessions: EnrichedSession[]): Map<string, number> {
  const sorted = [...sessions]
    .filter((s) => s.created_at && s.modified_at)
    .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());

  const laneEnds: number[] = []; // end timestamp of last session in each lane
  const assignment = new Map<string, number>();

  for (const s of sorted) {
    const start = new Date(s.created_at!).getTime();
    const end = new Date(s.modified_at!).getTime();

    // Find first lane where the session fits (previous session ended before this one starts)
    let assigned = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] + LANE_GAP_MS <= start) {
        assigned = i;
        laneEnds[i] = end;
        break;
      }
    }

    if (assigned === -1) {
      // No existing lane fits — create a new one
      assigned = laneEnds.length;
      laneEnds.push(end);
    }

    assignment.set(s.id, assigned);
  }

  return assignment;
}

function generateTimeAxisTicks(
  minTs: number,
  maxTs: number
): { ts: number; label: string }[] {
  const rangeHours = differenceInHours(maxTs, minTs);
  const rangeDays = differenceInDays(maxTs, minTs);

  let interval: number;
  let formatter: (d: Date) => string;
  let start: Date;

  if (rangeHours <= 24) {
    interval = 3600000;
    formatter = (d) => format(d, "HH:mm");
    start = startOfHour(new Date(minTs));
  } else if (rangeDays <= 7) {
    interval = 6 * 3600000;
    formatter = (d) => format(d, "MMM d HH:mm");
    start = startOfHour(new Date(minTs));
  } else if (rangeDays <= 60) {
    interval = 86400000;
    formatter = (d) => format(d, "MMM d");
    start = startOfDay(new Date(minTs));
  } else {
    interval = 7 * 86400000;
    formatter = (d) => format(d, "MMM d");
    start = startOfDay(new Date(minTs));
  }

  const ticks: { ts: number; label: string }[] = [];
  let current = start.getTime();
  while (current <= maxTs + interval) {
    if (current >= minTs - interval) {
      ticks.push({ ts: current, label: formatter(new Date(current)) });
    }
    current += interval;
  }

  if (ticks.length > 15) {
    const step = Math.ceil(ticks.length / 12);
    return ticks.filter((_, i) => i % step === 0);
  }

  return ticks;
}

interface TooltipData {
  x: number;
  y: number;
  content: React.ReactNode;
}

function categoryColor(session: EnrichedSession): string {
  const cat = classifySession(session);
  return KANBAN_COLUMNS.find((c) => c.key === cat)?.color ?? "#6b7280";
}

export default function GanttChart({ projectId }: GanttChartProps) {
  const [timePreset, setTimePreset] = useState<TimePreset>("1w");

  const range = useMemo(() => computeTimeRange(timePreset), [timePreset]);
  const sessionsPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (range) {
      params.set("since", range.since);
      params.set("until", range.until);
    }
    return `/api/projects/${projectId}/sessions-enriched?${params}`;
  }, [projectId, range]);

  const commitsPath = `/api/commits/project/${projectId}?limit=200`;

  const { data: sessionsData, loading: sessionsLoading } = useApi<EnrichedSessionsResponse>(
    sessionsPath,
    [projectId, timePreset]
  );
  const { data: commitsData } = useApi<CommitsResponse>(
    commitsPath,
    [projectId]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setChartWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const sessions = sessionsData?.sessions ?? [];
  const sorted = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.created_at && s.modified_at)
        .sort(
          (a, b) =>
            new Date(a.created_at!).getTime() -
            new Date(b.created_at!).getTime()
        ),
    [sessions]
  );

  const commits = commitsData?.commits ?? [];

  const laneMap = useMemo(() => assignLanes(sorted), [sorted]);
  const laneCount = useMemo(() => {
    if (laneMap.size === 0) return 0;
    return Math.max(...laneMap.values()) + 1;
  }, [laneMap]);

  const timeRange = useMemo(() => {
    if (sorted.length === 0) return { min: Date.now() - 86400000, max: Date.now() };
    let min = Infinity;
    let max = -Infinity;
    for (const s of sorted) {
      const created = new Date(s.created_at!).getTime();
      const modified = new Date(s.modified_at!).getTime();
      if (created < min) min = created;
      if (modified > max) max = modified;
    }
    for (const c of commits) {
      const ts = new Date(c.timestamp).getTime();
      if (ts < min) min = ts;
      if (ts > max) max = ts;
    }
    const padding = (max - min) * 0.02 || 3600000;
    return { min: min - padding, max: max + padding };
  }, [sorted, commits]);

  const chartHeight = TOP_MARGIN + Math.max(laneCount, 1) * ROW_HEIGHT + BOTTOM_MARGIN;
  const drawWidth = chartWidth - LEFT_MARGIN - RIGHT_MARGIN;

  function timeToX(ts: number): number {
    const r = timeRange.max - timeRange.min;
    if (r === 0) return LEFT_MARGIN;
    return LEFT_MARGIN + ((ts - timeRange.min) / r) * drawWidth;
  }

  const ticks = useMemo(
    () => generateTimeAxisTicks(timeRange.min, timeRange.max),
    [timeRange]
  );

  function showTooltip(
    e: React.MouseEvent<SVGElement>,
    content: React.ReactNode
  ) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 10,
      content,
    });
  }

  return (
    <div ref={containerRef} className="relative overflow-x-auto p-4">
      {/* Time range preset buttons */}
      <div className="flex gap-1 mb-3 bg-surface rounded-lg p-0.5 border border-border w-fit">
        {TIME_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setTimePreset(p.key)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              timePreset === p.key
                ? "bg-primary/15 text-primary font-medium"
                : "text-gray-500 hover:text-gray-300 hover:bg-surface-lighter"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {sessionsLoading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading sessions…</div>
      ) : sorted.length === 0 ? (
        <div className="text-gray-500 text-sm py-4">
          No sessions in this time range
        </div>
      ) : (
        <>
          <svg
            width={chartWidth}
            height={chartHeight}
            className="select-none"
          >
            {/* Horizontal grid lines */}
            {Array.from({ length: laneCount }, (_, i) => (
              <line
                key={`grid-${i}`}
                x1={LEFT_MARGIN}
                x2={chartWidth - RIGHT_MARGIN}
                y1={TOP_MARGIN + (i + 1) * ROW_HEIGHT}
                y2={TOP_MARGIN + (i + 1) * ROW_HEIGHT}
                stroke="#374151"
                strokeDasharray="3 3"
              />
            ))}

            {/* Time axis ticks */}
            {ticks.map((tick, i) => {
              const x = timeToX(tick.ts);
              if (x < LEFT_MARGIN || x > chartWidth - RIGHT_MARGIN) return null;
              return (
                <g key={`tick-${i}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={TOP_MARGIN - 5}
                    y2={TOP_MARGIN}
                    stroke="#6b7280"
                  />
                  <line
                    x1={x}
                    x2={x}
                    y1={TOP_MARGIN}
                    y2={chartHeight - BOTTOM_MARGIN}
                    stroke="#374151"
                    strokeDasharray="2 4"
                    opacity={0.4}
                  />
                  <text
                    x={x}
                    y={TOP_MARGIN - 10}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize={10}
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Session bars */}
            {sorted.map((s) => {
              const lane = laneMap.get(s.id) ?? 0;
              const x1 = timeToX(new Date(s.created_at!).getTime());
              const x2 = timeToX(new Date(s.modified_at!).getTime());
              const barWidth = Math.max(x2 - x1, MIN_BAR_WIDTH);
              const y =
                TOP_MARGIN + lane * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
              const color = categoryColor(s);

              const label = s.summary || s.first_prompt || s.id.slice(0, 8);
              // Approximate how many characters fit inside the bar (≈7px per char at font-size 10)
              const maxChars = Math.floor(barWidth / 7);

              return (
                <Link key={`bar-${s.id}`} to={`/sessions/${s.id}`}>
                  <rect
                    x={x1}
                    y={y}
                    width={barWidth}
                    height={BAR_HEIGHT}
                    rx={4}
                    fill={color}
                    fillOpacity={0.7}
                    className="cursor-pointer transition-all hover:fill-opacity-100"
                    onMouseEnter={(e) =>
                      showTooltip(
                        e,
                        <div className="space-y-1">
                          <div className="font-medium text-gray-200">
                            {label}
                          </div>
                          {s.created_at && s.modified_at && (
                            <div className="text-gray-400">
                              Duration: {formatDuration(s.created_at, s.modified_at)}
                            </div>
                          )}
                          <div className="text-gray-400">
                            {s.files_read_count} read &middot;{" "}
                            {s.files_written_count} written
                          </div>
                          {s.total_cost > 0 && (
                            <div className="text-primary">
                              {formatCost(s.total_cost)}
                            </div>
                          )}
                        </div>
                      )
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                  {maxChars >= 3 && (
                    <text
                      x={x1 + 4}
                      y={y + BAR_HEIGHT / 2 + 3.5}
                      fill="#fff"
                      fontSize={10}
                      pointerEvents="none"
                      clipPath={`inset(0 0 0 0 round 4px)`}
                    >
                      {label.length > maxChars ? label.slice(0, maxChars - 1) + "\u2026" : label}
                    </text>
                  )}
                </Link>
              );
            })}

            {/* Commit vertical lines */}
            {commits.map((commit) => {
              const x = timeToX(new Date(commit.timestamp).getTime());
              if (x < LEFT_MARGIN || x > chartWidth - RIGHT_MARGIN) return null;
              return (
                <line
                  key={`commit-${commit.id}`}
                  x1={x}
                  x2={x}
                  y1={TOP_MARGIN}
                  y2={chartHeight - BOTTOM_MARGIN}
                  stroke={commit.is_claude_authored ? "#a855f7" : "#6b7280"}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  className="cursor-pointer"
                  onMouseEnter={(e) =>
                    showTooltip(
                      e,
                      <div className="space-y-1">
                        <div className="font-mono text-gray-300">
                          {commit.short_hash}
                        </div>
                        <div className="text-gray-200">{commit.subject}</div>
                        <div className="text-gray-400 text-[10px]">
                          {format(new Date(commit.timestamp), "MMM d, yyyy HH:mm")}
                        </div>
                        {commit.is_claude_authored ? (
                          <span className="text-violet-400 text-[10px]">
                            Claude-authored
                          </span>
                        ) : null}
                      </div>
                    )
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </svg>

          {/* Tooltip overlay */}
          {tooltip && (
            <div
              style={{
                ...(TOOLTIP_STYLE as React.CSSProperties),
                position: "absolute",
                left: tooltip.x,
                top: tooltip.y,
                pointerEvents: "none",
                zIndex: 50,
                padding: "8px 12px",
                maxWidth: 300,
              }}
            >
              {tooltip.content}
            </div>
          )}
        </>
      )}
    </div>
  );
}
