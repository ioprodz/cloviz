// Pricing per million tokens
export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
}

export interface CostWithSavings extends CostBreakdown {
  costWithoutCache: number;
  cacheSavings: number;
}

// Pricing per million tokens
const PRICING: Record<string, ModelPricing> = {
  "opus-4-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "sonnet-4-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  "haiku-3-5": { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 },
};

// Fuzzy match model name to pricing key
function matchModel(model: string): ModelPricing {
  const normalized = model
    .toLowerCase()
    .replace("claude-", "")
    .replace(/-\d{8}$/, "");

  for (const [key, pricing] of Object.entries(PRICING)) {
    if (normalized.includes(key)) return pricing;
  }

  // Fallback to sonnet-4 pricing
  return PRICING["sonnet-4"];
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): CostWithSavings {
  const pricing = matchModel(model);

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (cacheCreationTokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cacheRead;
  const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

  // What it would cost without caching (cache reads would be full-price input)
  const costWithoutCache =
    inputCost +
    outputCost +
    (cacheCreationTokens / 1_000_000) * pricing.input +
    (cacheReadTokens / 1_000_000) * pricing.input;

  const cacheSavings = costWithoutCache - totalCost;

  return {
    inputCost,
    outputCost,
    cacheWriteCost,
    cacheReadCost,
    totalCost,
    costWithoutCache,
    cacheSavings,
  };
}

export function aggregateCosts(costs: CostWithSavings[]): CostWithSavings {
  const result: CostWithSavings = {
    inputCost: 0,
    outputCost: 0,
    cacheWriteCost: 0,
    cacheReadCost: 0,
    totalCost: 0,
    costWithoutCache: 0,
    cacheSavings: 0,
  };

  for (const c of costs) {
    result.inputCost += c.inputCost;
    result.outputCost += c.outputCost;
    result.cacheWriteCost += c.cacheWriteCost;
    result.cacheReadCost += c.cacheReadCost;
    result.totalCost += c.totalCost;
    result.costWithoutCache += c.costWithoutCache;
    result.cacheSavings += c.cacheSavings;
  }

  return result;
}
