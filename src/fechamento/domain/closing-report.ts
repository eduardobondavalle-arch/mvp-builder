import { STAGES, type AppData, type Card, type Stage } from "./types";

export type ClosingFilters = {
  from: string;
  to: string;
  unitId: string;
  consultantId: string;
  allowedUnitIds?: string[];
};

export type DurationMetric = {
  id: string;
  name: string;
  visits: number;
  cards: number;
  finished: number;
  open: number;
  overdue: number;
  rework: number;
  averageMs: number | null;
  medianMs: number | null;
  p90Ms: number | null;
  totalMs: number;
};

type TimedEntry = {
  cardId: string;
  startedAt: string;
  endedAt: string | null;
  dueAt: string | null;
  rework?: boolean;
};

const terminal = new Set<Stage>(["concluido", "cancelado", "reprovado"]);
const operations = STAGES.filter((stage) => stage.id !== "proposta" && !terminal.has(stage.id));
const time = (value: string) => Date.parse(value);
const elapsed = (start: string, end: string, now: number) =>
  Math.max(0, (end ? time(end) : now) - time(start));
const mean = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(fraction * sorted.length) - 1]!;
};
const localDate = (value: string) =>
  new Date(value).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function durationMetric(
  id: string,
  name: string,
  entries: TimedEntry[],
  now: number,
): DurationMetric {
  const closed = entries.filter((entry) => entry.endedAt);
  const durations = closed.map((entry) => elapsed(entry.startedAt, entry.endedAt!, now));
  return {
    id,
    name,
    visits: entries.length,
    cards: new Set(entries.map((entry) => entry.cardId)).size,
    finished: closed.length,
    open: entries.length - closed.length,
    overdue: entries.filter(
      (entry) =>
        entry.dueAt && time(entry.endedAt ?? new Date(now).toISOString()) > time(entry.dueAt),
    ).length,
    rework: entries.filter((entry) => entry.rework).length,
    averageMs: mean(durations),
    medianMs: percentile(durations, 0.5),
    p90Ms: percentile(durations, 0.9),
    totalMs: entries.reduce(
      (total, entry) => total + elapsed(entry.startedAt, entry.endedAt ?? "", now),
      0,
    ),
  };
}

export function closingReport(data: AppData, filters: ClosingFilters, now = Date.now()) {
  const firstRunByCard = new Map<string, string>();
  for (const run of data.stageRuns) {
    if (run.stage !== "fechamento_enviado") continue;
    const previous = firstRunByCard.get(run.cardId);
    if (!previous || time(run.startedAt) < time(previous))
      firstRunByCard.set(run.cardId, run.startedAt);
  }
  const firstByCard = new Map<string, string>();
  const cards = data.cards.filter((card) => {
    if (card.deletedAt || !card.atingiu_fechamento) return false;
    if (filters.allowedUnitIds && !filters.allowedUnitIds.includes(card.unitId)) return false;
    if (filters.unitId && card.unitId !== filters.unitId) return false;
    if (filters.consultantId && card.consultor_id !== filters.consultantId) return false;
    const first = firstRunByCard.get(card.id) ?? card.data_fechamento;
    if (!first) return false;
    const date = localDate(first);
    if ((filters.from && date < filters.from) || (filters.to && date > filters.to)) return false;
    firstByCard.set(card.id, first);
    return true;
  });
  const selected = new Set(cards.map((card) => card.id));
  const runs = data.stageRuns.filter(
    (run) =>
      selected.has(run.cardId) &&
      run.stage !== "proposta" &&
      time(run.startedAt) >= time(firstByCard.get(run.cardId)!),
  );
  const runById = new Map(runs.map((run) => [run.id, run]));
  const closingRunCards = new Set(
    runs.filter((run) => run.stage === "fechamento_enviado").map((run) => run.cardId),
  );
  const tasks = data.taskExecutions.filter(
    (task) => selected.has(task.cardId) && runById.has(task.stageRunId),
  );
  const stageMetrics = operations.map((stage) =>
    durationMetric(
      stage.id,
      stage.name,
      runs.filter((run) => run.stage === stage.id).map((run) => ({ ...run, dueAt: run.dueAt })),
      now,
    ),
  );
  const taskGroups = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = `${runById.get(task.stageRunId)!.stage}:${task.taskId}`;
    taskGroups.set(key, [...(taskGroups.get(key) ?? []), task]);
  }
  const taskMetrics = [...taskGroups].map(([key, entries]) => {
    const stage = runById.get(entries[0]!.stageRunId)!.stage;
    const previouslyExecuted = new Set<string>();
    return {
      ...durationMetric(
        key,
        entries[0]!.name,
        [...entries]
          .sort((a, b) => time(a.startedAt) - time(b.startedAt))
          .map((entry) => {
            const repeated = previouslyExecuted.has(entry.cardId);
            previouslyExecuted.add(entry.cardId);
            return {
              cardId: entry.cardId,
              startedAt: entry.startedAt,
              endedAt: entry.endedAt,
              dueAt: new Date(time(entry.startedAt) + entry.slaHours * 3_600_000).toISOString(),
              rework: repeated,
            };
          }),
        now,
      ),
      stage,
    };
  });
  const visited = (stage: Stage) =>
    new Set(runs.filter((run) => run.stage === stage).map((run) => run.cardId)).size;
  const concluded = cards.filter((card) => card.listId === "concluido");
  const lost = cards.filter((card) => card.listId === "cancelado" || card.listId === "reprovado");
  const active = cards.filter((card) => !terminal.has(card.listId));
  const cycleTimes = concluded.flatMap((card) => {
    const end = runs.find((run) => run.cardId === card.id && run.stage === "concluido")?.startedAt;
    return end ? [elapsed(firstByCard.get(card.id)!, end, now)] : [];
  });
  const openCards = active
    .map((card) => {
      const run = runs.find((entry) => entry.id === card.stageRunId);
      return {
        card,
        ageMs: elapsed(firstByCard.get(card.id)!, "", now),
        stageAgeMs: run ? elapsed(run.startedAt, "", now) : 0,
        overdue: Boolean(run?.dueAt && now > time(run.dueAt)),
      };
    })
    .sort((a, b) => b.ageMs - a.ageMs);
  const stageBottleneck =
    [...stageMetrics]
      .filter((metric) => metric.finished)
      .sort((a, b) => (b.averageMs ?? 0) - (a.averageMs ?? 0))[0] ?? null;
  const taskBottleneck =
    [...taskMetrics]
      .filter((metric) => metric.finished)
      .sort((a, b) => (b.averageMs ?? 0) - (a.averageMs ?? 0))[0] ?? null;
  const stageBacklog =
    [...stageMetrics].filter((metric) => metric.open).sort((a, b) => b.open - a.open)[0] ?? null;
  const taskBacklog =
    [...taskMetrics].filter((metric) => metric.open).sort((a, b) => b.open - a.open)[0] ?? null;
  const proposedRentTotal = cards.reduce((total, card) => total + card.valor_proposta, 0);
  const originalRentTotal = cards.reduce((total, card) => total + card.valor_original, 0);
  const outcomeByStage = STAGES.filter((stage) => stage.id !== "proposta").map((stage) => ({
    stage: stage.id,
    count: cards.filter((card) => card.listId === stage.id).length,
  }));
  const lossReasons = [...new Set(lost.map((card) => card.motivo_perda_id ?? ""))]
    .map((reasonId) => ({
      reasonId,
      count: lost.filter((card) => (card.motivo_perda_id ?? "") === reasonId).length,
    }))
    .sort((a, b) => b.count - a.count);
  const days = new Map<string, number>();
  for (const card of cards) {
    const day = localDate(firstByCard.get(card.id)!);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  const entryByDay = [...days]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const grouping = (key: (card: Card) => string) => {
    const groups = new Map<string, Card[]>();
    for (const card of cards) {
      const id = key(card);
      groups.set(id, [...(groups.get(id) ?? []), card]);
    }
    return [...groups]
      .map(([id, members]) => ({
        id,
        total: members.length,
        concluded: members.filter((card) => card.listId === "concluido").length,
        active: members.filter((card) => !terminal.has(card.listId)).length,
        lost: members.filter((card) => card.listId === "cancelado" || card.listId === "reprovado")
          .length,
      }))
      .sort((a, b) => b.total - a.total);
  };
  return {
    cards,
    runs,
    tasks,
    stageMetrics,
    taskMetrics: taskMetrics.sort((a, b) => (b.averageMs ?? 0) - (a.averageMs ?? 0)),
    stageBottleneck,
    taskBottleneck,
    stageBacklog,
    taskBacklog,
    proposedRentTotal,
    proposedRentAverage: cards.length ? proposedRentTotal / cards.length : null,
    negotiatedDifferencePercent: originalRentTotal
      ? ((originalRentTotal - proposedRentTotal) / originalRentTotal) * 100
      : null,
    outcomeByStage,
    lossReasons,
    entryByDay,
    byUnit: grouping((card) => card.unitId),
    byConsultant: grouping((card) => card.consultor_id),
    openCards,
    total: cards.length,
    missingClosingHistory: cards.filter((card) => !closingRunCards.has(card.id)).length,
    active: active.length,
    concluded: concluded.length,
    lost: lost.length,
    recovered: cards.filter((card) => card.recovered).length,
    overdueOpen: openCards.filter((entry) => entry.overdue).length,
    approvedEver: visited("aprovado"),
    keysEver: visited("entrega_chaves"),
    averageCycleMs: mean(cycleTimes),
    medianCycleMs: percentile(cycleTimes, 0.5),
    completedCycleCount: cycleTimes.length,
  };
}
