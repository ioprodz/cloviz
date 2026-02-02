// Client-side pricing mirror for per-message cost display
interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const PRICING: Record<string, ModelPricing> = {
  "opus-4-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "sonnet-4-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  "haiku-3-5": { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 },
};

function matchModel(model: string): ModelPricing {
  const normalized = model
    .toLowerCase()
    .replace("claude-", "")
    .replace(/-\d{8}$/, "");

  for (const [key, pricing] of Object.entries(PRICING)) {
    if (normalized.includes(key)) return pricing;
  }
  return PRICING["sonnet-4"];
}

export function calculateMessageCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): number {
  const pricing = matchModel(model);
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheCreationTokens / 1_000_000) * pricing.cacheWrite +
    (cacheReadTokens / 1_000_000) * pricing.cacheRead
  );
}
