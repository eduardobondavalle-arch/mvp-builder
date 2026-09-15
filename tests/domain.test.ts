import { describe, expect, it } from "vitest";
import {
  execute,
  activeTask,
  canRecover,
  emptyPerson,
  projectJornadas,
  transitionGaps,
  taskSequence,
  isTaskCompleted,
  type Command,
} from "../src/fechamento/domain/operations";
import {
  createInitialData,
  STAGES,
  type Actor,
  type Stage,
  type AppData,
} from "../src/fechamento/domain/types";
import { slaState } from "../src/fechamento/domain/sla";
import {
  calcularIndicadores,
  funilCompleto,
  conversaoPorCanal,
  rankingConsultores,
  rankingEquipes,
  aplicarFiltros,
  filtrosVazios,
  dataDeCompetencia,
} from "../src/lib/metrics";
import { importData } from "../src/fechamento/persistence/migrate";
const actor: Actor = {
  id: "operator",
  name: "Operador de teste",
  permissions: ["read", "write", "configure", "delete"],
};
const baseTime = new Date("2026-09-14T12:00:00Z");
const later = (hours: number) => new Date(baseTime.getTime() + hours * 3_600_000);
function fixture() {
  const data = createInitialData();
  const unitId = data.tables["equipes"]![0]!.id;
  data.tables["consultores"]!.push({
    id: "consultant",
    nome: "Consultor de teste",
    equipe_id: unitId,
    ativo: true,
  });
  data.tables["canais"]!.push({ id: "channel", nome: "Site", ativo: true });
  data.catalogs.push({
    id: "reason",
    kind: "reason",
    name: "Desistência",
    unitId: "",
    active: true,
    definitive: false,
  });
  data.tables["motivos_perda"]!.push({ id: "reason", nome: "Desistência", ativo: true });
  return data;
}
function proposal(data = fixture()) {
  return execute(
    data,
    {
      type: "create",
      values: {
        unitId: data.tables["equipes"]![0]!.id,
        consultor_id: "consultant",
        canal_id: "channel",
        imovel: "18592",
        valor_original: 3200,
        valor_proposta: 3000,
        percentual_intermediacao: 50,
        data_primeiro_contato: "2026-09-01",
        data_entrada_crm: "2026-09-03",
        data_visita: "2026-09-12",
      },
      people: [
        { ...emptyPerson(), name: "Cliente de teste", cpf: "52998224725", phone: "47999990000" },
      ],
    },
    actor,
    baseTime,
  );
}
function command(
  data: AppData,
  input: Omit<Extract<Command, { cardId: string }>, "cardId"> | Record<string, unknown>,
  hours = 1,
) {
  return execute(data, { ...input, cardId: data.cards[0]!.id } as Command, actor, later(hours));
}
const move = (data: AppData, destination: Stage, hours = 1) =>
  command(
    data,
    { type: "move", destination, explanation: "Parecer operacional de teste", reasonId: "reason" },
    hours,
  );
const signed = () =>
  move(move(move(proposal(), "fechamento_enviado"), "aprovado", 2), "entrega_chaves", 3);

describe("workflow e marcos permanentes", () => {
  it("possui exatamente nove etapas e nasce em proposta com uma ocorrência", () => {
    const data = proposal();
    expect(STAGES).toHaveLength(9);
    expect(data.cards[0]!.listId).toBe("proposta");
    expect(data.activities.filter((e) => e.type === "milestone.proposal")).toHaveLength(1);
    expect(calcularIndicadores(projectJornadas(data))).toMatchObject({
      propostas: 1,
      fechamentos: 0,
      contratos: 0,
    });
  });
  it("não permite editar etapa, IDs, flags ou datas de marcos pelo formulário", () => {
    for (const key of [
      "listId",
      "id",
      "atingiu_fechamento",
      "data_assinatura",
      "data_proposta",
      "deletedAt",
    ])
      expect(() => command(proposal(), { type: "edit", values: { [key]: "x" } })).toThrow(
        "protegido",
      );
  });
  it("cancelamento na proposta é definitivo e continua sendo proposta comercial", () => {
    const data = move(proposal(), "cancelado");
    expect(canRecover(data.cards[0]!, later(2))).toBe(false);
    expect(data.cards[0]!.definitiveLoss).toBe(true);
    expect(calcularIndicadores(projectJornadas(data))).toMatchObject({
      propostas: 1,
      fechamentos: 0,
      perdidos: 1,
    });
    expect(() => command(data, { type: "recover", explanation: "Mudou" }, 2)).toThrow("não pode");
  });
  it("recupera o mesmo ID antes do limite e não duplica marcos", () => {
    const start = proposal();
    let data = move(start, "fechamento_enviado");
    data = move(data, "cancelado", 2);
    expect(canRecover(data.cards[0]!, later(13.999))).toBe(true);
    data = command(data, { type: "recover", explanation: "Garantia alterada" }, 3);
    expect(data.cards[0]).toMatchObject({
      id: start.cards[0]!.id,
      listId: "fechamento_enviado",
      recovered: true,
      data_fechamento: later(1).toISOString(),
    });
    expect(slaState(data, data.cards[0]!, later(3).getTime()).stage).toBe(later(15).toISOString());
    expect(data.activities.filter((e) => e.type === "milestone.closing")).toHaveLength(1);
    expect(data.activities.some((e) => e.type === "card.cancelled")).toBe(true);
  });
  it("fecha a recuperação exatamente em 12 horas, inclusive sem tick prévio", () => {
    const data = move(move(proposal(), "fechamento_enviado"), "cancelado", 2);
    expect(canRecover(data.cards[0]!, later(14))).toBe(false);
    expect(() => command(data, { type: "recover", explanation: "Alteração" }, 14)).toThrow();
    const expired = execute(data, { type: "tick" }, actor, later(15));
    expect(expired.cards[0]!.definitiveLoss).toBe(true);
    expect(expired.activities.filter((e) => e.type === "recovery.expired")).toHaveLength(1);
    expect(execute(expired, { type: "tick" }, actor, later(16))).toBe(expired);
  });
  it("não deixa pendência avançar diretamente para aprovado", () => {
    let data = move(move(proposal(), "fechamento_enviado"), "pendencia", 2);
    expect(data.notifications).toHaveLength(2);
    expect(() => move(data, "aprovado", 3)).toThrow("Transição não permitida");
    data = move(data, "fechamento_enviado", 3);
    expect(data.cards[0]!.data_fechamento).toBe(later(1).toISOString());
    expect(slaState(data, data.cards[0]!).stage).toBe(later(15).toISOString());
  });
  it("exige descrição da pendência, motivo da perda e parecer da Direção", () => {
    const data = move(proposal(), "fechamento_enviado");
    for (const destination of ["pendencia", "direcao", "cancelado", "reprovado"])
      expect(() =>
        command(data, { type: "move", destination, explanation: "", reasonId: "reason" }),
      ).toThrow();
    expect(() =>
      command(data, {
        type: "move",
        destination: "cancelado",
        explanation: "Descrição",
        reasonId: "",
      }),
    ).toThrow("motivo");
    const direction = move(data, "direcao");
    expect(() =>
      command(direction, { type: "move", destination: "aprovado", explanation: "", reasonId: "" }),
    ).toThrow();
  });
  it("trata motivos judiciais como definitivos somente na reprovação configurada", () => {
    const data = move(proposal(), "fechamento_enviado");
    data.catalogs[0]!.definitive = false;
    const reason = data.catalogs.find((c) => c.id === "reason")!;
    reason.definitive = true;
    const rejected = move(data, "reprovado");
    expect(canRecover(rejected.cards[0]!, later(2))).toBe(false);
    expect(canRecover(move(data, "cancelado").cards[0]!, later(2))).toBe(true);
  });
  it("cancelamento e recuperação depois da assinatura mantêm contrato, fechamento e valores", () => {
    let data = signed();
    data = command(
      data,
      { type: "edit", values: { valor_atualizado: 3100, valor_final: 3300 } },
      4,
    );
    data = move(data, "cancelado", 5);
    expect(calcularIndicadores(projectJornadas(data))).toMatchObject({
      propostas: 1,
      fechamentos: 1,
      contratos: 1,
      vglAssinado: 3300,
      vglTotal: 3300,
      ticketMedio: 3300,
      intermediacao: 1650,
      perdidos: 1,
    });
    data = command(data, { type: "recover", explanation: "Troca de imóvel" }, 6);
    data = move(move(data, "aprovado", 7), "entrega_chaves", 8);
    expect(data.activities.filter((e) => e.type === "milestone.signed")).toHaveLength(1);
    expect(data.cards[0]!.data_assinatura).toBe(later(3).toISOString());
  });
  it("agenda SLA dinâmico, confirma entrega e encerra prazo operacional", () => {
    let data = signed();
    expect(slaState(data, data.cards[0]!).stage).toBe(later(15).toISOString());
    expect(() => move(data, "concluido", 4)).toThrow("entrega efetiva");
    data = command(data, { type: "schedule", appointment: later(80).toISOString() }, 4);
    expect(slaState(data, data.cards[0]!).stage).toBe(later(80).toISOString());
    data = command(data, { type: "deliver" }, 80);
    data = move(data, "concluido", 80);
    expect(slaState(data, data.cards[0]!)).toMatchObject({ stage: null, task: null });
    expect(() => move(data, "proposta", 90)).toThrow();
  });
  it("recuperação exige uma nova entrega operacional e preserva a assinatura e entregas anteriores", () => {
    let data = command(signed(), { type: "schedule", appointment: later(6).toISOString() }, 4);
    data = command(data, { type: "deliver" }, 6);
    expect(() =>
      command(data, { type: "schedule", appointment: later(10).toISOString() }, 7),
    ).toThrow("confirmada");
    data = move(data, "cancelado", 7);
    data = command(data, { type: "recover", explanation: "Nova negociação" }, 8);
    data = move(move(data, "aprovado", 9), "entrega_chaves", 10);
    expect(data.cards[0]).toMatchObject({
      data_assinatura: later(3).toISOString(),
      keyAppointment: null,
      keyDeliveredAt: null,
    });
    expect(data.activities.filter((event) => event.type === "keys.delivered")).toHaveLength(1);
    expect(() => move(data, "concluido", 11)).toThrow("entrega efetiva");
  });
});

describe("gates, tarefas e dados relacionados", () => {
  function withTasks() {
    const data = fixture();
    data.tasks = [1, 2, 3].map((n) => ({
      id: `task-${n}`,
      name: `Tarefa ${n}`,
      stage: "proposta",
      slaHours: 1,
      position: n * 1024,
      active: true,
      required: true,
    }));
    return proposal(data);
  }
  it("inicia a primeira tarefa na criação e impede pular sequência ou avançar incompleto", () => {
    let data = withTasks();
    expect(activeTask(data, data.cards[0]!)?.taskId).toBe("task-1");
    expect(() => command(data, { type: "task", taskId: "task-3" })).toThrow("sem pular");
    expect(() => move(data, "fechamento_enviado")).toThrow("Tarefa");
    data = command(data, { type: "task", taskId: null });
    expect(activeTask(data, data.cards[0]!)?.taskId).toBe("task-2");
    data = command(command(data, { type: "task", taskId: null }), { type: "task", taskId: null });
    expect(activeTask(data, data.cards[0]!)).toBeUndefined();
    expect(move(data, "fechamento_enviado").cards[0]!.atingiu_fechamento).toBe(true);
  });
  it("retornar tarefa cria execução e SLA novos preservando o atraso anterior", () => {
    let data = withTasks();
    expect(slaState(data, data.cards[0]!, later(1.1).getTime()).taskOverdue).toBe(true);
    data = command(data, { type: "task", taskId: null }, 2);
    data = command(data, { type: "task", taskId: "task-1" }, 2.1);
    const runs = data.taskExecutions.filter((t) => t.taskId === "task-1");
    expect(runs).toHaveLength(2);
    expect(runs[0]!.outcome).toBe("completed");
    expect(runs[1]!.endedAt).toBeNull();
    expect(slaState(data, data.cards[0]!, later(2.2).getTime()).taskOverdue).toBe(false);
    expect(data.taskExecutions.filter((t) => !t.endedAt)).toHaveLength(1);
  });
  it("alterar a definição de tarefa não muda SLA, nome ou histórico da execução", () => {
    let data = withTasks();
    data = execute(
      data,
      { type: "task_config", task: { ...data.tasks[0]!, name: "Renomeada", slaHours: 12 } },
      actor,
      later(1),
    );
    expect(activeTask(data, data.cards[0]!)).toMatchObject({ name: "Tarefa 1", slaHours: 1 });
  });
  it("alterar a ordem ou desativar definições não pula, reinicia nem dispensa tarefas da etapa em andamento", () => {
    let data = withTasks();
    data = execute(
      data,
      {
        type: "task_config",
        task: { ...data.tasks[0]!, position: 9000, active: false, required: false },
      },
      actor,
      later(1),
    );
    data = execute(
      data,
      {
        type: "task_config",
        task: {
          ...data.tasks[1]!,
          name: "Nova definição",
          position: 9001,
          slaHours: 20,
          required: false,
        },
      },
      actor,
      later(1),
    );
    expect(taskSequence(data, data.cards[0]!).map((task) => task.id)).toEqual([
      "task-1",
      "task-2",
      "task-3",
    ]);
    data = command(data, { type: "task", taskId: null }, 2);
    expect(activeTask(data, data.cards[0]!)).toMatchObject({
      taskId: "task-2",
      name: "Tarefa 2",
      slaHours: 1,
      required: true,
    });
    expect(() => move(data, "fechamento_enviado", 3)).toThrow("Tarefa 2");
    data = command(
      command(data, { type: "task", taskId: null }, 3),
      { type: "task", taskId: null },
      4,
    );
    expect(move(data, "fechamento_enviado", 5).cards[0]!.atingiu_fechamento).toBe(true);
  });
  it("resolve posições iguais pela identidade e conclui a sequência inteira", () => {
    const initial = fixture();
    initial.tasks = [3, 1, 2].map((n) => ({
      id: `task-${n}`,
      stage: "proposta",
      name: `Tarefa ${n}`,
      position: 1024,
      slaHours: 1,
      active: true,
      required: true,
    }));
    let data = proposal(initial);
    for (const taskId of ["task-1", "task-2", "task-3"]) {
      expect(activeTask(data, data.cards[0]!)?.taskId).toBe(taskId);
      data = command(data, { type: "task", taskId: null });
    }
    expect(move(data, "fechamento_enviado").cards[0]!.atingiu_fechamento).toBe(true);
  });
  it("retrabalho invalida a conclusão posterior sem apagar seu histórico", () => {
    const initial = fixture();
    initial.tasks = [1, 2, 3].map((n) => ({
      id: `task-${n}`,
      stage: "proposta",
      name: `Tarefa ${n}`,
      position: n,
      slaHours: 1,
      active: true,
      required: n === 3,
    }));
    let data = proposal(initial);
    for (let index = 0; index < 3; index++)
      data = command(data, { type: "task", taskId: null }, index + 1);
    expect(isTaskCompleted(data, data.cards[0]!, "task-3")).toBe(true);
    data = command(data, { type: "task", taskId: "task-1" }, 4);
    data = command(data, { type: "task", taskId: null }, 5);
    expect(isTaskCompleted(data, data.cards[0]!, "task-3")).toBe(false);
    expect(data.taskExecutions.find((task) => task.taskId === "task-3")!.outcome).toBe("completed");
    expect(() => move(data, "fechamento_enviado", 6)).toThrow("Tarefa 3");
    data = command(
      command(data, { type: "task", taskId: null }, 6),
      { type: "task", taskId: null },
      7,
    );
    expect(move(data, "fechamento_enviado", 8).cards[0]!.atingiu_fechamento).toBe(true);
  });
  it("auditoria de início e configuração conserva os valores no instante de cada evento", () => {
    let data = withTasks();
    const start = data.activities.find((event) => event.type === "task.started")!;
    const snapshot = structuredClone(start);
    data = command(data, { type: "task", taskId: null }, 2);
    expect(data.activities.find((event) => event.id === start.id)).toEqual(snapshot);
    const task = { ...data.tasks[0]!, id: "new-task", name: "Nome original" };
    data = execute(data, { type: "task_config", task }, actor, later(3));
    const configured = structuredClone(data.activities.at(-1)!);
    data = execute(
      data,
      { type: "task_config", task: { ...task, name: "Nome alterado" } },
      actor,
      later(4),
    );
    expect(data.activities.find((event) => event.id === configured.id)).toEqual(configured);
  });
  it("uma nova entrada de etapa adota a configuração atual preservando a sequência anterior", () => {
    const initial = fixture();
    initial.tasks = [
      {
        id: "closing-task",
        stage: "fechamento_enviado",
        name: "Conferência",
        position: 1,
        slaHours: 1,
        active: true,
        required: false,
      },
    ];
    let data = move(proposal(initial), "fechamento_enviado");
    const firstRun = data.cards[0]!.stageRunId;
    data = move(data, "cancelado", 2);
    data = execute(
      data,
      { type: "task_config", task: { ...data.tasks[0]!, name: "Nova conferência", slaHours: 4 } },
      actor,
      later(3),
    );
    data = command(data, { type: "recover", explanation: "Dados corrigidos" }, 4);
    expect(activeTask(data, data.cards[0]!)).toMatchObject({
      name: "Nova conferência",
      slaHours: 4,
    });
    expect(data.stageRuns.find((run) => run.id === firstRun)!.tasks![0]).toMatchObject({
      name: "Conferência",
      slaHours: 1,
    });
  });
  it("exige valores configurados, preserva zero preenchido e exige confirmação real do contrato", () => {
    let data = proposal();
    const percent = data.fields.find((f) => f.id === "administrationPercentage")!;
    percent.requiredAt = ["fechamento_enviado"];
    expect(() => move(data, "fechamento_enviado")).toThrow("administração");
    data = command(data, { type: "edit", values: { administrationPercentage: 0 } });
    data = move(move(data, "fechamento_enviado"), "aprovado");
    data.fields.find((f) => f.id === "contractCreated")!.requiredAt = ["entrega_chaves"];
    data = command(data, { type: "edit", values: { contractCreated: false } });
    expect(() => move(data, "entrega_chaves")).toThrow("Contrato criado");
    data = command(data, { type: "edit", values: { contractCreated: true } });
    expect(move(data, "entrega_chaves").cards[0]!.atingiu_contrato).toBe(true);
  });
  it("não confunde um valor apagado com zero preenchido e rejeita tipos inválidos", () => {
    let data = proposal();
    data.fields.find((field) => field.id === "percentual_intermediacao")!.requiredAt = [
      "fechamento_enviado",
    ];
    data = command(data, { type: "edit", values: { percentual_intermediacao: 0 } });
    expect(transitionGaps(data, data.cards[0]!, "fechamento_enviado")).toEqual([]);
    data = command(data, {
      type: "edit",
      values: { percentual_intermediacao: null, telefone: null },
    });
    expect(transitionGaps(data, data.cards[0]!, "fechamento_enviado")).toContain(
      "% de intermediação",
    );
    expect(data.cards[0]!.telefone).toBe("");
    for (const values of [{ imovel: false }, { cpf: "sem documento" }, { valor_final: true }])
      expect(() => command(data, { type: "edit", values })).toThrow();
  });
  it("valida campos personalizados enviados na criação e por pessoa", () => {
    const data = fixture();
    data.fields.push({
      id: "custom-number",
      name: "Número",
      type: "number",
      section: "geral",
      native: false,
      active: true,
      requiredAt: [],
      options: [],
    });
    const person = { ...emptyPerson(), name: "Cliente" };
    expect(() =>
      execute(
        data,
        { type: "create", values: {}, people: [person], custom: { "custom-number": "inválido" } },
        actor,
        baseTime,
      ),
    ).toThrow("número válido");
    expect(() =>
      execute(
        data,
        { type: "create", values: {}, people: [{ ...person, custom: { "custom-number": 1 } }] },
        actor,
        baseTime,
      ),
    ).toThrow("incompatível");
    expect(() =>
      execute(
        data,
        { type: "create", values: {}, people: [person], custom: { unknown: 1 } },
        actor,
        baseTime,
      ),
    ).toThrow("incompatível");
  });
  it("valida documentos individualmente por pessoa e preserva remoções", () => {
    let data = proposal();
    const second = { ...emptyPerson(), name: "Segundo locatário", cpf: "" };
    data = command(data, {
      type: "people",
      people: [...data.people.map(({ cardId: _id, ...p }) => p), second],
    });
    data.documents.push({
      id: "doc",
      name: "Documento de identificação",
      entity: "locatario",
      active: true,
      requiredAt: ["fechamento_enviado"],
    });
    expect(transitionGaps(data, data.cards[0]!, "fechamento_enviado")).toHaveLength(2);
    const attach = (personId: string) => ({
      type: "attach",
      attachment: {
        personId,
        documentId: "doc",
        fieldId: null,
        filename: "teste.txt",
        mimeType: "text/plain",
        size: 1,
        storagePath: "local/test",
        url: "data:application/octet-stream;base64,YQ==",
      },
    });
    data = command(data, attach(data.people[0]!.id));
    expect(transitionGaps(data, data.cards[0]!, "fechamento_enviado")).toHaveLength(1);
    data = command(data, attach(second.id));
    expect(transitionGaps(data, data.cards[0]!, "fechamento_enviado")).toHaveLength(0);
    data = command(data, { type: "remove_attachment", attachmentId: data.attachments[0]!.id });
    expect(data.attachments).toHaveLength(2);
    expect(transitionGaps(data, data.cards[0]!, "fechamento_enviado")).toHaveLength(1);
  });
  it("não aceita documentos de fiador atribuídos ao locatário ou ao processo", () => {
    const data = proposal();
    data.documents.push({
      id: "guarantor-document",
      name: "Renda do fiador",
      entity: "fiador",
      active: true,
      requiredAt: [],
    });
    for (const personId of [null, data.people[0]!.id])
      expect(() =>
        command(data, {
          type: "attach",
          attachment: {
            personId,
            documentId: "guarantor-document",
            fieldId: null,
            filename: "renda.txt",
            mimeType: "text/plain",
            size: 1,
            storagePath: "local/test",
            url: "data:application/octet-stream;base64,YQ==",
          },
        }),
      ).toThrow("incompatível");
  });
  it("comentários são append-only e análise é um registro separado", () => {
    let data = proposal();
    data = command(data, { type: "comment", body: "Primeiro" });
    data = command(data, { type: "comment", body: "Segundo" });
    data = command(data, {
      type: "analysis",
      analysis: {
        opinion: "Parecer",
        result: "Em análise",
        reviewed: "Renda",
        reasonId: "",
        explanation: "",
      },
    });
    expect(data.comments.map((c) => c.body)).toEqual(["Primeiro", "Segundo"]);
    expect(data.cards[0]!.analysis.opinion).toBe("Parecer");
    expect(data.activities.some((e) => e.field === "analise.opinion")).toBe(true);
  });
  it("soft delete exige capacidade externa e justificativa, preservando todo histórico", () => {
    const data = proposal();
    const input: Command = { type: "delete", cardId: data.cards[0]!.id, explanation: "Card Teste" };
    expect(() => execute(data, input, { ...actor, permissions: ["read", "write"] })).toThrow(
      "não autorizou",
    );
    expect(() => command(data, { type: "delete", explanation: "" })).toThrow();
    const removed = execute(data, input, actor);
    expect(removed.cards).toHaveLength(1);
    expect(removed.people).toHaveLength(1);
    expect(projectJornadas(removed)).toHaveLength(0);
    expect(removed.activities.at(-1)!.type).toBe("card.deleted");
  });
  it("falhas de validação não alteram o objeto original", () => {
    const data = proposal();
    const snapshot = JSON.stringify(data);
    expect(() => command(data, { type: "edit", values: { valor_final: -1 } })).toThrow();
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});

describe("regressão comercial e migração", () => {
  it("combina registros diários com marcos do fechamento", () => {
    const data = signed();
    const registros = [
      {
        id: "r",
        data: "2026-09-14",
        consultor_id: "consultant",
        leads: 10,
        atendimentos: 8,
        agendamentos: 6,
        visitas: 4,
        created_at: "",
        updated_at: "",
      },
    ];
    expect(
      funilCompleto(projectJornadas(data), registros, [
        { id: "p", data: "2026-09-14", quantidade: 20 },
      ]).map((e) => e.valor),
    ).toEqual([20, 10, 8, 6, 4, 1, 1, 1]);
  });
  it("preserva conversão por canal, valores prioritários, metas e rankings após cancelamento", () => {
    const data = move(signed(), "cancelado", 4);
    const journeys = projectJornadas(data);
    expect(
      conversaoPorCanal(journeys, [{ id: "channel", nome: "Site", ativo: true }])[0],
    ).toMatchObject({ propostas: 1, contratos: 1, conversao: 100, vgl: 3000 });
    const unit = data.tables["equipes"]![0]!.id;
    const consultants = [{ id: "consultant", nome: "Consultor", equipe_id: unit, ativo: true }];
    const teams = [{ id: unit, nome: "Unidade" }];
    const metas = [
      {
        id: "meta",
        ciclo_id: "cycle",
        equipe_id: unit,
        consultor_id: null,
        meta_vgl: 6000,
        meta_contratos: 2,
      },
    ];
    expect(rankingEquipes(journeys, [], consultants, teams, metas, "cycle")[0]).toMatchObject({
      pctMetaVgl: 50,
      pctMetaContratos: 50,
      contratos: 1,
    });
    expect(rankingConsultores(journeys, [], consultants, teams, [], "cycle")[0]).toMatchObject({
      propostas: 1,
      fechamentos: 1,
      contratos: 1,
      vgl: 3000,
    });
    expect(
      aplicarFiltros(journeys, { ...filtrosVazios, consultorId: "other" }, consultants, []),
    ).toHaveLength(0);
  });
  it("cancelar e recuperar em outro período não desloca o contrato do ciclo da primeira assinatura", () => {
    let data = move(signed(), "cancelado", 48);
    const filters = { ...filtrosVazios, de: "2026-09-14", ate: "2026-09-14" };
    expect(dataDeCompetencia(projectJornadas(data)[0]!)).toBe(later(3).toISOString());
    expect(
      calcularIndicadores(aplicarFiltros(projectJornadas(data), filters, [], [])).contratos,
    ).toBe(1);
    expect(
      aplicarFiltros(
        projectJornadas(data),
        { ...filters, de: "2026-09-16", ate: "2026-09-16" },
        [],
        [],
      ),
    ).toHaveLength(0);
    data = command(data, { type: "recover", explanation: "Reabertura" }, 49);
    expect(
      calcularIndicadores(aplicarFiltros(projectJornadas(data), filters, [], [])).contratos,
    ).toBe(1);
  });
  it("importa jornadas preservando IDs, todos os valores e marcos mesmo em perda", () => {
    const original = projectJornadas(move(signed(), "cancelado", 4))[0]!;
    const data = importData(fixture(), { jornadas: [original] }, actor);
    const imported = data.cards[0]!;
    expect(imported).toMatchObject({
      id: original.id,
      valor_original: 3200,
      valor_proposta: 3000,
      data_fechamento: original.data_fechamento,
      data_assinatura: original.data_assinatura,
      atingiu_fechamento: true,
      atingiu_contrato: true,
      listId: "cancelado",
    });
    expect(calcularIndicadores(projectJornadas(data)).contratos).toBe(1);
    expect(() => importData(data, { jornadas: [original] }, actor)).toThrow("já existe");
  });
});
