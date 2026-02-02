interface DailyActivity {
  date: string;
  message_count: number;
  session_count: number;
  tool_call_count: number;
}

interface ActivityHeatmapProps {
  data: DailyActivity[];
}

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-sm">No activity data</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.message_count), 1);

  // Build a map for quick lookup
  const activityMap = new Map<string, DailyActivity>();
  for (const d of data) {
    activityMap.set(d.date, d);
  }

  // Generate last 365 days
  const days: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const activity = activityMap.get(dateStr);
    days.push({
      date: dateStr,
      count: activity?.message_count ?? 0,
    });
  }

  // Group by weeks
  const weeks: { date: string; count: number }[][] = [];
  let currentWeek: { date: string; count: number }[] = [];

  // Pad the first week
  const firstDow = new Date(days[0].date).getDay();
  for (let i = 0; i < firstDow; i++) {
    currentWeek.push({ date: "", count: -1 });
  }

  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  function getColor(count: number): string {
    if (count < 0) return "transparent";
    if (count === 0) return "rgb(17 24 39)";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return "rgb(120 53 15)";
    if (intensity < 0.5) return "rgb(146 64 14)";
    if (intensity < 0.75) return "rgb(217 119 6)";
    return "rgb(245 158 11)";
  }

  const monthLabels: { label: string; col: number }[] = [];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w].find((d) => d.date);
    if (firstDay?.date) {
      const month = new Date(firstDay.date).getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: months[month], col: w });
        lastMonth = month;
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5 mb-1 ml-7">
        {monthLabels.map((m, i) => (
          <div
            key={i}
            className="text-[10px] text-gray-500 absolute"
            style={{ left: `${m.col * 13 + 28}px` }}
          >
            {m.label}
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-5 relative">
        <div className="flex flex-col gap-[2px] text-[10px] text-gray-500 mr-1 pt-0">
          {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
            <div key={i} className="h-[11px] leading-[11px]">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {week.map((day, di) => (
              <div
                key={di}
                className="w-[11px] h-[11px] rounded-sm"
                style={{ backgroundColor: getColor(day.count) }}
                title={
                  day.date
                    ? `${day.date}: ${day.count} messages`
                    : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
