import type { JSX } from "react";
import { Badge, type BadgeVariant } from "./Badge.js";
import type { Risk } from "../wp/types.js";

const RISK: Record<Risk, { variant: BadgeVariant; label: string }> = {
  low: { variant: "success", label: "Low risk" },
  medium: { variant: "warning", label: "Medium risk" },
  high: { variant: "danger", label: "High risk" },
};

// The decision's risk level as a coloured pill. Shared by the inbox queue and the proposal
// detail header (ported from the handoff's RiskBadge).
export function RiskBadge({ risk }: { risk: Risk }): JSX.Element {
  const { variant, label } = RISK[risk];
  return <Badge variant={variant}>{label}</Badge>;
}
