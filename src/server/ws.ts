export interface WebSocketClient {
  send(data: string): void;
}

const clients = new Set<WebSocketClient>();

export function addClient(ws: WebSocketClient) {
  clients.add(ws);
}

export function removeClient(ws: WebSocketClient) {
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
