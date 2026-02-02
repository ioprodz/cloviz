import type { ServerWebSocket } from "bun";

const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>) {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>) {
  clients.delete(ws);
}

export function broadcast(event: string, data?: unknown) {
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const client of clients) {
    try {
      client.send(message);
    } catch {
      clients.delete(client);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
