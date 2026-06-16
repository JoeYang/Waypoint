/* wp-ui.jsx — shared chrome & primitives */
(function () {
  const { Icon, WaypointMark, WP_DATA } = window;

  /* ---- status helpers (shared across views) ------------------------- */
  const taskIconName = { done: "checkCircle", active: "circleDot", blocked: "diamond", queued: "circle" };
  function streamProgress(stream) {
    const total = stream.tasks.length;
    const done = stream.tasks.filter(t => t.status === "done").length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }
  function streamBarColor(stream) {
    if (stream.status === "done") return "var(--green-600)";
    if (stream.status === "blocked") return "var(--amber-500)";
    if (stream.status === "queued") return "var(--ink-300)";
    return "var(--accent-500)";
  }

  /* ---- badges -------------------------------------------------------- */
  function RiskBadge({ risk }) {
    const map = { low: ["success", "Low risk"], medium: ["warning", "Medium risk"], high: ["danger", "High risk"] };
    const [cls, label] = map[risk] || map.medium;
    return <span className={"bdg " + cls}>{label}</span>;
  }
  function RevBadge({ reversible }) {
    return reversible
      ? <span className="bdg neutral"><Icon name="rotate" size={12} />Reversible</span>
      : <span className="bdg danger"><Icon name="lock" size={12} />One-way</span>;
  }

  /* ---- sidebar ------------------------------------------------------- */
  function Sidebar({ projectId, view, onNav, onOpenMobile, onHome, resolved = {} }) {
    const d = WP_DATA;
    const project = d.projects.find(p => p.id === projectId);
    const decisionCount = project ? project.decisions.filter(x => !resolved[x.id]).length : 0;
    const navItems = [
      { id: "map", label: "Project map", icon: "map" },
      { id: "inbox", label: "Decisions", icon: "inbox", pip: decisionCount },
      { id: "activity", label: "Activity", icon: "activity" },
      { id: "settings", label: "Settings", icon: "settings" },
    ];
    return (
      <aside className="sb">
        <div className="sb-brand" style={{ cursor: "pointer" }} onClick={onHome}>
          <WaypointMark size={26} />
          <span className="name">Waypoint</span>
        </div>

        <div className="sb-sec">
          <div className="sb-label">Projects <span className="add"><Icon name="plus" size={15} /></span></div>
          {d.projects.map(p => {
            const dc = p.decisions.filter(x => !resolved[x.id]).length;
            return (
              <div key={p.id} className={"proj" + (p.id === projectId ? " active" : "")}
                   onClick={() => onNav({ project: p.id, view: "map" })}>
                <span className="glyph" style={{ background: p.color }}>{p.glyph}</span>
                <div className="meta">
                  <div className="pname">{p.name}</div>
                  <div className="pstat">
                    <span className={"live-dot" + (p.agent === "idle" ? " idle" : "")}></span>
                    {p.agent === "idle" ? "Idle · caught up" : `Working · ${p.agentTasks} tasks`}
                  </div>
                </div>
                {dc > 0 && <span className="count-pip">{dc}</span>}
              </div>
            );
          })}
        </div>

        {project && (
          <div className="sb-sec sb-nav">
            <div className="sb-label">{project.name}</div>
            {navItems.map(n => (
              <div key={n.id} className={"sb-item" + (view === n.id ? " active" : "")}
                   onClick={() => onNav({ project: projectId, view: n.id })}>
                <Icon name={n.icon} size={18} />
                {n.label}
                {n.pip ? <span className="pip warn">{n.pip}</span> : null}
              </div>
            ))}
            <div className="sb-item" onClick={onOpenMobile}>
              <Icon name="smartphone" size={18} />
              Mobile companion
            </div>
          </div>
        )}

        <div className="sb-foot">
          <div className="sb-user">
            <span className="avatar you" style={{ width: 30, height: 30, fontSize: 12 }}>{d.user.initials}</span>
            <div className="ud">
              <div className="un">{d.user.name}</div>
              <div className="ue">{d.user.email}</div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  /* ---- top bar ------------------------------------------------------- */
  function TopBar({ project, view, now, unread, onBell }) {
    const viewLabel = { map: "Project map", inbox: "Decisions", activity: "Activity", settings: "Settings", proposal: "Decision", home: "All projects" }[view] || "";
    return (
      <header className="topbar">
        {project ? (
          <div className="crumb">
            <span className="glyph" style={{ background: project.color, width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "#fff" }}>{project.glyph}</span>
            <span className="ct">{project.name}</span>
            <span className="muted">/</span>
            <span className="sub">{viewLabel}</span>
          </div>
        ) : (
          <div className="crumb"><span className="ct">All projects</span></div>
        )}
        <div className="tb-spacer" />
        {project && (
          <span className={"agent-pill" + (project.agent === "idle" ? " idle" : "")}>
            <span className="lv" />
            {project.agent === "idle" ? "Agent idle" : <>Agent working <span className="mono">· {project.agentTasks} tasks</span></>}
          </span>
        )}
        <span className="clock">{now} AM</span>
        <button className="iconbtn" onClick={onBell} aria-label="Notifications">
          <Icon name="bell" size={19} />
          {unread > 0 && <span className="ndot" />}
        </button>
      </header>
    );
  }

  /* ---- notifications panel ------------------------------------------ */
  function NotificationsPanel({ onClose, onOpen }) {
    const d = WP_DATA;
    const toneColor = {
      warning: { bg: "#fbf2dd", fg: "var(--amber-500)" },
      success: { bg: "#edf4ee", fg: "var(--green-600)" },
      accent: { bg: "var(--accent-50)", fg: "var(--accent-600)" },
    };
    return (
      <>
        <div className="overlay-scrim" onClick={onClose} />
        <div className="notif-panel pop">
          <div className="notif-h">
            <span className="nt">Notifications</span>
            <button className="btn ghost sm" onClick={onClose}>Mark all read</button>
          </div>
          <div className="notif-list">
            {d.notifications.map(n => {
              const tc = toneColor[n.tone] || toneColor.accent;
              return (
                <div key={n.id} className={"notif" + (n.unread ? " unread" : "")}
                     onClick={() => onOpen(n.to)}>
                  <span className="ni" style={{ background: tc.bg, color: tc.fg }}>
                    <Icon name={n.icon} size={16} />
                  </span>
                  <div>
                    <div className="ntx">{n.text}</div>
                    <div className="ntm">{n.project} · {n.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  Object.assign(window, {
    RiskBadge, RevBadge, Sidebar, TopBar, NotificationsPanel,
    wpHelpers: { taskIconName, streamProgress, streamBarColor },
  });
})();
