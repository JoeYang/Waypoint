/**
 * Electron main process for the Waypoint desktop shell.
 *
 * Thin client: this process owns a single secure {@link BrowserWindow} that
 * loads the existing web UI from a separately-run backend. It does NOT start
 * the Node server or Postgres — those run independently, matching the cloud
 * topology.
 *
 * The only non-trivial logic (resolving the target URL) lives in the pure,
 * unit-tested {@link resolveWebUrl} helper. Electron's own module is imported
 * dynamically and behind a minimal local type so the rest of the package
 * (and the tested helper) typechecks even when `electron`'s types are not
 * installed in this environment.
 */
import { resolveWebUrl } from "./url.js";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 832;

// Minimal structural types for the slice of Electron we use. The real types
// ship with the `electron` package; this keeps the file typechecking without
// requiring the (large) native install in CI.
interface BrowserWindowLike {
  loadURL(url: string): Promise<void>;
}
interface ElectronApi {
  app: {
    whenReady(): Promise<void>;
    on(event: "window-all-closed" | "activate", listener: () => void): void;
    quit(): void;
  };
  BrowserWindow: {
    new (options: unknown): BrowserWindowLike;
    getAllWindows(): BrowserWindowLike[];
  };
}

function createWindow(electron: ElectronApi): BrowserWindowLike {
  const window = new electron.BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    webPreferences: {
      // Secure defaults: the remote web UI must not reach Node/Electron internals.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = resolveWebUrl(process.env);
  void window.loadURL(url);
  return window;
}

async function main(): Promise<void> {
  // Dynamic import keeps the untyped Electron dependency out of the module graph
  // for tooling that does not have it installed.
  const electron = (await import("electron")) as unknown as ElectronApi;

  await electron.app.whenReady();
  createWindow(electron);

  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow(electron);
    }
  });

  electron.app.on("window-all-closed", () => {
    // macOS apps conventionally stay alive until the user quits explicitly.
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
}

void main();
