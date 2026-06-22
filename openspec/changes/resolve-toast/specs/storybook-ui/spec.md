# storybook-ui Specification

## ADDED Requirements

### Requirement: Resolve confirmation toast

The UI SHALL surface a transient, non-modal confirmation toast when a human answers a parked
decision (approving the recommended option, applying another option, or sending a redirecting
constraint), confirming the action landed and the agent is resuming, in addition to flipping the
decision card to its resolved state. The toast SHALL be presented in a polite live region so
assistive technology
announces it without stealing focus, SHALL auto-dismiss after a short delay, and SHALL offer a
manual dismiss control. The confirmation SHALL NOT alter the resolve or adjust semantics — it is
enqueued alongside the existing action.

#### Scenario: Toast confirms an applied option

- **WHEN** a human approves or applies an option on a decision surface
- **THEN** a confirmation toast naming the applied option and that the agent is resuming appears in
  the polite live region

#### Scenario: Toast confirms a sent adjustment

- **WHEN** a human sends a redirecting constraint via the Send & apply path
- **THEN** a confirmation toast that the adjustment was sent and the agent is resuming appears

#### Scenario: A toast auto-dismisses and can be dismissed manually

- **WHEN** a confirmation toast has been shown
- **THEN** it is removed automatically after its timeout elapses, and a human can also remove it
  immediately via its dismiss control
