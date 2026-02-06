import { useCallback, useEffect, useRef, useState } from "react";

import type { ProjectEvent } from "../api";

/**
 * SSE hook with reconnect-safe cursor recovery.
 * Tracks `lastSeq` via ref so reconnections resume from the most recent seq
 * instead of replaying from zero.
 */
export function useProjectEvents(projectId: string) {
  const [connected, setConnected] = useState(false);
  const [lastSeq, setLastSeq] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<ProjectEvent[]>([]);

  /** Mutable ref keeps the latest seq for reconnect URL construction */
  const lastSeqRef = useRef(0);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSeq = useCallback((seq: number) => {
    setLastSeq((prev) => {
      const next = Math.max(prev, seq);
      lastSeqRef.current = next;
      return next;
    });
  }, []);

  const connectSSE = useCallback(() => {
    if (!projectId) return;

    // Reconnect uses the latest seq we've seen
    const qs = new URLSearchParams({ since: String(lastSeqRef.current) });
    const source = new EventSource(`/api/projects/${projectId}/events/stream?${qs.toString()}`);
    sourceRef.current = source;

    source.addEventListener("ready", () => {
      setConnected(true);
      setError(null);
    });

    source.addEventListener("event", (msg) => {
      try {
        const parsed = JSON.parse((msg as MessageEvent).data) as ProjectEvent;
        updateSeq(parsed.seq);
        setRecentEvents((prev) => [...prev.slice(-99), parsed]);
      } catch (err: any) {
        setError(err?.message ?? String(err));
      }
    });

    source.addEventListener("heartbeat", (msg) => {
      try {
        const payload = JSON.parse((msg as MessageEvent).data) as { lastSeq?: number };
        if (typeof payload.lastSeq === "number") updateSeq(payload.lastSeq);
      } catch {
        // ignore malformed heartbeat
      }
    });

    source.onerror = () => {
      setConnected(false);
      setError("event_stream_disconnected");
      // Close the broken source and schedule reconnect with backoff
      source.close();
      sourceRef.current = null;
      reconnectTimerRef.current = setTimeout(() => {
        connectSSE();
      }, 2000);
    };
  }, [projectId, updateSeq]);

  useEffect(() => {
    // Reset seq on project change
    lastSeqRef.current = 0;
    setLastSeq(0);
    setRecentEvents([]);
    connectSSE();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      setConnected(false);
    };
  }, [projectId, connectSSE]);

  return { connected, lastSeq, error, recentEvents };
}

