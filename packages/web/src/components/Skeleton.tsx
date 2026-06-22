import type { CSSProperties, JSX } from "react";
import s from "./Skeleton.module.css";

export interface SkeletonProps {
  /** Block/line width — a CSS length string or a number (treated as px). */
  width?: string | number;
  /** Block/line height — a CSS length string or a number (treated as px). */
  height?: string | number;
  /** Corner radius — any CSS length (e.g. "9999px" for a pill). */
  radius?: string;
  /** When given, render this many stacked line bars instead of one block. */
  lines?: number;
}

// A length prop may be a number (px) or an already-formatted CSS string; undefined falls through
// so the stylesheet default applies.
function len(v: string | number | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

// A presentational shimmer placeholder shown while data loads. It is purely decorative
// (aria-hidden) so it contributes nothing to the accessibility tree — the surrounding loading
// state owns the accessible "Loading…" signal. The shimmer is disabled under prefers-reduced-motion
// via the stylesheet.
export function Skeleton({ width, height, radius, lines }: SkeletonProps): JSX.Element {
  const style: CSSProperties = {};
  const w = len(width);
  const h = len(height);
  if (w !== undefined) style.width = w;
  if (h !== undefined) style.height = h;
  if (radius !== undefined) style.borderRadius = radius;

  if (lines !== undefined) {
    return (
      <div className={s.lines} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} data-skeleton-line className={s.block} style={style} />
        ))}
      </div>
    );
  }

  return <span aria-hidden="true" className={s.block} style={style} />;
}
