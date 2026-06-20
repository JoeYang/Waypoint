// Container healthcheck: probe the dependency-free /healthz endpoint and exit 0/1. Kept as a
// file (not an inline `node -e …`) because podman-compose mangles the quoting/parens of an
// inline CMD array into broken `/bin/sh -c` — a file path has nothing to misquote.
const port = process.env.WAYPOINT_HTTP_PORT || "8849";
fetch("http://localhost:" + port + "/healthz")
  .then((r) => process.exit(r.ok ? 0 : 1))
  .catch(() => process.exit(1));
