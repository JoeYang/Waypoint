# Agent Team Orchestration

## Lead Behaviour

The lead is a **pure coordinator** — always responsive to the user.

- NEVER implement, edit files, run tests, or execute bash directly
- For anything non-trivial, decompose into tasks and delegate to teammates immediately
- Return to idle after dispatching — do not wait synchronously for teammates
- Respond to user messages instantly, even while teammates are working

> If you are about to write code or run a command, STOP. Create a task instead.

## Teammate Lifecycle

Teammates go idle between turns — this is normal, not recycling. Message an existing teammate before spawning a new one. The system will recycle teammates if the team grows too large; spawn fresh ones as needed.

## Task Protocol

1. Decompose the request into tasks on the shared task list
2. Assign each task to a teammate with full context (file paths, expected output)
3. Return to idle — synthesise results when idle_notifications arrive

## Worktree Discipline

- ALL dev agents MUST work in git worktrees (isolation: "worktree")
- Agents must NEVER write files directly to the main working directory
- After completing work, agents commit to their worktree branch — the lead coordinates merge to main
- If untracked files appear in the main repo from worktree agents, the lead must commit or clean them before proceeding
- The lead is responsible for checking `git status` on main after each agent shutdown and committing any orphaned files

## Merge Strategy (Worktree → Main)

Before merging a worktree feature branch to main:
1. **Rebase first**: rebase the feature branch onto latest main (`git rebase main` from the worktree)
2. **Resolve conflicts in the feature branch**: all merge conflicts must be resolved in the worktree, NOT in main
3. **Run tests after rebase**: `bazel test //...` must pass on the rebased feature branch before merge
4. **Fast-forward merge to main**: once rebased and green, merge to main should be a clean fast-forward (`git merge --ff-only`)
5. **Never force-push main**: if fast-forward fails, the rebase was incomplete — go back to step 1

## Delegate Mode

Always run in delegate mode (Shift+Tab). The lead only: spawns teammates, sends messages, manages the task list.

## Swim Lane Tracking

When a team is created:
1. Create an ASCII swim lane showing each dev's task assignment pipeline
2. Display the swim lane to the user immediately after team setup
3. Update and re-display the swim lane every time a task is completed
4. Use this format:
```
[Team Name] — Swim Lane
═══════════════════════════════════════════
dev-1 (role)  │ [current]▓▓ → next → ...
dev-2 (role)  │  done ✅ → [current]▓▓ → ...
reviewer-1    │ ⏳ standing by
═══════════════════════════════════════════
Progress: X/Y complete  ██████░░░░  Z%
```
Legend: ▓▓ = in progress, ✅ = done, ░░ = pending, ⏳ = waiting, ⚠️ = review fixes
