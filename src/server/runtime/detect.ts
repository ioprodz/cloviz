export const IS_BUN = typeof globalThis.Bun !== "undefined";
export const RUNTIME: "bun" | "node" = IS_BUN ? "bun" : "node";
