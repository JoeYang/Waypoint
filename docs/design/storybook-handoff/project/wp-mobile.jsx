/* wp-mobile.jsx — mobile companion overlay (phone bezel) */
(function () {
  const { Icon, WP_DATA, RiskBadge, RevBadge } = window;
  const { useState } = React;

  function MobileCompanion({ onClose }) {
    // all parked decisions across projects, with local approve state for the demo
    const all = [];
    WP_DATA.projects.forEach(p => p.decisions.forEach(d => all.push({ ...d, project: p.name, color: p.color })));
    const [done, setDone] = useState({});

    const remaining = all.filter(d => !done[d.id]).length;

    return (
      <div className="mobile-scrim" onClick={onClose}>
        <div className="mobile-copy" onClick={e => e.stopPropagation()}>
          <div className="eyebrow-sm">Mobile companion</div>
          <h3>Approve from anywhere.</h3>
          <p>The same parked decisions, on your phone. Glance at the recommendation between meetings, approve with a thumb, and the agent picks it up — you never have to be at your desk to keep the work moving.</p>
          <button className="mobile-close" onClick={onClose}><Icon name="x" size={16} />Close companion</button>
        </div>

        <div className="phone pop" onClick={e => e.stopPropagation()}>
          <div className="phone-screen">
            <div className="phone-notch" />
            <div className="ph-status"><span>9:41</span><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>Waypoint</span></div>
            <div className="ph-top">
              <Icon name="inbox" size={20} style={{ color: "var(--accent-600)" }} />
              <span className="pht">Decisions</span>
              <span className="bdg warning">{remaining} waiting</span>
            </div>
            <div className="ph-body scroll">
              {remaining === 0 && (
                <div className="empty" style={{ padding: "60px 16px" }}>
                  <span className="ei"><Icon name="checkCircle" size={28} /></span>
                  <h3 style={{ fontSize: 20 }}>All clear</h3>
                  <p style={{ fontSize: 13 }}>Every decision is resolved. Go enjoy your coffee.</p>
                </div>
              )}
              {all.map(d => done[d.id] ? (
                <div key={d.id} className="ph-card" style={{ opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--green-600)", fontSize: 13, fontWeight: 600 }}>
                    <Icon name="checkCircle" size={16} strokeWidth={1.8} />Approved · {d.recReason}
                  </div>
                  <div className="pct" style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: "var(--fg-3)" }}>{d.title}</div>
                </div>
              ) : (
                <div key={d.id} className="ph-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                    <span className="glyph" style={{ background: d.color, width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "#fff" }}>{d.project.slice(0, 2).toUpperCase()}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>{d.project}</span>
                  </div>
                  <div className="pct">{d.title}</div>
                  <div className="pcb"><RiskBadge risk={d.risk} /><RevBadge reversible={d.reversible} /></div>
                  <div className="pcd">Agent recommends <strong style={{ color: "var(--fg-1)" }}>{d.recReason}</strong>.</div>
                  <div className="pca">
                    {d.reversible ? (
                      <button className="btn primary sm" onClick={() => setDone(s => ({ ...s, [d.id]: true }))}>
                        <Icon name="check" size={14} strokeWidth={2.1} />Approve
                      </button>
                    ) : (
                      <button className="btn danger sm"><Icon name="lock" size={13} />Review on desktop</button>
                    )}
                    <button className="btn secondary sm">Open</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.MobileCompanion = MobileCompanion;
})();
