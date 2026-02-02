interface LoadingSkeletonProps {
  variant?: "card" | "chart" | "table" | "text";
  count?: number;
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-surface-lighter rounded animate-pulse skeleton-shimmer ${className}`}
    />
  );
}

function CardSkeleton() {
  return (
    <div className="bg-surface-light rounded-xl p-5 border border-border">
      <SkeletonBar className="h-3 w-20 mb-3" />
      <SkeletonBar className="h-7 w-28 mb-2" />
      <SkeletonBar className="h-2.5 w-16" />
    </div>
  );
}

function ChartSkeleton() {
  const heights = [40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 68];
  return (
    <div className="bg-surface-light rounded-xl p-5 border border-border">
      <SkeletonBar className="h-3 w-32 mb-4" />
      <div className="flex items-end gap-1 h-48">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse skeleton-shimmer bg-surface-lighter rounded"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface-light rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <SkeletonBar className="h-3 w-28" />
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-4">
            <SkeletonBar className="h-3 w-24" />
            <div className="h-3 flex-1 bg-surface-lighter rounded animate-pulse skeleton-shimmer" />
            <SkeletonBar className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TextSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ["90%", "75%", "85%", "60%", "80%"];
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-surface-lighter rounded animate-pulse skeleton-shimmer"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

export default function LoadingSkeleton({
  variant = "card",
  count = 1,
}: LoadingSkeletonProps) {
  if (variant === "card") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (variant === "chart") return <ChartSkeleton />;
  if (variant === "table") return <TableSkeleton rows={count} />;
  return <TextSkeleton lines={count} />;
}
