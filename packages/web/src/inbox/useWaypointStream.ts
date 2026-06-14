import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { WsServerFrameSchema, type InboxItem } from "@waypoint/shared";
import { applyFrame, initialInboxState, rankInbox } from "./reducer.js";
import { fetchInbox } from "../api/client.js";

export type StreamStatus = "connecting" | "open" | "reconnecting" | "error";

// The slice of WebSocket this hook drives. Injectable so tests pass a deterministic fake;
// the default is the browser WebSocket. (The delta-folding logic is wire-free in the
// reducer; this seam only carries connect/resume/reconnect plumbing.)
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface WaypointStreamOptions {
  baseUrl?: string; // REST origin, default same-origin
  wsUrl?: string; // WS endpoint, default derived from window.location
  socketFactory?: (url: string) => SocketLike;
  reconnectDelayMs?: number;
}

export interface WaypointStream {
  status: StreamStatus;
  items: InboxItem[];
  seq: number;
  reconnect: () => void;
}

function defaultWsUrl(projectId: string): string {
  const { protocol, host } = window.location;
  const scheme = protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${host}/v1/projects/${encodeURIComponent(projectId)}/stream`;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Subscribes to the live inbox: a REST snapshot for a deterministic first paint, then the
// WebSocket stream for live deltas, with resume-since-seq across reconnects and a resync
// fallback when the client's seq predates the server's retained history. Whichever of REST
// or WS lands first, the reducer's seq-guard reconciles them.
export function useWaypointStream(
  projectId: string,
  options: WaypointStreamOptions = {},
): WaypointStream {
  const { baseUrl = "", reconnectDelayMs = 1000 } = options;
  const wsUrl = options.wsUrl ?? defaultWsUrl(projectId);

  const [state, dispatch] = useReducer(applyFrame, initialInboxState);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  // Latest applied seq, read inside socket callbacks to build the resume frame.
  const seqRef = useRef(state.seq);
  seqRef.current = state.seq;

  // Factory in a ref so a changing identity (tests) doesn't re-run the connect effect.
  const factoryRef = useRef(options.socketFactory);
  factoryRef.current = options.socketFactory;

  const socketRef = useRef<SocketLike | null>(null);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const make =
      factoryRef.current ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
    const socket = make(wsUrl);
    socketRef.current = socket;
    setStatus((current) => (current === "open" ? current : "connecting"));

    socket.onopen = () => {
      setStatus("open");
      const lastSeq = seqRef.current < 0 ? null : seqRef.current;
      socket.send(JSON.stringify({ type: "resume", projectId, lastSeq }));
    };
    socket.onmessage = (event) => {
      const parsed = WsServerFrameSchema.safeParse(safeJson(String(event.data)));
      if (!parsed.success) return;
      dispatch(parsed.data);
      // A resync clears local state; reconnect for a fresh snapshot from null.
      if (parsed.data.type === "resync") socket.close();
    };
    socket.onclose = () => {
      socketRef.current = null;
      if (stoppedRef.current) return;
      setStatus("reconnecting");
      timerRef.current = setTimeout(connect, reconnectDelayMs);
    };
    socket.onerror = () => setStatus("error");
  }, [wsUrl, projectId, reconnectDelayMs]);

  const reconnect = useCallback(() => {
    socketRef.current?.close();
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    let active = true;
    // First paint via REST, racing the WS connect below.
    fetchInbox(baseUrl, projectId)
      .then((response) => {
        if (active) {
          dispatch({
            type: "delta",
            seq: response.seq,
            upserts: response.items,
            removedAskIds: [],
          });
        }
      })
      .catch(() => {
        // The WS may still deliver a snapshot; only the socket's own error sets "error".
      });
    connect();
    return () => {
      active = false;
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [baseUrl, projectId, connect]);

  const items = useMemo(() => rankInbox(state), [state]);
  return { status, items, seq: state.seq, reconnect };
}
