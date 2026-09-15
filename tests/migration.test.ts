import { describe, expect, it } from "vitest";
import { importData } from "../src/fechamento/persistence/migrate";
import { validateSnapshot } from "../src/fechamento/persistence/repository";
import {
  createInitialData,
  type Actor,
  type AppData,
  type Row,
} from "../src/fechamento/domain/types";
import { projectJornadas } from "../src/fechamento/domain/operations";
import { calcularIndicadores } from "../src/lib/metrics";
import type { Jornada } from "../src/lib/data";

const actor: Actor = { id: "migration-operator", name: "Operador", permissions: ["configure"] };
function journey(overrides: Partial<Jornada> = {}) {
  return {
    id: "historic-journey",
    cliente_nome: "Cliente legado",
    cpf: "123",
    telefone: "47 99999-9999",
    consultor_id: "historic-consultant",
    canal_id: "historic-channel",
    data_primeiro_contato: "2025-02-01",
    data_entrada_crm: "2025-02-02",
    data_visita: "2025-02-03",
    data_proposta: "2025-02-04",
    imovel: "00125",
    valor_original: 3500,
    valor_proposta: 3000,
    percentual_intermediacao: 50,
    etapa: "negocio_perdido" as const,
    data_fechamento: "2025-02-05T10:00:00-03:00",
    valor_atualizado: 3100,
    data_envio_contrato: "2025-02-06",
    data_assinatura: "2025-02-07",
    valor_final: 3300,
    motivo_perda_id: "historic-reason",
    descricao_perda: "Desistência",
    data_perda: "2025-02-08",
    atingiu_fechamento: true,
    atingiu_contrato: true,
    motivo_reabertura: "Histórico de retorno",
    justificativa_nova_jornada: null,
    created_at: "2025-02-04T08:00:00-03:00",
    updated_at: "2025-02-08T17:00:00-03:00",
    ...overrides,
  };
}

describe("migração preserva os registros comerciais originais", () => {
  it("preserva campos adicionais, datas e marcos após perda sem aplicar CPF e cadastros novos", () => {
    const legacy = {
      ...journey(),
      observacoes: "Texto histórico",
      dados_adicionais: { etiquetas: ["antigo"], valor: 0 },
      percentual_intermediacao: 125,
    };
    const raw = { jornadas: [legacy] };
    const source = createInitialData();
    const originalSource = structuredClone(source);
    const originalRaw = structuredClone(raw);
    const result = importData(source, raw, actor);
    expect(result.cards[0]).toMatchObject(legacy);
    expect(result.cards[0]).toMatchObject({
      listId: "cancelado",
      definitiveLoss: true,
      recovered: true,
    });
    expect(result.people[0]).toMatchObject({
      cardId: legacy.id,
      name: legacy.cliente_nome,
      cpf: legacy.cpf,
      phone: legacy.telefone,
    });
    expect(
      result.activities
        .filter((activity) => activity.type.startsWith("milestone."))
        .map((activity) => [activity.type, activity.createdAt]),
    ).toEqual([
      ["milestone.proposal", legacy.data_proposta],
      ["milestone.closing", legacy.data_fechamento],
      ["milestone.signed", legacy.data_assinatura],
    ]);
    expect(calcularIndicadores(projectJornadas(result))).toEqual(calcularIndicadores([legacy]));
    expect(validateSnapshot(result)).toEqual(result);
    expect(source).toEqual(originalSource);
    expect(raw).toEqual(originalRaw);
    const extra = (result.cards[0] as unknown as Record<string, unknown>)["dados_adicionais"] as {
      etiquetas: string[];
    };
    extra.etiquetas.push("alterada depois");
    expect(raw).toEqual(originalRaw);
    expect(result.activities.find((activity) => activity.type === "card.imported")!.after).toEqual(
      legacy,
    );
  });

  it("preserva flags explícitas e só reconstitui flags ausentes a partir das datas", () => {
    const legacy = journey({ atingiu_fechamento: false, atingiu_contrato: false });
    const result = importData(createInitialData(), [legacy], actor);
    expect(result.cards[0]).toMatchObject({
      atingiu_fechamento: false,
      atingiu_contrato: false,
      data_fechamento: legacy.data_fechamento,
      data_assinatura: legacy.data_assinatura,
    });
    expect(calcularIndicadores(projectJornadas(result))).toEqual(calcularIndicadores([legacy]));
    const { atingiu_fechamento: _closing, atingiu_contrato: _signed, ...beforeFlags } = journey();
    const migrated = importData(createInitialData(), [beforeFlags], actor);
    expect(migrated.cards[0]).toMatchObject({ atingiu_fechamento: true, atingiu_contrato: true });
  });

  it("preserva todas as tabelas, inclusive eventos históricos e seus detalhes", () => {
    const team = createInitialData().tables["equipes"]![0]!;
    const tables: Record<string, Row[]> = {
      equipes: [{ nome: team["nome"], id: team.id }],
      consultores: [
        { id: "historic-consultant", nome: "Consultor", equipe_id: team.id, ativo: false },
      ],
      canais: [{ id: "historic-channel", nome: "Site", ativo: false }],
      motivos_perda: [{ id: "historic-reason", nome: "Desistência", ativo: true }],
      motivos_transferencia: [{ id: "transfer", nome: "Troca de unidade", ativo: true }],
      ciclos: [
        {
          id: "cycle",
          nome: "Fevereiro",
          data_inicio: "2025-02-01",
          data_fim: "2025-02-28",
          status: "encerrado",
          meta_vgl: 6000,
          meta_contratos: 2,
        },
      ],
      metas: [
        {
          id: "target",
          ciclo_id: "cycle",
          equipe_id: team.id,
          consultor_id: null,
          meta_vgl: 6000,
          meta_contratos: 2,
        },
      ],
      registros_diarios: [
        {
          id: "daily",
          data: "2025-02-04",
          consultor_id: "historic-consultant",
          leads: 10,
          atendimentos: 8,
          agendamentos: 6,
          visitas: 4,
          created_at: "2025-02-04",
          updated_at: "2025-02-04",
        },
      ],
      pre_leads_diarios: [{ id: "pre", data: "2025-02-04", quantidade: 20 }],
      auditoria: [
        {
          id: "audit",
          entidade: "jornadas",
          entidade_id: "historic-journey",
          referencia: "Cliente legado",
          acao: "atualizar",
          campo: "etapa",
          valor_anterior: "contrato_assinado",
          valor_novo: "negocio_perdido",
          justificativa: "Desistência",
          usuario: "Operador anterior",
          created_at: "2025-02-08",
        },
      ],
      jornada_eventos: [
        {
          id: "event",
          jornada_id: "historic-journey",
          tipo: "transferencia",
          etapa_anterior: "proposta",
          etapa_nova: "fechamento",
          justificativa: "Operação original",
          detalhes: { usuario: "Operador anterior", extra: [1, 2] },
          created_at: "2025-02-05T10:00:00-03:00",
        },
      ],
    };
    const raw = { jornadas: [journey()], tables };
    const original = structuredClone(raw);
    const result = importData(createInitialData(), raw, actor);
    for (const [table, rows] of Object.entries(tables))
      for (const row of rows) expect(result.tables[table]).toContainEqual(row);
    expect(result.cards[0]!.unitId).toBe(team.id);
    expect(result.tables["equipes"]).toHaveLength(2);
    (result.tables["jornada_eventos"]![0]!["detalhes"] as { extra: number[] }).extra.push(3);
    expect(raw).toEqual(original);
  });

  it("permite importação só de tabelas e não impõe configurações atuais retroativamente", () => {
    const source = createInitialData();
    source.fields[0]!.requiredAt = ["proposta"];
    source.documents.push({
      id: "document",
      name: "Documento novo",
      entity: "locatario",
      active: true,
      requiredAt: ["proposta"],
    });
    source.tasks.push({
      id: "task",
      name: "Tarefa nova",
      stage: "proposta",
      slaHours: 1,
      position: 1024,
      active: true,
      required: true,
    });
    const withTables = importData(
      source,
      { tables: { pre_leads_diarios: [{ id: "pre", data: "2025-02-01", quantidade: 20 }] } },
      actor,
    );
    const result = importData(
      withTables,
      [
        journey({
          etapa: "proposta",
          data_fechamento: null,
          data_assinatura: null,
          atingiu_fechamento: false,
          atingiu_contrato: false,
        }),
      ],
      actor,
    );
    expect(result.fields).toEqual(source.fields);
    expect(result.documents).toEqual(source.documents);
    expect(result.tasks).toEqual(source.tasks);
    expect(result.taskExecutions).toEqual([]);
    expect(result.stageRuns[0]).toMatchObject({ tasks: [] });
    expect(result.tables["pre_leads_diarios"]).toHaveLength(1);
  });
});

describe("migração é atômica e rejeita formatos sem conversão segura", () => {
  it.each([
    [
      "jornada repetida",
      (raw: { jornadas: ReturnType<typeof journey>[] }) => raw.jornadas.push(journey()),
    ],
    [
      "marco sem data",
      (raw: { jornadas: ReturnType<typeof journey>[] }) =>
        raw.jornadas.push(journey({ id: "second", data_assinatura: null })),
    ],
    [
      "data inválida",
      (raw: { jornadas: ReturnType<typeof journey>[] }) =>
        raw.jornadas.push(journey({ id: "second", updated_at: "inválida" })),
    ],
  ])("não altera source nem raw quando falha depois de importar registros: %s", (_name, change) => {
    const source = createInitialData();
    const raw = {
      jornadas: [journey()],
      tables: { canais: [{ id: "new-channel", nome: "Canal", ativo: true }] },
    };
    change(raw);
    const savedSource = structuredClone(source);
    const savedRaw = structuredClone(raw);
    expect(() => importData(source, raw, actor)).toThrow();
    expect(source).toEqual(savedSource);
    expect(raw).toEqual(savedRaw);
  });

  it("rejeita conflito em cadastro e não descarta registros desconhecidos", () => {
    const source = createInitialData();
    const saved = structuredClone(source);
    const team = source.tables["equipes"]![0]!;
    expect(() =>
      importData(
        source,
        { jornadas: [journey()], tables: { equipes: [{ ...team, nome: "Alterada" }] } },
        actor,
      ),
    ).toThrow("Conflito");
    expect(() =>
      importData(source, { jornadas: [journey()], tables: { desconhecida: [{ id: "x" }] } }, actor),
    ).toThrow("desconhecida");
    expect(() => importData(source, { jornadas: [], tables: { canais: [null] } }, actor)).toThrow(
      "identificador",
    );
    expect(source).toEqual(saved);
  });

  it.each([
    { schemaVersion: 4, lists: [], cards: [] },
    { lists: [], cards: [] },
    { schemaVersion: 1, columns: [] },
    { jornadas: [], boards: [] },
    [{ id: "old", boardId: "board", listId: "arbitrary" }],
  ])("exige mapeamento explícito para Kanban legado: %j", (raw) => {
    expect(() => importData(createInitialData(), raw, actor)).toThrow("mapeamento explícito");
  });

  it.each([{ schemaVersion: 99 }, {}, { cards: [] }, { jornadas: [], extraData: [1] }])(
    "rejeita backup desconhecido: %j",
    (raw) => {
      expect(() => importData(createInitialData(), raw, actor)).toThrow(/desconhecid/);
    },
  );

  it("exige identidade e capacidade de configuração", () => {
    expect(() => importData(createInitialData(), [], { ...actor, permissions: ["write"] })).toThrow(
      "autorizou",
    );
    expect(() => importData(createInitialData(), [], { ...actor, id: "" })).toThrow("autorizou");
  });
});

describe("restauração completa só substitui uma base realmente inicial", () => {
  it("restaura backup válido preservando conteúdo e isolando as referências", () => {
    const backup = importData(
      createInitialData(),
      [{ ...journey(), extra: { original: true } }],
      actor,
    );
    backup.revision = 50;
    const saved = structuredClone(backup);
    const source = createInitialData();
    const result = importData(source, backup, actor);
    expect(result).toEqual({ ...backup, revision: 1 });
    result.cards[0]!.cliente_nome = "Alterado depois";
    result.fields[0]!.name = "Outro nome";
    expect(backup).toEqual(saved);
    expect(source).toEqual(createInitialData());
  });

  it.each([
    [
      "equipe alterada",
      (data: AppData) => {
        data.tables["equipes"]![0]!["nome"] = "Alterada";
      },
    ],
    [
      "nova equipe",
      (data: AppData) => {
        data.tables["equipes"]!.push({ id: "extra", nome: "Extra" });
      },
    ],
    [
      "campo configurado",
      (data: AppData) => {
        data.fields[0]!.requiredAt = ["proposta"];
      },
    ],
    [
      "catálogo configurado",
      (data: AppData) => {
        data.catalogs[0]!.name = "Alterado";
      },
    ],
    [
      "documento configurado",
      (data: AppData) => {
        data.documents.push({
          id: "doc",
          name: "Documento",
          entity: "geral",
          active: true,
          requiredAt: [],
        });
      },
    ],
    [
      "revisão usada",
      (data: AppData) => {
        data.revision = 2;
      },
    ],
  ])("não sobrescreve %s mesmo sem processos", (_name, change) => {
    const source = createInitialData();
    change(source);
    const saved = structuredClone(source);
    expect(() => importData(source, createInitialData(), actor)).toThrow("base inicial");
    expect(source).toEqual(saved);
  });

  it("rejeita backup V1 estruturalmente corrompido antes de retornar", () => {
    const invalid = { ...createInitialData(), cards: [{ id: "incomplete" }] };
    expect(() => importData(createInitialData(), invalid, actor)).toThrow();
  });
});
