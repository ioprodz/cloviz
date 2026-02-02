import { useApi } from "../hooks/useApi";

interface HourlyData {
  hourCounts: Record<string, number>;
  dayOfWeek: { dow: number; count: number }[];
  heatmap: { dow: number; hour: number; count: number }[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function HourlyPatterns() {
  const { data, loading } = useApi<HourlyData>("/api/analytics/hourly");

  if (loading) {
    return <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-surface-lighter rounded animate-pulse skeleton-shimmer" style={{width: `${50 + i * 8}%`}} />)}</div>;
  }

  if (!data) return null;

  const { hourCounts, heatmap } = data;

  // Build heatmap grid
  const heatmapGrid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );
  let maxHeat = 1;
  for (const entry of heatmap) {
    heatmapGrid[entry.dow][entry.hour] = entry.count;
    if (entry.count > maxHeat) maxHeat = entry.count;
  }

  function getHeatColor(count: number): string {
    if (count === 0) return "rgb(17 24 39)";
    const intensity = count / maxHeat;
    if (intensity < 0.2) return "rgb(120 53 15 / 0.4)";
    if (intensity < 0.4) return "rgb(120 53 15)";
    if (intensity < 0.6) return "rgb(146 64 14)";
    if (intensity < 0.8) return "rgb(217 119 6)";
    return "rgb(245 158 11)";
  }

  // Hour distribution bar chart
  const hourValues = HOURS.map((h) => ({
    hour: h,
    count: parseInt(hourCounts[String(h)] ?? "0"),
  }));
  const maxHourCount = Math.max(...hourValues.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Productivity Patterns</h2>

      {/* Punchcard heatmap */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Hour x Day Heatmap
        </h3>
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-10"></th>
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className="text-[10px] text-gray-600 font-normal px-0.5 w-6 text-center"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dow) => (
                <tr key={dow}>
                  <td className="text-[10px] text-gray-500 pr-2 text-right">
                    {day}
                  </td>
                  {HOURS.map((h) => (
                    <td key={h} className="p-0.5">
                      <div
                        className="w-5 h-5 rounded-sm"
                        style={{
                          backgroundColor: getHeatColor(
                            heatmapGrid[dow][h]
                          ),
                        }}
                        title={`${day} ${h}:00 — ${heatmapGrid[dow][h]} activities`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hourly distribution */}
      <div className="bg-surface-light rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Hourly Distribution (Sessions Started)
        </h3>
        <div className="flex items-end gap-1 h-32">
          {hourValues.map((h) => (
            <div
              key={h.hour}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-primary/70 rounded-t transition-all"
                style={{
                  height: `${(h.count / maxHourCount) * 100}%`,
                  minHeight: h.count > 0 ? "2px" : "0",
                }}
              />
              <span className="text-[9px] text-gray-600">{h.hour}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(() => {
          const peakHour = hourValues.reduce((a, b) =>
            a.count > b.count ? a : b
          );
          const totalFromHours = hourValues.reduce(
            (acc, h) => acc + h.count,
            0
          );
          const morningCount = hourValues
            .filter((h) => h.hour >= 6 && h.hour < 12)
            .reduce((a, h) => a + h.count, 0);
          const eveningCount = hourValues
            .filter((h) => h.hour >= 18 && h.hour < 24)
            .reduce((a, h) => a + h.count, 0);

          return (
            <>
              <div className="bg-surface-light rounded-xl p-4 border border-border">
                <div className="text-xs text-gray-500">Peak Hour</div>
                <div className="text-xl font-bold">
                  {peakHour.hour}:00
                </div>
                <div className="text-xs text-gray-600">
                  {peakHour.count} sessions
                </div>
              </div>
              <div className="bg-surface-light rounded-xl p-4 border border-border">
                <div className="text-xs text-gray-500">Total Tracked</div>
                <div className="text-xl font-bold">{totalFromHours}</div>
              </div>
              <div className="bg-surface-light rounded-xl p-4 border border-border">
                <div className="text-xs text-gray-500">Morning (6-12)</div>
                <div className="text-xl font-bold">{morningCount}</div>
              </div>
              <div className="bg-surface-light rounded-xl p-4 border border-border">
                <div className="text-xs text-gray-500">Evening (18-24)</div>
                <div className="text-xl font-bold">{eveningCount}</div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
