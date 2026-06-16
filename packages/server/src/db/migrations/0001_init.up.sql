-- Initial Waypoint schema. Tables are authoritative; the event log is an append-only
-- audit. Timestamps are epoch milliseconds (bigint) to match the domain contract.
-- Every row carries project_id (the future tenant boundary).

CREATE TABLE project (
  id           text   PRIMARY KEY,
  name         text   NOT NULL,
  -- Per-project monotonic counter for event.seq. Bumped under a row lock on append,
  -- which also serialises writes within a project.
  seq_counter  bigint NOT NULL DEFAULT 0,
  created_at   bigint NOT NULL
);

CREATE TABLE node (
  id             text   PRIMARY KEY,
  project_id     text   NOT NULL REFERENCES project (id),
  parent_id      text   REFERENCES node (id),
  kind           text   NOT NULL CHECK (kind IN ('goal', 'plan', 'step', 'task')),
  title          text   NOT NULL,
  status         text   NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'DONE', 'DISCARDED')),
  discard_reason text,
  session_id     text,
  version        int    NOT NULL CHECK (version > 0),
  created_at     bigint NOT NULL,
  updated_at     bigint NOT NULL,
  -- A discarded node must carry a reason (mirrors the domain rule).
  CONSTRAINT node_discard_reason CHECK (status <> 'DISCARDED' OR discard_reason IS NOT NULL)
);
CREATE INDEX idx_node_project_status ON node (project_id, status);
CREATE INDEX idx_node_parent ON node (parent_id);

CREATE TABLE ask (
  id               text   PRIMARY KEY,
  project_id       text   NOT NULL REFERENCES project (id),
  node_id          text   NOT NULL REFERENCES node (id),
  type             text   NOT NULL CHECK (type IN ('QUESTION', 'PROPOSAL', 'DECISION')),
  state            text   NOT NULL
                          CHECK (state IN ('OPEN', 'ANSWERED', 'ASSUMED', 'CONFIRMED', 'OVERTURNED')),
  required         boolean NOT NULL,
  prompt           text    NOT NULL,
  options          jsonb   NOT NULL DEFAULT '[]'::jsonb,
  chosen_option_id text,
  assumption       text,
  answer_text      text,
  version          int     NOT NULL CHECK (version > 0),
  created_at       bigint  NOT NULL,
  updated_at       bigint  NOT NULL
);
CREATE INDEX idx_ask_project_node ON ask (project_id, node_id);
-- Supports the blocked computation (an OPEN required ask blocks its node).
CREATE INDEX idx_ask_open_required ON ask (project_id, node_id) WHERE required AND state = 'OPEN';
-- Supports the inbox listing (open asks for a project).
CREATE INDEX idx_ask_project_open ON ask (project_id) WHERE state = 'OPEN';

CREATE TABLE dependency (
  project_id    text NOT NULL REFERENCES project (id),
  node_id       text NOT NULL REFERENCES node (id),
  depends_on_id text NOT NULL REFERENCES node (id),
  PRIMARY KEY (project_id, node_id, depends_on_id)
);
-- Blast radius: count nodes that directly depend on a given node.
CREATE INDEX idx_dependency_depends_on ON dependency (project_id, depends_on_id);

CREATE TABLE event (
  id         text   PRIMARY KEY,
  project_id text   NOT NULL REFERENCES project (id),
  seq        bigint NOT NULL,
  actor      text   NOT NULL CHECK (actor IN ('human', 'agent')),
  verb       text   NOT NULL,
  ref_kind   text   NOT NULL CHECK (ref_kind IN ('node', 'ask')),
  ref_id     text   NOT NULL,
  session_id text,
  summary    text,
  at         bigint NOT NULL,
  CONSTRAINT event_project_seq_unique UNIQUE (project_id, seq)
);
