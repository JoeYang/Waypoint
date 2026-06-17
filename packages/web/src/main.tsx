import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WaypointProvider } from "./wp/WaypointProvider.js";
import { selectSource } from "./wp/select-source.js";
import { App } from "./App.js";
import "./styles/axiom-tokens.css";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

// VITE_WAYPOINT_API_BASE points the UI at a live backend (e.g. http://localhost:8849);
// unset, it runs on the mock fixtures.
const apiBase = import.meta.env.VITE_WAYPOINT_API_BASE as string | undefined;

createRoot(root).render(
  <StrictMode>
    <WaypointProvider source={selectSource(apiBase)}>
      <App />
    </WaypointProvider>
  </StrictMode>,
);
