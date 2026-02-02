import { Hono } from "hono";
import { getDb } from "../db";
import { calculateCost, aggregateCosts, type CostWithSavings } from "../pricing";

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();
  const projectId = c.req.query("project_id");

  const projectJoin = projectId ? "JOIN sessions s ON m.session_id = s.id" : "";
  const projectWhere = projectId ? "AND s.project_id = ?" : "";
  const projectParams = projectId ? [projectId] : [];

  // Per-model totals from messages table
  const modelRows = db
    .prepare(
      `SELECT m.model,
              SUM(m.input_tokens) as input_tokens,
              SUM(m.output_tokens) as output_tokens,
              SUM(m.cache_creation_tokens) as cache_creation_tokens,
              SUM(m.cache_read_tokens) as cache_read_tokens
       FROM messages m
       ${projectJoin}
       WHERE m.model IS NOT NULL AND m.model != ''
       ${projectWhere}
       GROUP BY m.model`
    )
    .all(...projectParams) as {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  const perModelCosts: Record<string, CostWithSavings & { model: string }> = {};
  const allCosts: CostWithSavings[] = [];

  for (const row of modelRows) {
    const cost = calculateCost(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_tokens ?? 0,
      row.cache_read_tokens ?? 0
    );
    perModelCosts[row.model] = { ...cost, model: row.model };
    allCosts.push(cost);
  }

  const totals = aggregateCosts(allCosts);

  // Daily costs from messages grouped by date + model
  const dailyRows = db
    .prepare(
      `SELECT DATE(m.timestamp) as date, m.model,
              SUM(m.input_tokens) as input_tokens,
              SUM(m.output_tokens) as output_tokens,
              SUM(m.cache_creation_tokens) as cache_creation_tokens,
              SUM(m.cache_read_tokens) as cache_read_tokens
       FROM messages m
       ${projectJoin}
       WHERE m.timestamp IS NOT NULL AND m.model IS NOT NULL AND m.model != ''
       ${projectWhere}
       GROUP BY date, m.model
       ORDER BY date`
    )
    .all(...projectParams) as {
    date: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }[];

  // Aggregate daily costs by date
  const dailyMap = new Map<
    string,
    {
      date: string;
      inputCost: number;
      outputCost: number;
      cacheWriteCost: number;
      cacheReadCost: number;
      totalCost: number;
      cacheSavings: number;
    }
  >();

  for (const row of dailyRows) {
    const cost = calculateCost(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cache_creation_tokens ?? 0,
      row.cache_read_tokens ?? 0
    );
    const existing = dailyMap.get(row.date);
    if (existing) {
      existing.inputCost += cost.inputCost;
      existing.outputCost += cost.outputCost;
      existing.cacheWriteCost += cost.cacheWriteCost;
      existing.cacheReadCost += cost.cacheReadCost;
      existing.totalCost += cost.totalCost;
      existing.cacheSavings += cost.cacheSavings;
    } else {
      dailyMap.set(row.date, {
        date: row.date,
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        cacheWriteCost: cost.cacheWriteCost,
        cacheReadCost: cost.cacheReadCost,
        totalCost: cost.totalCost,
        cacheSavings: cost.cacheSavings,
      });
    }
  }

  const dailyCosts = [...dailyMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Compute rates
  const now = new Date();
  const day7 = new Date(now);
  day7.setDate(day7.getDate() - 7);
  const day30 = new Date(now);
  day30.setDate(day30.getDate() - 30);

  const day7Str = day7.toISOString().slice(0, 10);
  const day30Str = day30.toISOString().slice(0, 10);

  let cost7d = 0;
  let cost30d = 0;
  for (const d of dailyCosts) {
    if (d.date >= day7Str) cost7d += d.totalCost;
    if (d.date >= day30Str) cost30d += d.totalCost;
  }

  const rates = {
    perDay7: cost7d / 7,
    perWeek7: cost7d,
    perDay30: cost30d / 30,
    perWeek30: (cost30d / 30) * 7,
  };

  return c.json({
    totals,
    perModelCosts,
    dailyCosts,
    rates,
  });
});

export default app;
