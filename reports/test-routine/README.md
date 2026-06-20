# Daily test-routine reports

Run artifacts from `npm run routine:daily` (`scripts/daily-routine.sh`). **Git-ignored** —
this README is the only tracked file here (the directory is created on first run).

Each run writes:

- `YYYYMMDD-HHMMSS.log` — the full captured output of `npm run test:routine`.
- `YYYY-MM-DD.md` — a compact, ANSI-free report: result (PASS/FAIL), the phase + suite
  summary, a pointer to the full log, and — on failure — a triage prompt for the Claude
  Code routine.

The wrapper only **runs and records**; it never reasons about failures or edits code. A
Claude Code routine reads the latest `YYYY-MM-DD.md` (and the referenced log) to investigate
a failure — failing phase, root cause, suspected `file:line` — and surface a triaged summary.

See `docs/testing-and-perf-routine-design.md` for the full design.
