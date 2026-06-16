import type { JSX } from "react";
import { Badge } from "./Badge.js";
import { Icon } from "../wp/icons.js";

// Whether a decision is reversible. Reversible reads as low-stakes (neutral, rotate icon);
// one-way reads as high-stakes (danger, lock). Shared by the inbox and proposal header.
export function RevBadge({ reversible }: { reversible: boolean }): JSX.Element {
  return reversible ? (
    <Badge variant="neutral">
      <Icon name="rotate" size={12} />
      Reversible
    </Badge>
  ) : (
    <Badge variant="danger">
      <Icon name="lock" size={12} />
      One-way
    </Badge>
  );
}
