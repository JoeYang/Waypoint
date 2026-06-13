import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { WsClientFrameSchema, type WsServerFrame } from "@waypoint/shared";
import type { InboxHub, Subscription } from "./hub.js";

const STREAM_PATH = /^\/v1\/projects\/([^/]+)\/stream$/;
// Bound the per-connection outbound buffer: if a slow client lets it grow past this, send
// a resync and stop streaming deltas to it (drop-to-resync, never unbounded buffering).
const MAX_BUFFERED_BYTES = 1 << 20; // 1 MiB
const HEARTBEAT_DEFAULT_MS = 30_000;

interface InboxWsOptions {
  heartbeatMs?: number; // 0 disables the heartbeat (tests)
}

// Transport adapter: binds the InboxHub to real WebSocket connections on
// /v1/projects/:projectId/stream. Holds no domain logic — it validates the client's resume
// frame, subscribes to the hub, and forwards server frames, with heartbeat liveness and
// back-pressure-driven resync. Reconnect correctness lives in the hub (resume-since-seq).
export function createInboxWsServer(
  hub: InboxHub,
  server: Server,
  opts: InboxWsOptions = {},
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const alive = new WeakMap<WebSocket, boolean>();

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const match = STREAM_PATH.exec(path);
    if (!match) {
      socket.destroy(); // not a stream endpoint — refuse the upgrade
      return;
    }
    const projectId = decodeURIComponent(match[1] ?? "");
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, projectId);
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, projectId: string) => {
    alive.set(ws, true);
    let subscription: Subscription | null = null;

    const send = (frame: WsServerFrame): void => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        ws.send(JSON.stringify({ type: "resync", reason: "back-pressure" }));
        return;
      }
      ws.send(JSON.stringify(frame));
    };

    ws.on("pong", () => alive.set(ws, true));

    ws.on("message", (raw: Buffer) => {
      const parsed = WsClientFrameSchema.safeParse(safeJson(raw.toString()));
      if (!parsed.success) {
        ws.close(1008, "invalid frame");
        return;
      }
      const frame = parsed.data;
      if (frame.projectId !== projectId) {
        ws.close(1008, "project scope mismatch");
        return;
      }
      if (subscription) return; // already subscribed; ignore a duplicate resume
      void hub
        .subscribe(projectId, frame.lastSeq, send)
        .then((sub) => {
          // The connection may have closed during the async subscribe; tidy up if so.
          if (ws.readyState === WebSocket.OPEN) subscription = sub;
          else sub.close();
        })
        .catch(() => ws.close(1011, "subscription failed"));
    });

    const teardown = (): void => {
      subscription?.close();
      subscription = null;
    };
    ws.on("close", teardown);
    ws.on("error", teardown);
  });

  // Heartbeat: ping every connection; terminate any that did not pong since the last tick,
  // reaping zombie/half-open sockets (and their hub subscriptions via the close handler).
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_DEFAULT_MS;
  const timer =
    heartbeatMs > 0
      ? setInterval(() => {
          for (const ws of wss.clients) {
            if (alive.get(ws) === false) {
              ws.terminate();
              continue;
            }
            alive.set(ws, false);
            ws.ping();
          }
        }, heartbeatMs)
      : null;
  timer?.unref();
  wss.on("close", () => {
    if (timer) clearInterval(timer);
  });

  return wss;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
