import type { JSX, ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  variant?: BadgeVariant;
  mono?: boolean;
  children: ReactNode;
}

// A small semantic status pill. Colour carries the meaning; an optional leading icon can be
// passed as a child.
export function Badge({ variant = "neutral", mono = false, children }: BadgeProps): JSX.Element {
  const className = [styles.bdg, styles[variant], mono && styles.mono].filter(Boolean).join(" ");
  return <span className={className}>{children}</span>;
}
