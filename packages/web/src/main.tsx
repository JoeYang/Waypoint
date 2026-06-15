import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WaypointProvider } from "./wp/WaypointProvider.js";
import { App } from "./App.js";
import "./styles/axiom-tokens.css";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <WaypointProvider>
      <App />
    </WaypointProvider>
  </StrictMode>,
);
