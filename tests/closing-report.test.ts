import { describe, expect, it } from "vitest";
import { closingReport } from "../src/fechamento/domain/closing-report";
import {
  createInitialData,
  type Card,
  type Stage,
  type StageRun,
  type TaskExecution,
} from "../src/fechamento/domain/types";

const at = (hour: number) => new Date(Date.UTC(2026, 8, 15, hour)).toISOString();
const now = Date.UTC(2026, 8, 16, 12);
const card = (id: string, stage: Stage, unitId: string, stageRunId: string, extra = {}) =>
  ({
    id,
    listId: stage,
    unitId,
    stageRunId,
    consultor_id: "consultant",
    atingiu_fechamento: true,
    data_fechamento: at(12),
    valor_original: 3200,
    valor_proposta: 3000,
    deletedAt: null,
    recovered: false,
    cliente_nome: id,
    imovel: id,
    ...extra,
  }) as Card;
const run = (
  id: string,
  cardId: string,
  stage: Stage,
  start: string,
  end: string | null,
  due: string | null = null,
): StageRun => ({
  id,
  cardId,
  stage,
  startedAt: start,
  endedAt: end,
  dueAt: due,
  actorId: "test",
});
const task = (
  id: string,
  cardId: string,
  stageRunId: string,
  start: string,
  end: string | null,
): TaskExecution => ({
  id,
  cardId,
  stageRunId,
  taskId: "task-1",
  name: "Conferir documentos",
  position: 1,
  slaHours: 1,
  required: false,
  actorId: "test",
  startedAt: start,
  endedAt: end,
  outcome: end ? "completed" : null,
});

describe("relatório de fechamento", () => {
  it("mede todos os cards que chegaram ao fechamento sem contar proposta nem card excluído", () => {
    const data = createInitialData();
    const unit = data.tables["equipes"]![0]!.id;
    data.cards.push(
      card("concluded", "concluido", unit, "a-end"),
      card("pending", "pendencia", unit, "b-pending"),
      card("deleted", "cancelado", unit, "c-end", { deletedAt: at(18) }),
      card("proposal", "proposta", unit, "d-start", {
        atingiu_fechamento: false,
        data_fechamento: null,
      }),
    );
    data.stageRuns.push(
      run("a-proposal", "concluded", "proposta", at(10), at(12)),
      run("a-closing", "concluded", "fechamento_enviado", at(12), at(14), at(13)),
      run("a-approved", "concluded", "aprovado", at(14), at(16)),
      run("a-keys", "concluded", "entrega_chaves", at(16), at(17)),
      run("a-end", "concluded", "concluido", at(17), null),
      run("b-closing", "pending", "fechamento_enviado", at(12), at(13)),
      run("b-pending", "pending", "pendencia", at(13), null, at(14)),
    );
    data.taskExecutions.push(
      task("first", "concluded", "a-closing", at(12), at(13)),
      task("repeat", "concluded", "a-closing", at(13), at(14)),
    );
    const result = closingReport(data, { from: "", to: "", unitId: "", consultantId: "" }, now);
    expect(result.total).toBe(2);
    expect(result.concluded).toBe(1);
    expect(result.proposedRentTotal).toBe(6000);
    expect(result.negotiatedDifferencePercent).toBeCloseTo(6.25);
    expect(result.entryByDay).toEqual([{ day: "2026-09-15", count: 2 }]);
    expect(result.active).toBe(1);
    expect(result.approvedEver).toBe(1);
    expect(result.averageCycleMs).toBe(5 * 3_600_000);
    expect(result.stageMetrics.find((entry) => entry.id === "fechamento_enviado")).toMatchObject({
      visits: 2,
      averageMs: 1.5 * 3_600_000,
      overdue: 1,
    });
    expect(result.stageBottleneck?.id).toBe("aprovado");
    expect(result.stageBacklog?.id).toBe("pendencia");
    expect(result.taskMetrics[0]).toMatchObject({ visits: 2, rework: 1, averageMs: 3_600_000 });
    expect(result.openCards[0]).toMatchObject({ overdue: true });
    expect(result.runs.some((entry) => entry.stage === "proposta")).toBe(false);
  });

  it("aplica o período da primeira entrada e o escopo de unidades", () => {
    const data = createInitialData();
    const [itapema, balneario] = data.tables["equipes"]!;
    data.cards.push(
      card("a", "fechamento_enviado", itapema!.id, "a-run"),
      card("b", "fechamento_enviado", balneario!.id, "b-run"),
    );
    data.stageRuns.push(
      run("a-run", "a", "fechamento_enviado", at(12), null),
      run("b-run", "b", "fechamento_enviado", at(12), null),
    );
    const filters = { from: "2026-09-15", to: "2026-09-15", unitId: "", consultantId: "" };
    expect(closingReport(data, filters, now).total).toBe(2);
    expect(
      closingReport(data, { ...filters, allowedUnitIds: [itapema!.id] }, now).cards.map(
        (entry) => entry.id,
      ),
    ).toEqual(["a"]);
    expect(closingReport(data, { ...filters, from: "2026-09-16" }, now).total).toBe(0);
  });
});
