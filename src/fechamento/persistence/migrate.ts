import { z } from "zod";
import { emptyPerson, requireCapability } from "../domain/operations";
import {
  createInitialData,
  NATIVE_FIELDS,
  STAGES,
  type AppData,
  type Actor,
  type Card,
  type Row,
  type StageRun,
} from "../domain/types";
import { validateSnapshot } from "./repository";
import { assertJsonData } from "./snapshot";

// O Comercial pode ter colunas adicionais. Elas pertencem ao registro original.
const legacySchema = z
  .object({
    id: z.string().min(1),
    cliente_nome: z.string().min(1),
    cpf: z.string(),
    telefone: z.string(),
    consultor_id: z.string(),
    canal_id: z.string(),
    data_primeiro_contato: z.string(),
    data_entrada_crm: z.string(),
    data_visita: z.string(),
    data_proposta: z.string(),
    imovel: z.string(),
    valor_original: z.number().finite(),
    valor_proposta: z.number().finite(),
    percentual_intermediacao: z.number().finite(),
    etapa: z.enum(["proposta", "fechamento", "contrato_assinado", "negocio_perdido"]),
    data_fechamento: z.string().nullable(),
    valor_atualizado: z.number().finite().nullable(),
    data_envio_contrato: z.string().nullable(),
    data_assinatura: z.string().nullable(),
    valor_final: z.number().finite().nullable(),
    motivo_perda_id: z.string().nullable(),
    descricao_perda: z.string().nullable(),
    data_perda: z.string().nullable().default(null),
    atingiu_fechamento: z.boolean().optional(),
    atingiu_contrato: z.boolean().optional(),
    motivo_reabertura: z.string().nullable().default(null),
    justificativa_nova_jornada: z.string().nullable().default(null),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

const rowSchema = z.object({ id: z.string().min(1) }).passthrough();
const commercialTables = new Set([...Object.keys(createInitialData().tables), "jornada_eventos"]);
const nativeFields = new Set(
  NATIVE_FIELDS.filter((field) => field.section === "geral").map((field) => field.id),
);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  if (!record(left) || !record(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => has(right, key) && equal(left[key], right[key]))
  );
}

function isLegacyClosing(value: Record<string, unknown>): boolean {
  return (
    [
      "lists",
      "columns",
      "boards",
      "boardMembers",
      "checklists",
      "checklistItems",
      "currentUserId",
    ].some((key) => has(value, key)) ||
    (has(value, "boardId") && has(value, "listId"))
  );
}

function rejectLegacyClosing(): never {
  throw new Error(
    "O Kanban antigo do Fechamento exige mapeamento explícito das colunas para as nove etapas V1 antes da migração. Nenhum dado foi importado.",
  );
}

function validDate(value: string, label: string, journeyId: string): string {
  if (!Number.isFinite(Date.parse(value)))
    throw new Error(`${label} inválida no processo ${journeyId}. Nenhum dado foi importado.`);
  return value;
}

export function importData(source: AppData, raw: unknown, actor: Actor): AppData {
  requireCapability(actor, "configure");
  if (!Array.isArray(raw) && !record(raw)) throw new Error("Arquivo de importação inválido.");
  assertJsonData(raw);

  if (record(raw) && isLegacyClosing(raw)) rejectLegacyClosing();
  if (record(raw) && has(raw, "schemaVersion")) {
    if (raw["schemaVersion"] !== 1)
      throw new Error("Versão de backup desconhecida ou incompatível. Nenhum dado foi importado.");
    const incoming = validateSnapshot(structuredClone(raw));
    if (!equal(source, createInitialData()))
      throw new Error(
        "Restaure backups somente em uma base inicial, sem alterações em processos, configurações ou equipes, para evitar sobrescrever trabalho existente.",
      );
    return validateSnapshot({ ...incoming, revision: source.revision + 1 });
  }

  let rawJourneys: unknown = raw;
  let rawTables: unknown = {};
  if (record(raw)) {
    if (
      (!has(raw, "jornadas") && !has(raw, "tables")) ||
      Object.keys(raw).some((key) => key !== "jornadas" && key !== "tables")
    ) {
      throw new Error(
        "Formato de backup desconhecido. Use uma exportação de jornadas do Comercial ou um backup completo V1.",
      );
    }
    rawJourneys = has(raw, "jornadas") ? raw["jornadas"] : [];
    rawTables = has(raw, "tables") ? raw["tables"] : {};
  }
  if (
    Array.isArray(rawJourneys) &&
    rawJourneys.some((value) => record(value) && isLegacyClosing(value))
  )
    rejectLegacyClosing();
  const parsed = z.array(legacySchema).safeParse(rawJourneys);
  if (!parsed.success)
    throw new Error(
      "Exportação de jornadas inválida. Verifique os identificadores e os campos comerciais. Nenhum dado foi importado.",
    );
  if (!record(rawTables))
    throw new Error("As tabelas comerciais devem ser um objeto com listas de registros.");

  // Todas as alterações ocorrem em cópias; falhas não alteram a origem nem o arquivo.
  const data = structuredClone(validateSnapshot(source));
  const journeys = structuredClone(parsed.data);
  for (const [table, inputRows] of Object.entries(rawTables)) {
    if (!commercialTables.has(table))
      throw new Error(`Tabela de importação desconhecida: ${table}. Nenhum dado foi importado.`);
    const rows = z.array(rowSchema).safeParse(inputRows);
    if (!rows.success)
      throw new Error(
        `Registros inválidos na tabela ${table}. Cada registro deve ter um identificador.`,
      );
    const destination = (data.tables[table] ??= []);
    for (const row of structuredClone(rows.data)) {
      const existing = destination.find((value) => value.id === row.id);
      if (existing && !equal(existing, row))
        throw new Error(`Conflito no cadastro ${table}: ${row.id}. Nenhum dado foi importado.`);
      if (!existing) destination.push(row as Row);
    }
  }

  for (const legacy of journeys) {
    if (data.cards.some((card) => card.id === legacy.id))
      throw new Error(`O processo ${legacy.id} já existe. Nenhum dado foi importado.`);
    validDate(legacy.created_at, "Data de criação", legacy.id);
    validDate(legacy.updated_at, "Data de atualização", legacy.id);
    validDate(legacy.data_proposta, "Data da proposta", legacy.id);
    const closing = legacy.atingiu_fechamento ?? !!legacy.data_fechamento;
    const signed = legacy.atingiu_contrato ?? !!legacy.data_assinatura;
    if (legacy.etapa === "fechamento" && !closing)
      throw new Error(`Informe o marco de Fechamento do processo ${legacy.id} antes de migrar.`);
    if (legacy.etapa === "contrato_assinado" && !signed)
      throw new Error(`Informe o marco de assinatura do processo ${legacy.id} antes de migrar.`);
    const listId =
      legacy.etapa === "negocio_perdido"
        ? "cancelado"
        : legacy.etapa === "contrato_assinado"
          ? "entrega_chaves"
          : legacy.etapa === "fechamento"
            ? "fechamento_enviado"
            : "proposta";
    const consultant = data.tables["consultores"]?.find((row) => row.id === legacy.consultor_id);
    const card: Card = {
      unitId: String(consultant?.["equipe_id"] ?? ""),
      captorId: "",
      supervisorId: "",
      closingOwnerId: "",
      leaseType: "",
      propertyTypeId: "",
      captureOriginId: "",
      guaranteeId: "",
      guaranteeDetails: "",
      address: "",
      condominium: null,
      iptu: null,
      garbageFee: null,
      administrationPercentage: null,
      context: "",
      contractCreated: null,
      custom: {},
      analysis: { opinion: "", result: "", reviewed: "", reasonId: "", explanation: "" },
      providedFields: Object.keys(legacy).filter((key) => nativeFields.has(key)),
      position:
        Math.max(
          0,
          ...data.cards.filter((value) => value.listId === listId).map((value) => value.position),
        ) + 1024,
      keyAppointment: null,
      keyDeliveredAt: null,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      version: 1,
      ...legacy,
      atingiu_fechamento: closing,
      atingiu_contrato: signed,
      listId,
      stageRunId: crypto.randomUUID(),
      enteredListAt: legacy.updated_at,
      definitiveLoss: legacy.etapa === "negocio_perdido",
      recoveryDeadline: null,
      recovered: Boolean(legacy.motivo_reabertura),
    };
    data.cards.push(card);
    data.people.push({
      ...emptyPerson(),
      cardId: card.id,
      name: legacy.cliente_nome,
      cpf: legacy.cpf,
      phone: legacy.telefone,
    });
    const hours = STAGES.find((stage) => stage.id === listId)!.slaHours;
    // As tarefas configuradas hoje não são exigências retroativas do legado.
    const run: StageRun & { tasks: [] } = {
      id: card.stageRunId,
      cardId: card.id,
      stage: listId,
      startedAt: card.enteredListAt,
      endedAt: null,
      dueAt:
        hours === null
          ? null
          : new Date(Date.parse(card.enteredListAt) + hours * 3_600_000).toISOString(),
      actorId: actor.id,
      tasks: [],
    };
    data.stageRuns.push(run);
    for (const [reached, at, type] of [
      [true, card.data_proposta, "milestone.proposal"],
      [closing, card.data_fechamento, "milestone.closing"],
      [signed, card.data_assinatura, "milestone.signed"],
    ] as const) {
      if (!reached) continue;
      if (!at)
        throw new Error(
          `Marco histórico sem data no processo ${card.id}. Nenhum dado foi importado.`,
        );
      validDate(at, "Data de marco histórico", card.id);
      data.activities.push({
        id: crypto.randomUUID(),
        cardId: card.id,
        actorId: actor.id,
        actorName: actor.name,
        type,
        message: "Marco histórico importado do Comercial",
        field: null,
        before: null,
        after: null,
        justification: "Migração V1 preservando o marco original",
        createdAt: at,
      });
    }
    data.activities.push({
      id: crypto.randomUUID(),
      cardId: card.id,
      actorId: actor.id,
      actorName: actor.name,
      type: "card.imported",
      message: "Jornada importada preservando ID e campos legados",
      field: null,
      before: null,
      after: structuredClone(legacy),
      justification: null,
      createdAt: new Date().toISOString(),
    });
  }
  data.revision = source.revision + 1;
  return validateSnapshot(data);
}
