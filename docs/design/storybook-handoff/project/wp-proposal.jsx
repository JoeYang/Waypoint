/* wp-proposal.jsx — decision detail, comment thread, working approve/redirect */
(function () {
  const { Icon, WP_DATA, RiskBadge, RevBadge } = window;
  const { useState, useRef, useEffect } = React;

  function Msg({ m, user }) {
    const who = m.who;
    const label = who === "agent" ? "Agent" : who === "you" ? user.name : "Waypoint";
    return (
      <div className={"msg " + who}>
        {who === "system"
          ? <span className="av avatar" style={{ background: "transparent", color: "var(--fg-4)", width: 30, height: 30 }}><Icon name="info" size={18} /></span>
          : <span className={"av avatar " + (who === "agent" ? "agent" : "you")}>{who === "agent" ? <Icon name="cpu" size={15} /> : user.initials}</span>}
        <div className="mc">
          <div className="mtop"><span className="who">{label}</span><span className="mt">{m.t}</span></div>
          <div className="mbody">{m.text}</div>
        </div>
      </div>
    );
  }

  function Thread({ decision, threadExtra, user, onComment, resolved }) {
    const bodyRef = useRef(null);
    const [text, setText] = useState("");
    const messages = decision.thread.concat(threadExtra || []);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages.length]);
    const send = () => { const v = text.trim(); if (!v) return; onComment(v); setText(""); };
    return (
      <div className="thread">
        <div className="thread-h"><Icon name="message" size={16} />Discussion with the agent</div>
        <div className="thread-body scroll" ref={bodyRef}>
          {messages.map((m, i) => <Msg key={i} m={m} user={user} />)}
        </div>
        <div className="thread-compose">
          <div className="compose-box">
            <textarea placeholder="Comment, or redirect the agent…" value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
            <div className="compose-bar">
              <span className="hint">⌘↩ to send · threads to the agent</span>
              <div style={{ flex: 1 }} />
              <button className="btn primary sm" onClick={send} disabled={!text.trim()}><Icon name="send" size={14} />Send</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Proposal({ decision, project, resolved, threadExtra, onBack, onResolve, onComment }) {
    const recIdx = decision.options.findIndex(o => o.rec);
    const [selected, setSelected] = useState(recIdx >= 0 ? recIdx : 0);
    const user = WP_DATA.user;
    const isResolved = !!resolved;
    const chosenName = isResolved ? resolved.option : decision.options[selected].name;

    return (
      <div className="view-inner wide fade-in">
        <span className="back-link" onClick={onBack}><Icon name="arrowLeft" size={15} />Back to decisions</span>
        <div className="prop-grid">
          {/* proposal */}
          <div className="prop">
            <div className="prop-h">
              <div className="prop-badges">
                <RiskBadge risk={decision.risk} />
                <RevBadge reversible={decision.reversible} />
                <span className="bdg accent"><Icon name="diamond" size={12} />{decision.stream}</span>
              </div>
              <h2 className="prop-q">{decision.title}</h2>
              <div className="prop-meta">
                Parked {decision.parked}<span className="dotsep">·</span>
                agent continued on {decision.continued}<span className="dotsep">·</span>
                <span className="code-ref">{decision.file}</span>
              </div>
            </div>

            <div className="prop-b">
              <div>
                <div className="sec-l">Why this came up</div>
                <div className="sec-t">{decision.context}</div>
              </div>

              <div>
                <div className="sec-l">Options &amp; tradeoffs — {isResolved ? "you chose " : "pick one"}{isResolved && <strong>{chosenName}</strong>}</div>
                <div className="opts">
                  {decision.options.map((o, i) => {
                    const active = isResolved ? o.name === chosenName : i === selected;
                    return (
                      <div key={o.name} className={"opt" + (active ? " sel" : "")}
                           onClick={() => !isResolved && setSelected(i)}>
                        {o.rec && <span className="rectag"><Icon name="star" size={11} />Agent recommends</span>}
                        <div className="on">{o.name}<span className="radio" /></div>
                        {o.pros.map((p, k) => <div key={"p" + k} className="tr pro"><span className="pm">+</span>{p}</div>)}
                        {o.cons.map((c, k) => <div key={"c" + k} className="tr con"><span className="pm">−</span>{c}</div>)}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={"callout " + (decision.impact.kind)}>
                <Icon name={decision.impact.kind === "danger" ? "alert" : "info"} size={17} strokeWidth={1.6} />
                <div className="ct"><strong>If you defer:</strong> {decision.impact.text}</div>
              </div>
            </div>

            {isResolved ? (
              <div className="resolved-banner">
                <Icon name="checkCircle" size={18} strokeWidth={1.8} />
                Resolved — agent is applying <strong style={{ margin: "0 4px" }}>{chosenName}</strong> and resuming “{decision.blocksTask}”.
              </div>
            ) : (
              <div className="prop-actions">
                <button className="btn primary" onClick={() => onResolve(decision.id, chosenName)}>
                  <Icon name="check" size={16} strokeWidth={2.1} />
                  {selected === recIdx ? "Approve recommendation" : `Apply ${chosenName}`}
                </button>
                <span className="muted" style={{ fontSize: 13 }}>
                  {selected === recIdx ? "Drizzle is the agent's pick" : "Overriding the recommendation"}
                </span>
                <span className="sp" />
                {decision.reversible
                  ? <span className="muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="rotate" size={14} />Reversible — safe to decide fast</span>
                  : <span className="bdg danger"><Icon name="lock" size={12} />Needs typed confirmation</span>}
              </div>
            )}
          </div>

          {/* thread */}
          <Thread decision={decision} threadExtra={threadExtra} user={user}
                  resolved={isResolved} onComment={(t) => onComment(decision.id, t)} />
        </div>
      </div>
    );
  }

  window.Proposal = Proposal;
})();
