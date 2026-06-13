# Waypoint — Implementation Roadmap (MVP-focused)

The near-term goal: reach a **usable MVP we can dogfood** — run Waypoint locally and use it to
build Waypoint itself. Phases are framed by **outcome** (what becomes possible), not tasks.

> Status: **draft for review.** One foundational fork to settle before P1 (see "Decision to settle").

---

## MVP definition

A single-human, single-project tool, delivered as:
- **Backend running locally** — the MCP server (so agents connect), plus the REST/WebSocket API for the UI.
- **An Electron desktop app**, packaged and copied to your Desktop — the inbox + (post-MVP) blocking view.
- **Hooked to this repo** — Waypoint registered as a project so the agents building Waypoint park their decisions *into* Waypoint. Using Waypoint to build Waypoint is the MVP's acceptance test.

Cloud hosting, auth, and multi-tenant stay the **end-state (P8)** — the MVP is local-first by design.

---

## Path to MVP

```
  P0 ──▶ P1 ──▶ P2 ──▶ P3 ──▶ P4 ════ MVP ════▶  (dogfooding Waypoint on Waypoint)
 found.  loop   inbox  pkg   dogfood
  ✅
```

### P0 — Foundation · ✅ done
Design locked, repo + harness + OpenSpec set up, first-slice plan written and reviewed.

### P1 — Prove the loop · *the spine*
**Outcome:** an agent parks a decision, keeps working on what's unblocked; you answer in a bare inbox (run in the browser during dev); the agent picks it up and resumes — live.
**Done when:** the full park → keep-working → answer → unblock cycle works for one seeded project and the inbox re-ranks in real time.
*(= the planned `add-core-ask-loop` change.)* · Size **L**

### P2 — An inbox worth opening · *the hero*
**Outcome:** questions, proposals, and decisions each render clearly; you can confirm or overturn an assumption; every card shows what it's blocking and the most-unblocking answer floats to the top.
**Done when:** a real agent session can be driven entirely from the inbox and it feels good. · Size **M**

### P3 — Package as a desktop app · *the delivery*
**Outcome:** the inbox ships as an Electron app, packaged and copied to your Desktop; a single documented command brings the local backend up.
**Done when:** you double-click the app, it connects to the local backend, and the loop works outside a dev server. · Size **S–M**

### P4 — Dogfood on this repo · *the proof*
**Outcome:** Waypoint is registered as a project; this repo's CLAUDE.md / MCP config points agents at the local Waypoint so they park real decisions here while building Waypoint.
**Done when:** a Waypoint-building session actually parks a decision into Waypoint and you answer it from the app. · Size **S**

```
  ════════════════════ MVP COMPLETE ════════════════════
```

---

## Beyond the MVP (sketch — sequence later)

- **Blocking view** — the standalone second screen surveying impact across all pending decisions.
- **Many projects** — register/switch + aggregated cross-project inbox.
- **Any harness** — verify the loop on Codex & OpenCode; interactive resume + provenance.
- **Memory that compounds** — tighter context handoff, decision archaeology.
- **Connected** — GitHub PR/MR links + merged/unmerged state; aggregated notifications.
- **Cloud-ready (v1.0)** — auth/tenant, hosted deployment, security & observability hardening.

---

## Delivery decision — settled

**Parity (separate local service).** The backend runs locally as a standalone Node service with real Postgres (via docker-compose); the Electron app is purely the UI talking to `localhost`. This is exact parity with the cloud end-state (P8) — nothing in the data or transport layer gets rewritten later. Day to day you bring the stack up with `docker compose up` plus the backend, and launch the packaged app.

**Implication:** the planned `add-core-ask-loop` change is **unaffected** — it already assumed a separate Postgres-backed server. The roadmap only *adds* the Electron shell (P3) and the dogfood hookup (P4) on top of the existing plan.

Everything else (Postgres, TypeScript end-to-end, MCP over Streamable HTTP on localhost, the import-direction layering) was already locked.
