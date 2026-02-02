import Sparkline from "./Sparkline";

interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  sparkData?: number[];
  accent?: string;
}

export default function StatsCard({
  label,
  value,
  sub,
  trend,
  sparkData,
  accent,
}: StatsCardProps) {
  return (
    <div className="bg-surface-light rounded-xl p-5 border border-border relative overflow-hidden">
      {sparkData && sparkData.length >= 2 && (
        <div className="absolute bottom-0 right-0 opacity-40">
          <Sparkline
            data={sparkData}
            width={100}
            height={40}
            color={accent || "#d97706"}
          />
        </div>
      )}
      <div className="relative">
        <div className="text-sm text-gray-400 mb-1">{label}</div>
        <div className="flex items-baseline gap-2">
          <div
            className="text-2xl font-bold text-gray-100"
            style={accent ? { color: accent } : undefined}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.direction === "up"
                  ? "text-red-400"
                  : trend.direction === "down"
                    ? "text-green-400"
                    : "text-gray-500"
              }`}
            >
              {trend.direction === "up" && "\u2191"}
              {trend.direction === "down" && "\u2193"}
              {trend.value}
            </span>
          )}
        </div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}
