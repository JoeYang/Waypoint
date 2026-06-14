# ask-lifecycle Specification

## Purpose
TBD - created by archiving change add-core-ask-loop. Update Purpose after archive.
## Requirements
### Requirement: Node hierarchy within a project
The system SHALL represent work as `node` records that belong to a `project` and form a tree via an optional `parent_id`. Each node SHALL carry a `kind` of `goal`, `plan`, `step`, or `task` used as a display hint; intermediate levels MAY be skipped (a `goal` may directly parent a `task`).

#### Scenario: Create a child node under a goal
- **WHEN** a node of kind `task` is created with its `parent_id` set to an existing `goal` node in the same project
- **THEN** the task is persisted with that parent and appears as a descendant of the goal

#### Scenario: Reject a parent from another project
- **WHEN** a node is created with a `parent_id` that belongs to a different project
- **THEN** the system rejects the request with a validation error and creates nothing

### Requirement: Dependency edges
The system SHALL allow a node to declare a `depends_on` edge to another node in the same project. A node that depends on a node which is not `DONE` SHALL be considered blocked by that dependency. Edges MUST be acyclic and confined to one project.

#### Scenario: Dependent node is blocked until its dependency completes
- **WHEN** node B has a `depends_on` edge to node A and A is not `DONE`
- **THEN** B's computed `blocked` is true

#### Scenario: Cyclic dependency is rejected
- **WHEN** adding a `depends_on` edge would create a cycle
- **THEN** the system rejects the edge and adds nothing

### Requirement: Node status spine
A node SHALL have a stored `status` of exactly one of `DRAFT`, `ACTIVE`, `DONE`, or `DISCARDED`. Transition to `DISCARDED` MUST include a reason. The system SHALL reject transitions that are not part of the defined spine.

#### Scenario: Discard requires a reason
- **WHEN** a node is transitioned to `DISCARDED` without a reason
- **THEN** the system rejects the transition and the node keeps its prior status

### Requirement: Parking an ask
An agent SHALL be able to park an `ask` on a node with a `type` of `QUESTION`, `PROPOSAL`, or `DECISION`, an initial state of `OPEN`, and a `required` flag. A `DECISION` ask MUST carry at least two options.

#### Scenario: Park a required decision
- **WHEN** an agent parks a `DECISION` ask with two options and `required = true` on a node
- **THEN** the ask is persisted in state `OPEN` and linked to that node

#### Scenario: Reject a decision with fewer than two options
- **WHEN** an agent parks a `DECISION` ask with fewer than two options
- **THEN** the system rejects the request with a validation error

### Requirement: Proceed-on-assumption
An ask SHALL support the agent proceeding on an assumption: `OPEN → ASSUMED`. A human SHALL later resolve an `ASSUMED` ask to `CONFIRMED` or `OVERTURNED`. An `OVERTURNED` ask MUST be recorded so the owning agent can re-triage.

#### Scenario: Overturning an assumption flags re-triage
- **WHEN** a human overturns an ask that is in state `ASSUMED`
- **THEN** the ask moves to `OVERTURNED` and an event is recorded indicating the affected node needs re-triage

### Requirement: Answering an ask
The system SHALL allow a human to answer an `OPEN` ask, moving it to `ANSWERED` (recording the chosen option for a `DECISION`). Answering an ask MUST be atomic with appending its event.

#### Scenario: Answer an open decision
- **WHEN** a human answers an `OPEN` decision ask by selecting a valid option
- **THEN** the ask moves to `ANSWERED`, the chosen option is recorded, and a single event is appended in the same transaction

### Requirement: Computed blocked state
The system SHALL compute `blocked` for a node as: there exists an `OPEN` `required` ask on the node, OR an unmet dependency edge. `blocked` SHALL NOT be a stored, independently-writable field; a materialized value MAY be cached but MUST always equal the freshly computed value after any mutation.

#### Scenario: Node becomes unblocked when its required ask is answered
- **WHEN** the only `OPEN` `required` ask on an `ACTIVE` node is answered
- **THEN** the node's computed `blocked` becomes false

#### Scenario: Materialized blocked matches computed value
- **WHEN** any mutation that can affect blocking is applied
- **THEN** the cached `blocked` value for every affected node equals the value computed from its asks and dependency edges

### Requirement: Blast radius of an ask
The system SHALL compute `blast_radius` for an ask as the number of nodes that directly depend (via a `depends_on` edge) on the ask's node and are therefore gated by resolving it. For this slice it counts direct dependents only; transitive closure is deferred.

#### Scenario: Blast radius reflects directly dependent nodes
- **WHEN** a required ask sits on a node that three other nodes directly `depends_on`
- **THEN** the ask's `blast_radius` is reported as 3

### Requirement: Optimistic concurrency
Every mutating operation on a node or ask SHALL require an `expected_version`. If the supplied version does not match the current version, the system MUST reject the write and return the current state without mutating anything. A successful mutation MUST increment the version.

#### Scenario: Stale write is rejected
- **WHEN** a mutation supplies an `expected_version` lower than the node's current version
- **THEN** the system rejects the write, returns the current state, and leaves the node unchanged

#### Scenario: Overturn-while-done race resolves safely
- **WHEN** an agent attempts to mark a node `DONE` using a version that a concurrent human overturn has already superseded
- **THEN** the agent's write is rejected as stale and the node reflects the overturn

### Requirement: Append-only event log
Every mutation SHALL append an immutable `event` carrying the actor (`human` or `agent`), a verb, the affected reference, and a per-project monotonic `seq`. Events MUST NOT be updated or deleted.

#### Scenario: Mutation appends a sequenced event
- **WHEN** any node or ask mutation succeeds
- **THEN** exactly one event is appended with the next `seq` for that project, in the same transaction as the mutation

#### Scenario: Derived recompute does not emit extra events
- **WHEN** answering one ask recomputes `blocked`/`blast_radius` on several dependent nodes
- **THEN** exactly one event (the answer) is appended, and the recomputed values are reflected without additional events

