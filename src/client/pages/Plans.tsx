import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi, apiFetch } from "../hooks/useApi";
import MarkdownView from "../components/MarkdownView";

interface Plan {
  id: number;
  filename: string;
  mtime: number;
}

interface PlanDetail {
  id: number;
  filename: string;
  content: string;
  mtime: number;
}

interface PlansResponse {
  plans: Plan[];
}

export default function Plans() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedName = searchParams.get("name");
  const [planContent, setPlanContent] = useState<PlanDetail | null>(null);
  const [filter, setFilter] = useState("");

  const { data, loading } = useApi<PlansResponse>("/api/plans");

  useEffect(() => {
    if (selectedName) {
      apiFetch<PlanDetail>(
        `/api/plans/${encodeURIComponent(selectedName)}`
      ).then(setPlanContent).catch(() => setPlanContent(null));
    } else {
      setPlanContent(null);
    }
  }, [selectedName]);

  const plans = (data?.plans ?? []).filter(
    (p) => !filter || p.filename.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Plan list */}
      <div className="w-72 flex-shrink-0 bg-surface-light rounded-xl border border-border overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border">
          <input
            type="text"
            placeholder="Filter plans..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-gray-300"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3"><div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-3 bg-surface-lighter rounded animate-pulse skeleton-shimmer" style={{width: `${60 + i * 10}%`}} />)}</div></div>
          ) : (
            plans.map((plan) => (
              <button
                key={plan.filename}
                onClick={() =>
                  setSearchParams({ name: plan.filename })
                }
                className={`w-full text-left px-3 py-2 text-sm border-b border-border/50 hover:bg-surface-lighter transition-colors ${
                  selectedName === plan.filename
                    ? "bg-surface-lighter text-primary"
                    : "text-gray-400"
                }`}
              >
                <div className="truncate">
                  {plan.filename.replace(".md", "")}
                </div>
                <div className="text-[10px] text-gray-600">
                  {new Date(plan.mtime).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-2 text-[10px] text-gray-600 border-t border-border">
          {plans.length} plans
        </div>
      </div>

      {/* Plan content */}
      <div className="flex-1 bg-surface-light rounded-xl border border-border overflow-y-auto p-6">
        {planContent ? (
          <MarkdownView content={planContent.content} />
        ) : (
          <div className="text-gray-500 text-sm text-center py-12">
            Select a plan to view its contents
          </div>
        )}
      </div>
    </div>
  );
}
