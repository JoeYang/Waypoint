# Consistent visual decision signals (UI review items 8–11)

## Why

The decision surfaces each grew their visual treatments independently, so the same signal reads
differently from screen to screen. A clickable decision row in the inbox or the home command bar
gives no hover affordance that it opens something. The agent's recommended option is louder in
some places (a pill) but quiet in others (the same neutral card as every alternative), so it does
not win the glance. High-risk is coloured red on the map node and the inline card, but a high-risk
row in the inbox and the proposal header look identical to a low-risk one. And the "new since you
left" treatment on the inline card is just a text badge with no peripheral accent.

This slice makes the four signals consistent across the surfaces where they are missing, using
**only data already present in each view** — no new data plumbing. It is CSS-led polish plus
minimal markup (a hover chevron, a conditional class for high-risk rows / recommended options /
new cards). All behaviour is unchanged; this is purely presentational.

## What Changes

In `packages/web`, all additive and presentational:

- **Item 8 — hover affordance on clickable decision rows.** The Inbox `qrow` and the Home
  command-bar decision rows gain a subtle 1px lift and a chevron that slides on hover, signalling
  the row opens the proposal. The DecisionCard buttons already lift; left aligned. Respects
  `prefers-reduced-motion`.
- **Item 9 — recommended option, louder.** In the Proposal option cards and the DecisionCard
  review chips, the recommended option (`o.rec`) gets a faint `--accent-50` wash / accent border
  so it wins the glance, in addition to the existing "Agent recommends" / "Recommended" label.
- **Item 10 — new-since-you-left ring.** The DecisionCard's existing `isNew` treatment gains a
  small accent ring/dot accent on the card itself. Only applied where `isNew` is already known
  (the inline card); not plumbed into Inbox/Home/map (out of scope — needs digest data absent
  there).
- **Item 11 — high-risk red, consistent.** The Inbox `qrow` for a `risk === "high"` decision gets
  a faint red left edge, and the Proposal header/container gets a subtle high-risk red accent — so
  high risk reads the same as it already does on the map node (S4b) and the inline card (S2).

**No MCP-contract or DB-schema change. `packages/web` only.**

## Impact

- `packages/web` only: `components/Inbox.{tsx,module.css}` (high-risk row class + hover chevron),
  `components/Home.module.css` (decision-row hover lift + chevron slide),
  `components/Proposal.{tsx,module.css}` (recommended-option wash + high-risk header accent),
  `components/DecisionCard.module.css` (recommended-chip wash + new-card ring).
- No new data is read; existing `decision.risk`, `option.rec`, and `decision.isNew` drive the
  classes. Transitions respect `prefers-reduced-motion`.
