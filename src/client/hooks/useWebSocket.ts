import { useEffect, useRef, useCallback, useState } from "react";

type EventHandler = (data: unknown) => void;

interface WSMessage {
  event: string;
  data: unknown;
  timestamp: number;
}

const WS_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:3456/ws`
    : "ws://localhost:3456/ws";

const listeners = new Map<string, Set<EventHandler>>();
let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (globalWs?.readyState === WebSocket.OPEN) return;

  try {
    globalWs = new WebSocket(WS_URL);

    globalWs.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data);
        const handlers = listeners.get(msg.event);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg.data);
          }
        }
        // Also fire a wildcard for any listeners
        const wildcard = listeners.get("*");
        if (wildcard) {
          for (const handler of wildcard) {
            handler(msg);
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    globalWs.onclose = () => {
      reconnectTimer = setTimeout(connect, 3000);
    };

    globalWs.onerror = () => {
      globalWs?.close();
    };
  } catch {
    reconnectTimer = setTimeout(connect, 3000);
  }
}

export function useWebSocket(event: string, handler: EventHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    connect();

    const wrapped: EventHandler = (data) => handlerRef.current(data);

    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(wrapped);

    return () => {
      listeners.get(event)?.delete(wrapped);
    };
  }, [event]);
}

export function useWebSocketStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    connect();

    const check = setInterval(() => {
      setConnected(globalWs?.readyState === WebSocket.OPEN);
    }, 1000);

    return () => clearInterval(check);
  }, []);

  return connected;
}
