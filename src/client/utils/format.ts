export function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`;
  if (Math.abs(n) >= 1000) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "$" + n.toFixed(2);
}

export function formatTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function formatDuration(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (ms < 0) return "-";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "< 1 min";
  const hrs = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hrs === 0) return `${min} min`;
  if (min === 0) return hrs === 1 ? "1 hr" : `${hrs} hrs`;
  return `${hrs === 1 ? "1 hr" : `${hrs} hrs`} ${min} min`;
}

export function formatTrend(
  current: number,
  previous: number
): { value: string; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { value: "0%", direction: "flat" };
    return { value: "+100%", direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { value: "0%", direction: "flat" };
  const sign = pct > 0 ? "+" : "";
  return {
    value: `${sign}${pct.toFixed(0)}%`,
    direction: pct > 0 ? "up" : "down",
  };
}
