import { activeTask, isLoss, canRecover } from "./operations";
import type { AppData, Card, BoardList } from "./types";
export function stageDueAt(data: AppData, card: Card) {
  if (card.deletedAt || isLoss(card.listId) || card.listId === "concluido") return null;
  return data.stageRuns.find((run) => run.id === card.stageRunId)?.dueAt ?? null;
}
export function taskDueAt(data: AppData, card: Card) {
  const task = activeTask(data, card);
  return task
    ? new Date(Date.parse(task.startedAt) + task.slaHours * 3_600_000).toISOString()
    : null;
}
export function slaState(data: AppData, card: Card, now = Date.now()) {
  const stage = stageDueAt(data, card);
  const task = taskDueAt(data, card);
  return {
    stage,
    task,
    stageOverdue: !!stage && now > Date.parse(stage),
    taskOverdue: !!task && now > Date.parse(task),
    recovery: canRecover(card, new Date(now)),
  };
}
export function isCardSlaOverdue(card: Card, _list: BoardList, now = Date.now(), data?: AppData) {
  if (!data) return false;
  const state = slaState(data, card, now);
  return state.stageOverdue || state.taskOverdue;
}
