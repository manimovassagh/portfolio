import { useEffect, useRef, useState } from 'react';

const WS_RECONNECT_MS = 5_000;

// useLivePrices opens a WebSocket to /api/ws/prices and returns a map of
// ISIN → live price. Falls back gracefully if WebSocket is unavailable.
// The caller should pass exportName; changes to it trigger reconnection.
export function useLivePrices(exportName: string | null): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!exportName) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/api/ws/prices?export=${encodeURIComponent(exportName)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { type: string; data?: Record<string, number> };
          if (msg.type === 'prices' && msg.data) {
            setPrices((prev) => ({ ...prev, ...msg.data }));
          }
        } catch {
          // Ignore malformed frames.
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          retryRef.current = setTimeout(connect, WS_RECONNECT_MS);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [exportName]);

  return prices;
}
