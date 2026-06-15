import { useState } from "react";
import type {
  AnswerRequest,
  GoalProgress,
  PlanProgress,
  ProjectProgress,
  TaskProgress,
} from "@waypoint/shared";
import { InboxCard } from "./InboxCard.js";
import styles from "./Spine.module.css";

interface SpineProps {
  progress: ProjectProgress;
  workingAskIds: ReadonlySet<string>;
  onAnswer: (askId: string, req: AnswerRequest) => void;
}

// The project spine: the goal→plan→task home. It stays calm and glanceable — it collapses
// to the live edge (settled work folds away), shows importance as visual weight rather than
// reordering, and re-homes the slice-1 decision card in place on the task it blocks. Pure
// presentational: state + answers are owned by the container.
export function Spine({ progress, workingAskIds, onAnswer }: SpineProps): React.JSX.Element {
  if (progress.goals.length === 0) {
    return (
      <p className={styles.empty} role="status">
        No goals yet — the spine fills in as work is registered.
      </p>
    );
  }
  return (
    <div className={styles.spine}>
      {progress.goals.map((goal) => (
        <GoalSection
          key={goal.nodeId}
          goal={goal}
          workingAskIds={workingAskIds}
          onAnswer={onAnswer}
        />
      ))}
    </div>
  );
}

function GoalSection({
  goal,
  workingAskIds,
  onAnswer,
}: {
  goal: GoalProgress;
  workingAskIds: ReadonlySet<string>;
  onAnswer: (askId: string, req: AnswerRequest) => void;
}): React.JSX.Element {
  return (
    <section className={styles.goal} data-state={goal.state} data-testid={`goal-${goal.nodeId}`}>
      <header className={styles.goalHeader}>
        <h1 className={styles.goalTitle}>{goal.title}</h1>
        <div className={styles.goalMeta}>
          <StateBadge state={goal.state} />
          <span className={styles.count}>
            {goal.plansDone} / {goal.plansTotal} plans
          </span>
          {goal.openAskCount > 0 ? (
            <span className={styles.count}>{goal.openAskCount} open</span>
          ) : null}
        </div>
      </header>
      {goal.plans.map((plan) => (
        <PlanSection
          key={plan.nodeId}
          plan={plan}
          workingAskIds={workingAskIds}
          onAnswer={onAnswer}
        />
      ))}
    </section>
  );
}

const isSettled = (t: TaskProgress): boolean => t.state === "done" || t.state === "failed";

function PlanSection({
  plan,
  workingAskIds,
  onAnswer,
}: {
  plan: PlanProgress;
  workingAskIds: ReadonlySet<string>;
  onAnswer: (askId: string, req: AnswerRequest) => void;
}): React.JSX.Element {
  const [showDone, setShowDone] = useState(false);
  // Keep data order (no blast-radius sort); only fold settled work away by default.
  const edge = plan.tasks.filter((t) => !isSettled(t));
  const settled = plan.tasks.filter(isSettled);
  return (
    <section className={styles.plan} data-state={plan.state} data-testid={`plan-${plan.nodeId}`}>
      <header className={styles.planHeader}>
        <h2 className={styles.planTitle}>{plan.title}</h2>
        <div className={styles.planMeta}>
          <StateBadge state={plan.state} />
          {plan.agentLabel !== null ? (
            <span className={styles.agent}>{plan.agentLabel}</span>
          ) : null}
          {plan.openAskCount > 0 ? (
            <span className={styles.count}>{plan.openAskCount} open</span>
          ) : null}
        </div>
      </header>
      <ul className={styles.tasks}>
        {edge.map((task) => (
          <TaskRow
            key={task.nodeId}
            task={task}
            workingAskIds={workingAskIds}
            onAnswer={onAnswer}
          />
        ))}
        {showDone
          ? settled.map((task) => (
              <TaskRow
                key={task.nodeId}
                task={task}
                workingAskIds={workingAskIds}
                onAnswer={onAnswer}
              />
            ))
          : null}
      </ul>
      {settled.length > 0 ? (
        <button
          type="button"
          className={styles.foldToggle}
          aria-expanded={showDone}
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? "Hide" : "Show"} {settled.length} done
        </button>
      ) : null}
    </section>
  );
}

function TaskRow({
  task,
  workingAskIds,
  onAnswer,
}: {
  task: TaskProgress;
  workingAskIds: ReadonlySet<string>;
  onAnswer: (askId: string, req: AnswerRequest) => void;
}): React.JSX.Element {
  return (
    <li
      className={styles.task}
      data-state={task.state}
      data-weight={task.blastRadius}
      data-testid={`task-${task.nodeId}`}
    >
      <div className={styles.taskHead}>
        {task.group !== null ? <span className={styles.group}>{task.group.title} ·</span> : null}
        <span className={styles.taskTitle}>{task.title}</span>
        <StateBadge state={task.state} />
      </div>
      {task.asks.map((ask) => (
        <InboxCard
          key={ask.askId}
          item={ask}
          working={workingAskIds.has(ask.askId)}
          onAnswer={(req) => onAnswer(ask.askId, req)}
        />
      ))}
    </li>
  );
}

function StateBadge({ state }: { state: string }): React.JSX.Element {
  return (
    <span className={styles.badge} data-state={state}>
      {state}
    </span>
  );
}
