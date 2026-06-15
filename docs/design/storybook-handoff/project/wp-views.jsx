/* wp-views.jsx — Home, ProjectMap, Inbox, Activity, Settings */
(function () {
  const { Icon, WP_DATA, RiskBadge, RevBadge, wpHelpers } = window;
  const { useState } = React;
  const { taskIconName, streamProgress, streamBarColor } = wpHelpers;

  const streamStatusBadge = (status) => {
    const m = { done: ["success", "Done"], active: ["accent", "In progress"], blocked: ["warning", "Blocked"], queued: ["neutral", "Queued"] };
    const [cls, label] = m[status] || m.queued;
    return <span className={"bdg " + cls}>{label}</span>;
  };

  /* ============================================================ HOME === */
  function Home({ onNav, briefingOpen, onDismissBriefing, resolved = {} }) {
    const d = WP_DATA;
    const decisionsWaiting = d.projects.reduce((a, p) => a + p.decisions.filter(x => !resolved[x.id]).length, 0);
    const agentsWorking = d.projects.filter(p => p.agent === "working").length;
    const tasksInFlight = d.projects.reduce((a, p) => a + p.agentTasks, 0);
    const streamsActive = d.projects.reduce((a, p) => a + p.streams.filter(s => s.status === "active").length, 0);

    return (
      <div className="view-inner fade-in">
        {briefingOpen && (
          <div className="briefing">
            <span className="bi"><Icon name="sun" size={22} /></span>
            <div>
              <h4>Good morning, Joe — it's 11:24.</h4>
              <p>While you were away, your three agents kept building. They finished what they could and parked {decisionsWaiting} decisions for you. Nothing is fully blocked — pick these up whenever you're ready.</p>
            </div>
            <span className="x" onClick={onDismissBriefing}><Icon name="x" size={17} /></span>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow-sm">Overview</div>
          <h1 className="h-page" style={{ marginTop: 6 }}>All projects</h1>
        </div>

        <div className="stat-row">
          <div className="stat"><div className="v warn">{decisionsWaiting}</div><div className="l">Decisions waiting on you</div></div>
          <div className="stat"><div className="v accent">{agentsWorking}</div><div className="l">Agents working now</div></div>
          <div className="stat"><div className="v">{tasksInFlight}</div><div className="l">Tasks in flight</div></div>
          <div className="stat"><div className="v">{streamsActive}</div><div className="l">Active work streams</div></div>
        </div>

        <div className="proj-grid">
          {d.projects.map(p => {
            const dc = p.decisions.filter(x => !resolved[x.id]).length;
            return (
              <div key={p.id} className="pcard" onClick={() => onNav({ project: p.id, view: "map" })}>
                <div className="pcard-top">
                  <span className="glyph" style={{ background: p.color }}>{p.glyph}</span>
                  <div className="pt">
                    <div className="nm">{p.name}</div>
                    <div className="dsc">{p.desc}</div>
                  </div>
                  <span className={"agent-pill" + (p.agent === "idle" ? " idle" : "")}>
                    <span className="lv" />{p.agent === "idle" ? "Idle" : "Working"}
                  </span>
                </div>
                <div className="pcard-streams">
                  {p.streams.slice(0, 4).map(s => {
                    const pr = streamProgress(s);
                    return (
                      <div key={s.id} className="streamline">
                        <span className="snm">{s.name}</span>
                        <span className="bar"><i style={{ width: pr.pct + "%", background: streamBarColor(s) }} /></span>
                        <span className="pct">{pr.done}/{pr.total}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="pcard-foot">
                  {dc > 0
                    ? <span className="bdg warning"><Icon name="diamond" size={12} />{dc} decision{dc > 1 ? "s" : ""} waiting</span>
                    : <span className="bdg success"><Icon name="check" size={12} />All caught up</span>}
                  <div style={{ flex: 1 }} />
                  <span className="muted" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    Open <Icon name="arrowRight" size={15} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ====================================================== PROJECT MAP === */
  function TaskNode({ task, onOpenDecision, resolved = {} }) {
    const isResolved = task.status === "blocked" && resolved[task.decision];
    const status = isResolved ? "active" : task.status;
    const cls = "tcard " + status;
    const connFuture = status === "queued";
    return (
      <div className="tnode">
        <span className={"conn" + (connFuture ? " future" : "")} />
        <div className={cls} onClick={(!isResolved && task.status === "blocked") ? () => onOpenDecision(task.decision) : undefined}>
          <div className="tt"><Icon name={taskIconName[status]} size={15} strokeWidth={1.6} />{task.name}</div>
          {isResolved && <div className="tm" style={{ color: "var(--green-600)" }}>resolved → resuming</div>}
          {!isResolved && task.here && <div style={{ marginTop: 7 }}><span className="here-tag"><Icon name="user" size={11} />You are here</span></div>}
          {!isResolved && task.note && !task.here && <div className="tm">{task.note}</div>}
          {!isResolved && task.status === "blocked" && <div style={{ marginTop: 7 }}><span className="bdg warning">Decision parked</span></div>}
        </div>
      </div>
    );
  }

  function ProjectMap({ project, onNav, onOpenDecision, resolved = {} }) {
    return (
      <div className="view-inner wide fade-in">
        <div className="view-head">
          <div className="vh-title">
            <div className="eyebrow-sm">{project.streams.length} parallel streams</div>
            <h1 className="h-page" style={{ marginTop: 6 }}>Project map</h1>
          </div>
          <div className="vh-sp" />
          <div className="legend2">
            <span className="li"><span className="sw done" />Done</span>
            <span className="li"><span className="sw active" />In progress</span>
            <span className="li"><span className="sw blocked" />Decision parked</span>
            <span className="li"><span className="sw queued" />Queued</span>
          </div>
        </div>

        <p className="muted" style={{ fontSize: 14, marginTop: -8, marginBottom: 22, maxWidth: 720 }}>
          Each stream advances on its own. When one hits a decision it can't make, the agent parks it and keeps the others moving — so a single approval never stalls the whole project.
        </p>

        {project.streams.map(s => {
          const pr = streamProgress(s);
          return (
            <div key={s.id} className="lane">
              <div className="lane-head">
                <span className="lname">{s.name}</span>
                {streamStatusBadge(s.status)}
                <span className="lspace" />
                <span className="lmeta">{pr.done}/{pr.total} done</span>
              </div>
              <div className="lane-track scroll">
                {s.tasks.map((t, i) => <TaskNode key={i} task={t} onOpenDecision={onOpenDecision} resolved={resolved} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ============================================================ INBOX === */
  function Inbox({ project, onOpenDecision, resolved = {} }) {
    const [filter, setFilter] = useState("all");
    const waiting = project.decisions.filter(d => !resolved[d.id]);
    const decisions = waiting.filter(d =>
      filter === "all" ? true : filter === "blocking" ? d.blocking : !d.blocking);

    return (
      <div className="view-inner fade-in">
        <div className="view-head">
          <div className="vh-title">
            <div className="eyebrow-sm">Decision inbox</div>
            <h1 className="h-page" style={{ marginTop: 6 }}>
              {waiting.length > 0
                ? `${waiting.length} waiting`
                : "All caught up"}
            </h1>
          </div>
          <div className="vh-sp" />
          {waiting.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {["all", "blocking", "non-blocking"].map(f => (
                <span key={f} className={"chip" + (filter === (f === "non-blocking" ? "non" : f) ? " active" : "")}
                      onClick={() => setFilter(f === "non-blocking" ? "non" : f)}>
                  {f === "all" ? "All" : f === "blocking" ? "Blocking" : "Non-blocking"}
                </span>
              ))}
            </div>
          )}
        </div>

        {waiting.length > 0 && (
          <p className="muted" style={{ fontSize: 14, marginTop: -8, marginBottom: 20 }}>
            The agent is still working on {project.agentTasks} tasks while these wait. A queue, not an interruption.
          </p>
        )}

        {decisions.length === 0 ? (
          <div className="empty">
            <span className="ei"><Icon name="checkCircle" size={30} /></span>
            <h3>{waiting.length === 0 ? "Nothing waiting on you" : "No decisions in this filter"}</h3>
            <p>{waiting.length === 0
              ? "Every decision is resolved. The agent will surface the next one here the moment it needs you."
              : "Try a different filter to see the other parked decisions."}</p>
          </div>
        ) : (
          <div className="qlist">
            {decisions.map(d => (
              <div key={d.id} className="qrow" onClick={() => onOpenDecision(d.id)}>
                <span className={"qico " + d.risk}><Icon name={d.risk === "high" ? "alert" : "diamond"} size={19} strokeWidth={1.6} /></span>
                <div className="qbody">
                  <div className="qtitle">{d.title}</div>
                  <div className="qbadges">
                    <RiskBadge risk={d.risk} />
                    <RevBadge reversible={d.reversible} />
                    <span className="bdg neutral mono">{d.stream}</span>
                  </div>
                  <div className="qdesc">Agent recommends <strong style={{ color: "var(--fg-1)" }}>{d.recReason}</strong>. {d.context.split(".")[0]}.</div>
                </div>
                <div className="qside">
                  <span className="qtime">parked {d.parked}</span>
                  {d.blocking
                    ? <span className="bdg accent">Blocks 1 task</span>
                    : <span className="bdg neutral">Non-blocking</span>}
                  <span className="muted" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>Review <Icon name="chevronRight" size={15} /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ========================================================= ACTIVITY === */
  function Activity({ project }) {
    const dotKind = { done: "done", parked: "parked", you: "you", edit: "edit" };
    const dotIcon = { done: "check", parked: "diamond", you: "user", edit: "file" };
    return (
      <div className="view-inner fade-in">
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow-sm">Activity</div>
          <h1 className="h-page" style={{ marginTop: 6 }}>What happened this morning</h1>
        </div>
        <div className="timeline">
          {project.activity.map((g, gi) => (
            <div key={gi} className="tl-group">
              <div className="tl-time">{g.time}</div>
              {g.items.map((it, ii) => (
                <div key={ii} className="tl-item">
                  <span className={"dot " + dotKind[it.kind]}>
                    {it.kind !== "parked" && it.kind !== "you" && <Icon name={dotIcon[it.kind]} size={10} strokeWidth={2} />}
                  </span>
                  <div className="tl-body">
                    <div className="tx">{it.text} {it.stream && it.stream !== "Session" && <span className="stream-tag">{it.stream}</span>}</div>
                    {it.sub && <div className="sub">{it.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ========================================================= SETTINGS === */
  function Settings({ project }) {
    const [toggles, setToggles] = useState({
      autoLow: true, autoFmt: true, notifPush: true, notifEmail: false, parallel: true, dryRun: true,
    });
    const flip = (k) => setToggles(t => ({ ...t, [k]: !t[k] }));
    const Row = ({ k, name, sub }) => (
      <div className="set-row">
        <div className="srd"><div className="srn">{name}</div><div className="srs">{sub}</div></div>
        <div className={"toggle" + (toggles[k] ? " on" : "")} onClick={() => flip(k)}><span className="knob" /></div>
      </div>
    );
    return (
      <div className="view-inner fade-in">
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow-sm">{project.name} · settings</div>
          <h1 className="h-page" style={{ marginTop: 6 }}>How this agent works with you</h1>
        </div>
        <div className="set-grid">
          <div className="set-card">
            <div className="sch"><h4>Decision policy</h4><p>Decide what the agent can settle on its own versus what it parks for you.</p></div>
            <Row k="autoLow" name="Auto-approve low-risk, reversible decisions" sub="The agent proceeds and logs it to Activity — no parking." />
            <Row k="autoFmt" name="Don't ask about formatting or lint fixes" sub="Cosmetic, always-reversible changes are applied silently." />
            <Row k="dryRun" name="Require a dry-run for destructive migrations" sub="High-risk, one-way changes always need typed confirmation." />
          </div>
          <div className="set-card">
            <div className="sch"><h4>Notifications</h4><p>How Waypoint reaches you when a decision is parked.</p></div>
            <Row k="notifPush" name="Push to mobile companion" sub="Get a tap-to-review notification on your phone." />
            <Row k="notifEmail" name="Email digest" sub="A summary of parked decisions every few hours." />
          </div>
          <div className="set-card">
            <div className="sch"><h4>Streams</h4><p>How aggressively the agent parallelizes work.</p></div>
            <Row k="parallel" name="Run independent streams in parallel" sub="Keeps other streams moving while one waits on a decision." />
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { Home, ProjectMap, Inbox, Activity, Settings });
})();
