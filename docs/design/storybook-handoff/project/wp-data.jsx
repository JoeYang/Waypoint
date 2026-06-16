/* wp-data.jsx — seed data for the Waypoint prototype.
   A morning in the life: agents have been running; decisions are waiting. */
(function () {
  const data = {
    now: "11:24",
    user: { name: "Joe Yang", email: "joe@orbit.dev", initials: "JY" },

    projects: [
      /* ===================================================== orbit-api === */
      {
        id: "orbit-api",
        name: "orbit-api",
        desc: "REST API & data platform",
        glyph: "OA", color: "#3b4cad",
        agent: "working", agentTasks: 6,
        streams: [
          { id: "auth", name: "Auth", status: "done", tasks: [
            { name: "Auth middleware", status: "done" },
            { name: "Token rotation", status: "done" },
          ]},
          { id: "data", name: "Data layer", status: "active", tasks: [
            { name: "Schema migration", status: "done", note: "142 tests green" },
            { name: "Choose ORM", status: "blocked", decision: "d1" },
            { name: "Seed scripts", status: "active", note: "agent editing now", here: true },
          ]},
          { id: "api", name: "API routes", status: "active", tasks: [
            { name: "Resource routes", status: "active", note: "agent here" },
            { name: "Session store", status: "blocked", decision: "d2" },
            { name: "Validation", status: "queued" },
            { name: "Rate limiting", status: "queued" },
          ]},
          { id: "infra", name: "Infra & CI", status: "active", tasks: [
            { name: "CI pipeline", status: "done" },
            { name: "Dockerfile", status: "active" },
            { name: "Deploy config", status: "queued" },
          ]},
          { id: "dash", name: "Dashboard", status: "queued", tasks: [
            { name: "App shell", status: "queued" },
            { name: "Charts", status: "queued" },
          ]},
        ],
        decisions: [
          {
            id: "d1", risk: "medium", reversible: true, blocking: true,
            stream: "Data layer", blocksTask: "Choose ORM",
            title: "Which ORM should the data layer use?",
            parked: "12m ago", continued: "5 unblocked tasks", file: "src/db/index.ts",
            context: "About to write the first six repository modules. The ORM choice shapes every query, the typing story, and the migration tooling — so it's worth one decision now rather than a refactor later.",
            options: [
              { name: "Prisma", pros: ["Best-in-class DX, typed client"], cons: ["Heavy runtime, codegen step"] },
              { name: "Drizzle", rec: true, pros: ["Thin, SQL-first, fully typed", "No codegen in CI"], cons: ["Younger ecosystem"] },
              { name: "Knex", pros: ["Battle-tested, flexible"], cons: ["No types, manual mapping"] },
            ],
            recReason: "Drizzle",
            impact: { kind: "info", text: "the agent keeps building against a thin Repository interface and stubs the implementation. Switching later costs about one file." },
            thread: [
              { who: "agent", t: "11:12", text: "I need an ORM before writing the repository modules. The options and my recommendation are laid out above." },
              { who: "agent", t: "11:12", text: "I leaned Drizzle — the schema is relational, we want typed queries, and I'd rather not add a codegen step to CI." },
              { who: "you", t: "11:15", text: "What about migrations? I want them reviewable as plain SQL in the repo." },
              { who: "agent", t: "11:16", text: "Drizzle Kit can emit raw SQL migrations to db/migrations — fully reviewable in PRs. I'll wire that up if you pick Drizzle." },
            ],
          },
          {
            id: "d2", risk: "medium", reversible: true, blocking: false,
            stream: "API routes", blocksTask: "Session store",
            title: "Session storage — Redis or signed cookies?",
            parked: "1h ago", continued: "the rest of the API stream", file: "src/api/sessions.ts",
            context: "The auth layer is ready to issue sessions. Redis gives central revocation and shared state; signed cookies are stateless and need no extra infra. This shapes the deploy footprint.",
            options: [
              { name: "Redis", rec: true, pros: ["Central revocation", "Shared across instances"], cons: ["One more service to run"] },
              { name: "Signed cookies", pros: ["Stateless, zero infra"], cons: ["Hard to revoke early"] },
            ],
            recReason: "Redis",
            impact: { kind: "info", text: "the agent has stubbed a Session interface and moved on — nothing downstream is blocked while this waits." },
            thread: [
              { who: "agent", t: "10:12", text: "Parked this and kept going — I stubbed a Session interface so the rest of the API stream isn't blocked." },
            ],
          },
          {
            id: "d3", risk: "high", reversible: false, blocking: false,
            stream: "Data layer", blocksTask: "User model",
            title: "Merge the users and accounts tables?",
            parked: "2h ago", continued: "every other task", file: "db/migrations/0008_merge.sql",
            context: "The two tables are nearly 1:1 and the join shows up in most queries. Merging simplifies the model — but it's a destructive migration that can't be cleanly rolled back. The exact SQL and a dry-run diff are attached.",
            options: [
              { name: "Keep separate", rec: true, pros: ["Zero risk, reversible", "Add a view for ergonomics"], cons: ["Join stays in hot queries"] },
              { name: "Merge now", pros: ["Simplest model"], cons: ["Destructive, irreversible", "Touches 23 call sites"] },
            ],
            recReason: "Keep separate",
            impact: { kind: "danger", text: "this is destructive and one-way — the agent will not run it without your explicit, typed confirmation." },
            thread: [
              { who: "agent", t: "09:30", text: "Flagging this as high-risk. I won't run the migration without explicit sign-off — the dry-run diff is attached for review." },
            ],
          },
        ],
        activity: [
          { time: "11:18 — now", items: [
            { kind: "edit", stream: "Data layer", text: "Editing src/db/seed.ts", sub: "writing fixture data for the users table" },
            { kind: "parked", stream: "Data layer", text: "Parked a decision — Which ORM should the data layer use?", sub: "continued on 5 unblocked tasks" },
          ]},
          { time: "11:04", items: [
            { kind: "done", stream: "Data layer", text: "142 tests passed", sub: "schema migration verified" },
            { kind: "edit", stream: "API routes", text: "Started Resource routes", sub: "src/api/resources.ts" },
          ]},
          { time: "10:46", items: [
            { kind: "you", stream: "Infra & CI", text: "You approved — Use pnpm for the workspace", sub: "agent applied it and re-locked dependencies" },
            { kind: "parked", stream: "API routes", text: "Parked a decision — Session storage strategy", sub: "stubbed a Session interface, kept moving" },
          ]},
          { time: "10:08", items: [
            { kind: "done", stream: "Infra & CI", text: "Dockerfile built", sub: "multi-stage, 84MB final image" },
          ]},
          { time: "09:30", items: [
            { kind: "parked", stream: "Data layer", text: "Parked a decision — Merge users and accounts tables", sub: "high-risk, awaiting explicit sign-off" },
            { kind: "done", stream: "Data layer", text: "Schema migration applied", sub: "0007_add_index" },
          ]},
          { time: "08:44", items: [
            { kind: "you", stream: "Session", text: "Session started — agent picked up 41 tasks across 5 streams", sub: "you stepped away" },
          ]},
        ],
      },

      /* ===================================================== atlas-web === */
      {
        id: "atlas-web",
        name: "atlas-web",
        desc: "Customer dashboard (frontend)",
        glyph: "AW", color: "#2f7a7a",
        agent: "working", agentTasks: 3,
        streams: [
          { id: "uikit", name: "UI kit", status: "active", tasks: [
            { name: "Design tokens", status: "done" },
            { name: "Component primitives", status: "blocked", decision: "a1" },
            { name: "Theme switcher", status: "queued" },
          ]},
          { id: "data", name: "Data", status: "active", tasks: [
            { name: "API client", status: "done" },
            { name: "Query caching", status: "active", note: "agent here" },
          ]},
          { id: "routing", name: "Routing", status: "done", tasks: [
            { name: "Router setup", status: "done" },
            { name: "Route guards", status: "done" },
          ]},
        ],
        decisions: [
          {
            id: "a1", risk: "medium", reversible: true, blocking: true,
            stream: "UI kit", blocksTask: "Component primitives",
            title: "Adopt Radix UI or hand-roll the primitives?",
            parked: "38m ago", continued: "the data stream", file: "src/components/primitives",
            context: "We need accessible primitives — dialog, popover, menu, tooltip. Building them by hand is more code and more accessibility risk; Radix gives unstyled, accessible behavior we can theme freely.",
            options: [
              { name: "Radix UI", rec: true, pros: ["Accessible out of the box", "Unstyled — full design control"], cons: ["A dependency to track"] },
              { name: "Hand-roll", pros: ["Zero dependencies"], cons: ["More code, a11y burden"] },
              { name: "Headless UI", pros: ["Lightweight"], cons: ["Fewer primitives"] },
            ],
            recReason: "Radix UI",
            impact: { kind: "info", text: "the agent is building the data layer in the meantime, so the UI kit is the only thing waiting." },
            thread: [
              { who: "agent", t: "10:46", text: "Recommending Radix — it covers every primitive on our list and stays unstyled so the design tokens fully control the look." },
            ],
          },
        ],
        activity: [
          { time: "10:48 — now", items: [
            { kind: "edit", stream: "Data", text: "Editing query cache layer", sub: "src/data/cache.ts" },
            { kind: "parked", stream: "UI kit", text: "Parked a decision — Radix UI or hand-roll primitives?", sub: "kept building the data stream" },
          ]},
          { time: "10:02", items: [
            { kind: "done", stream: "Routing", text: "Route guards complete", sub: "auth-gated routes verified" },
            { kind: "done", stream: "Data", text: "API client generated", sub: "from the orbit-api OpenAPI spec" },
          ]},
          { time: "09:10", items: [
            { kind: "you", stream: "Session", text: "Session started — 18 tasks across 3 streams", sub: "" },
          ]},
        ],
      },

      /* ==================================================== ledger-svc === */
      {
        id: "ledger-svc",
        name: "ledger-svc",
        desc: "Double-entry payments ledger",
        glyph: "LS", color: "#3f7a48",
        agent: "idle", agentTasks: 0,
        streams: [
          { id: "ingest", name: "Ingest", status: "done", tasks: [
            { name: "Event consumer", status: "done" },
            { name: "Idempotency keys", status: "done" },
          ]},
          { id: "core", name: "Ledger core", status: "done", tasks: [
            { name: "Double-entry posting", status: "done" },
            { name: "Balance projections", status: "done" },
            { name: "Audit log", status: "done" },
          ]},
          { id: "recon", name: "Reconciliation", status: "done", tasks: [
            { name: "Daily recon job", status: "done", note: "all assigned work complete" },
          ]},
        ],
        decisions: [],
        activity: [
          { time: "09:55", items: [
            { kind: "done", stream: "Reconciliation", text: "Finished all assigned work — agent idle", sub: "6 tasks across 3 streams, all green" },
          ]},
          { time: "08:30", items: [
            { kind: "you", stream: "Session", text: "Session started — 6 tasks", sub: "" },
          ]},
        ],
      },
    ],

    notifications: [
      { id: "n1", unread: true, tone: "warning", icon: "diamond", project: "orbit-api",
        text: "Agent parked a decision — Which ORM should the data layer use?", time: "12m ago", to: { project: "orbit-api", decision: "d1" } },
      { id: "n2", unread: true, tone: "warning", icon: "diamond", project: "atlas-web",
        text: "Agent parked a decision — Radix UI or hand-roll primitives?", time: "38m ago", to: { project: "atlas-web", decision: "a1" } },
      { id: "n3", unread: false, tone: "success", icon: "checkCircle", project: "orbit-api",
        text: "142 tests passed on the data layer", time: "20m ago", to: { project: "orbit-api", view: "activity" } },
      { id: "n4", unread: false, tone: "accent", icon: "check", project: "orbit-api",
        text: "Your approval applied — Use pnpm for the workspace", time: "38m ago", to: { project: "orbit-api", view: "activity" } },
      { id: "n5", unread: false, tone: "success", icon: "checkCircle", project: "ledger-svc",
        text: "Agent finished all assigned work — nothing waiting", time: "1h ago", to: { project: "ledger-svc", view: "map" } },
    ],
  };

  window.WP_DATA = data;
})();
