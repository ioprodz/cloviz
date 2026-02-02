import { useApi } from "../hooks/useApi";
import { TOOLTIP_STYLE } from "../utils/chart-theme";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TimelineBucket {
  index: number;
  read: number;
  write: number;
  bash: number;
  search: number;
  other: number;
}

interface TimelineResponse {
  buckets: TimelineBucket[];
  totals: { read: number; write: number; bash: number; search: number; other: number };
}

const CATEGORY_COLORS = {
  read: "#10b981",
  write: "#3b82f6",
  bash: "#ef4444",
  search: "#8b5cf6",
  other: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  read: "Read",
  write: "Write",
  bash: "Bash",
  search: "Search",
  other: "Other",
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const categories = ["read", "write", "bash", "search", "other"] as const;
  const hasValues = categories.some((c) => data[c] > 0);
  if (!hasValues) return null;

  return (
    <div
      style={TOOLTIP_STYLE}
      className="px-3 py-2 shadow-lg"
    >
      {categories.map((cat) =>
        data[cat] > 0 ? (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            <span className="text-gray-300">{CATEGORY_LABELS[cat]}</span>
            <span className="text-white font-medium ml-auto">{data[cat]}</span>
          </div>
        ) : null
      )}
    </div>
  );
}

export default function SessionTimeline({ sessionId }: { sessionId: string }) {
  const { data, loading } = useApi<TimelineResponse>(
    `/api/sessions/${sessionId}/tool-timeline`,
    [sessionId]
  );

  if (loading || !data) return null;

  const { buckets, totals } = data;
  const totalTools = Object.values(totals).reduce((a, b) => a + b, 0);
  if (totalTools === 0) return null;

  const categories = ["read", "write", "bash", "search", "other"] as const;
  const activeCategories = categories.filter((c) => totals[c] > 0);

  return (
    <div className="mt-3 -mx-1">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">
          Tool Activity
        </span>
        <div className="flex items-center gap-2.5">
          {activeCategories.map((cat) => (
            <div key={cat} className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              <span className="text-[10px] text-gray-500">
                {CATEGORY_LABELS[cat]}{" "}
                <span className="text-gray-600">{totals[cat]}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart
          data={buckets}
          margin={{ top: 2, right: 4, bottom: 0, left: 4 }}
        >
          <defs>
            {categories.map((cat) => (
              <linearGradient
                key={cat}
                id={`timeline-${cat}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={CATEGORY_COLORS[cat]}
                  stopOpacity={0.6}
                />
                <stop
                  offset="100%"
                  stopColor={CATEGORY_COLORS[cat]}
                  stopOpacity={0.05}
                />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="index" hide />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          {/* Render in reverse so "read" is on top visually */}
          {[...activeCategories].reverse().map((cat) => (
            <Area
              key={cat}
              type="monotone"
              dataKey={cat}
              stackId="1"
              stroke={CATEGORY_COLORS[cat]}
              strokeWidth={1.5}
              fill={`url(#timeline-${cat})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
