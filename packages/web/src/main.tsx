import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WaypointProvider } from "./wp/WaypointProvider.js";
import { ToastProvider } from "./components/ToastProvider.js";
import { selectSource, resolveApiBase } from "./wp/select-source.js";
import { App } from "./App.js";
import "./styles/axiom-tokens.css";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

// Where the UI gets its data: an explicit VITE_WAYPOINT_API_BASE always wins; otherwise a
// production build (the prod container serves the SPA and the API from one origin) defaults to
// its own origin so the deployed UI is live; a dev build with no base runs on the mock fixtures.
const apiBase = resolveApiBase(
  import.meta.env.VITE_WAYPOINT_API_BASE as string | undefined,
  import.meta.env.PROD,
  typeof window !== "undefined" ? window.location.origin : undefined,
);

createRoot(root).render(
  <StrictMode>
    <WaypointProvider source={selectSource(apiBase)}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </WaypointProvider>
  </StrictMode>,
);
