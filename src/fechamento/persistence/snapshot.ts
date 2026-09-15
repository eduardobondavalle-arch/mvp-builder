import { z } from "zod";
import { NATIVE_FIELDS, type AppData, type Row } from "../domain/types";

const id = z.string().trim().min(1);
const number = z.number().finite();
const count = number.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const stage = z.enum([
  "proposta",
  "fechamento_enviado",
  "aprovado",
  "entrega_chaves",
  "concluido",
  "pendencia",
  "direcao",
  "cancelado",
  "reprovado",
]);
const section = z.enum(["geral", "locatario", "fiador", "conjuge", "morador", "analise"]);
export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const date = z.string().refine(validDate, "Data inválida.");
const instant = z
  .string()
  .refine(
    (value) => validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)),
    "Data/hora inválida.",
  );
const optionalDate = z.union([z.literal(""), instant]);
const value = z.union([z.string(), number, z.boolean(), z.null()]);
const custom = z.record(value);
const row = z.object({ id }).passthrough();
const named = row.extend({ nome: z.string().min(1), ativo: z.boolean().optional() });
const task = z
  .object({
    id,
    stage,
    name: id,
    slaHours: number.positive(),
    position: number,
    active: z.boolean(),
    required: z.boolean(),
  })
  .passthrough();
const card = z
  .object({
    id,
    cliente_nome: z.string(),
    cpf: z.string(),
    telefone: z.string(),
    consultor_id: z.string(),
    canal_id: z.string(),
    data_primeiro_contato: optionalDate,
    data_entrada_crm: optionalDate,
    data_visita: optionalDate,
    data_proposta: instant,
    imovel: z.string(),
    valor_original: number,
    valor_proposta: number,
    percentual_intermediacao: number,
    etapa: z.enum(["proposta", "fechamento", "contrato_assinado", "negocio_perdido"]),
    data_fechamento: instant.nullable(),
    valor_atualizado: number.nullable(),
    data_envio_contrato: optionalDate.nullable(),
    data_assinatura: instant.nullable(),
    valor_final: number.nullable(),
    motivo_perda_id: z.string().nullable(),
    descricao_perda: z.string().nullable(),
    data_perda: instant.nullable(),
    atingiu_fechamento: z.boolean(),
    atingiu_contrato: z.boolean(),
    motivo_reabertura: z.string().nullable(),
    justificativa_nova_jornada: z.string().nullable(),
    created_at: instant,
    updated_at: instant,
    listId: stage,
    unitId: z.string(),
    captorId: z.string(),
    supervisorId: z.string(),
    closingOwnerId: z.string(),
    leaseType: z.string(),
    propertyTypeId: z.string(),
    captureOriginId: z.string(),
    guaranteeId: z.string(),
    guaranteeDetails: z.string(),
    address: z.string(),
    condominium: number.nullable(),
    iptu: number.nullable(),
    garbageFee: number.nullable(),
    administrationPercentage: number.nullable(),
    context: z.string(),
    contractCreated: z.boolean().nullable(),
    custom,
    providedFields: z.array(z.string()),
    analysis: z
      .object({
        opinion: z.string(),
        result: z.string(),
        reviewed: z.string(),
        reasonId: z.string(),
        explanation: z.string(),
      })
      .passthrough(),
    position: number,
    enteredListAt: instant,
    stageRunId: id,
    keyAppointment: instant.nullable(),
    keyDeliveredAt: instant.nullable(),
    recoveryDeadline: instant.nullable(),
    definitiveLoss: z.boolean(),
    recovered: z.boolean(),
    deletedAt: instant.nullable(),
    deletedBy: z.string().nullable(),
    deleteReason: z.string().nullable(),
    version: count.min(1),
  })
  .passthrough();
const schema = z
  .object({
    schemaVersion: z.literal(1),
    revision: count,
    cards: z.array(card),
    people: z.array(
      z
        .object({
          id,
          cardId: id,
          role: z.enum(["locatario", "fiador", "conjuge", "morador"]),
          relatedTo: z.string().nullable(),
          name: z.string(),
          cpf: z.string(),
          rg: z.string(),
          profession: z.string(),
          income: number.nullable(),
          maritalStatus: z.string(),
          phone: z.string(),
          custom,
          active: z.boolean(),
        })
        .passthrough(),
    ),
    catalogs: z.array(
      z
        .object({
          id,
          kind: id,
          name: id,
          unitId: z.string(),
          active: z.boolean(),
          definitive: z.boolean(),
        })
        .passthrough(),
    ),
    fields: z.array(
      z
        .object({
          id,
          name: id,
          type: z.enum([
            "text",
            "long_text",
            "number",
            "currency",
            "percentage",
            "date",
            "datetime",
            "boolean",
            "select",
            "phone",
            "attachment",
          ]),
          section,
          options: z.array(z.string()),
          native: z.boolean(),
          active: z.boolean(),
          requiredAt: z.array(stage),
        })
        .passthrough(),
    ),
    documents: z.array(
      z
        .object({ id, name: id, entity: section, active: z.boolean(), requiredAt: z.array(stage) })
        .passthrough(),
    ),
    tasks: z.array(task),
    stageRuns: z.array(
      z
        .object({
          id,
          cardId: id,
          stage,
          startedAt: instant,
          endedAt: instant.nullable(),
          dueAt: instant.nullable(),
          actorId: id,
          tasks: z.array(task).optional(),
        })
        .passthrough(),
    ),
    taskExecutions: z.array(
      z
        .object({
          id,
          cardId: id,
          stageRunId: id,
          taskId: id,
          name: id,
          position: number,
          slaHours: number.positive(),
          required: z.boolean(),
          actorId: id,
          startedAt: instant,
          endedAt: instant.nullable(),
          outcome: z.enum(["completed", "rework", "stage_exit"]).nullable(),
        })
        .passthrough(),
    ),
    comments: z.array(
      z
        .object({
          id,
          cardId: id,
          authorId: id,
          authorName: z.string(),
          body: z.string(),
          createdAt: instant,
        })
        .passthrough(),
    ),
    attachments: z.array(
      z
        .object({
          id,
          cardId: id,
          personId: z.string().nullable(),
          documentId: z.string(),
          fieldId: z.string().nullable(),
          filename: id,
          mimeType: z.string(),
          size: count,
          storagePath: z.string(),
          url: z.string().refine(
            (url) =>
              /^data:application\/octet-stream;base64,[A-Za-z0-9+/]*={0,2}$/.test(url) ||
              (() => {
                try {
                  return new URL(url).protocol === "https:";
                } catch {
                  return false;
                }
              })(),
            "Endereço de anexo inválido.",
          ),
          uploaderId: id,
          createdAt: instant,
          removedAt: instant.nullable(),
        })
        .passthrough(),
    ),
    activities: z.array(
      z
        .object({
          id,
          cardId: z.string(),
          actorId: id,
          actorName: z.string(),
          type: id,
          message: z.string(),
          field: z.string().nullable(),
          before: z.unknown(),
          after: z.unknown(),
          justification: z.string().nullable(),
          createdAt: instant,
        })
        .passthrough(),
    ),
    notifications: z.array(
      z
        .object({
          id,
          cardId: id,
          recipientId: z.string(),
          recipientKind: z.enum(["supervisao", "consultor"]),
          body: z.string(),
          createdAt: instant,
          readAt: instant.nullable(),
        })
        .passthrough(),
    ),
    tables: z.record(z.array(row)),
  })
  .passthrough();

// Preserve extensões JSON desconhecidas; recuse dados que JSON.stringify alteraria ou descartaria.
export function assertJsonData(input: unknown, seen = new Set<object>()): void {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "boolean" ||
    (typeof input === "number" && Number.isFinite(input))
  )
    return;
  if (!input || typeof input !== "object" || seen.has(input))
    throw new Error("Conteúdo inválido para armazenamento JSON.");
  const proto = Object.getPrototypeOf(input);
  if (!Array.isArray(input) && proto !== Object.prototype && proto !== null)
    throw new Error("Objeto de dados inválido.");
  if (Object.getOwnPropertySymbols(input).length)
    throw new Error("Campo de dados incompatível com JSON.");
  seen.add(input);
  for (const [key, nested] of Object.entries(input)) {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error(`Campo de dados inseguro: ${key}.`);
    assertJsonData(nested, seen);
  }
  if (Array.isArray(input) && Object.keys(input).length !== input.length)
    throw new Error("Lista de dados inválida.");
  seen.delete(input);
}

const commercialSchemas: Record<string, z.ZodTypeAny> = {
  equipes: named,
  consultores: named.extend({ equipe_id: z.string().nullable().optional() }),
  canais: named,
  motivos_perda: named,
  motivos_transferencia: named,
  ciclos: named
    .extend({
      data_inicio: date,
      data_fim: date,
      status: z.string(),
      meta_vgl: number.nonnegative(),
      meta_contratos: count,
    })
    .refine((row) => row.data_fim >= row.data_inicio, "Período do ciclo inválido."),
  metas: row.extend({
    ciclo_id: id,
    equipe_id: z.string().nullable(),
    consultor_id: z.string().nullable(),
    meta_vgl: number.nonnegative(),
    meta_contratos: count,
  }),
  registros_diarios: row.extend({
    data: date,
    consultor_id: id,
    leads: count,
    atendimentos: count,
    agendamentos: count,
    visitas: count,
  }),
  pre_leads_diarios: row.extend({ data: date, quantidade: count }),
  auditoria: row.extend({ entidade: id, acao: id, usuario: z.string(), created_at: instant }),
  jornada_eventos: row.extend({
    jornada_id: id,
    tipo: id,
    detalhes: z.record(z.unknown()),
    created_at: instant,
  }),
};

export function validateCommercialRow(table: string, input: Row) {
  (commercialSchemas[table] ?? row).parse(input);
  for (const key of ["created_at", "updated_at"])
    if (input[key] !== undefined) instant.parse(input[key]);
}
function unique(rows: { id: string }[], label: string) {
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new Error(`Identificadores duplicados em ${label}.`);
}
function uniqueCommercialRows(table: string, rows: Row[]) {
  const keys =
    table === "registros_diarios"
      ? ["consultor_id", "data"]
      : table === "pre_leads_diarios"
        ? ["data"]
        : ["equipes", "canais", "motivos_perda"].includes(table)
          ? ["nome"]
          : [];
  const values = keys.length
    ? rows.map((row) => JSON.stringify(keys.map((key) => row[key])))
    : table === "metas"
      ? rows
          .filter((row) => row["consultor_id"] || row["equipe_id"])
          .map((row) =>
            JSON.stringify([
              row["ciclo_id"],
              row["consultor_id"] ? "consultor" : "equipe",
              row["consultor_id"] || row["equipe_id"],
            ]),
          )
      : [];
  assert(new Set(values).size === values.length, `Registros comerciais duplicados em ${table}.`);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function parseSnapshot(input: unknown): AppData {
  assertJsonData(input);
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      `Formato de dados incompatível em ${parsed.error.issues[0]?.path.join(".") || "base"}. O conteúdo original foi preservado.`,
    );
  // A validação não remove campos nem reescreve valores históricos.
  const data = input as AppData;
  for (const [name, collection] of Object.entries(data))
    if (Array.isArray(collection) && name in schema.shape) unique(collection, name);
  for (const name of Object.keys(commercialSchemas).filter((name) => name !== "jornada_eventos"))
    assert(Object.hasOwn(data.tables, name), `Tabela obrigatória ausente: ${name}.`);
  for (const [name, rows] of Object.entries(data.tables)) {
    unique(rows, name);
    rows.forEach((row) => validateCommercialRow(name, row));
    uniqueCommercialRows(name, rows);
  }
  const cards = new Map(data.cards.map((card) => [card.id, card]));
  const people = new Map(data.people.map((person) => [person.id, person]));
  const runs = new Map(data.stageRuns.map((run) => [run.id, run]));
  for (const name of [
    "people",
    "stageRuns",
    "taskExecutions",
    "comments",
    "attachments",
    "notifications",
  ] as const)
    for (const entry of data[name])
      assert(cards.has(entry.cardId), `Processo ausente em ${name}: ${entry.cardId}.`);
  for (const entry of data.activities)
    if (entry.cardId)
      assert(cards.has(entry.cardId), `Processo ausente no histórico: ${entry.cardId}.`);
  for (const person of data.people)
    if (person.relatedTo)
      assert(
        person.relatedTo !== person.id && people.get(person.relatedTo)?.cardId === person.cardId,
        "Vínculo entre pessoas inválido.",
      );
  for (const attachment of data.attachments)
    if (attachment.personId)
      assert(
        people.get(attachment.personId)?.cardId === attachment.cardId,
        "Pessoa do anexo pertence a outro processo.",
      );
  for (const card of data.cards) {
    const run = runs.get(card.stageRunId);
    assert(
      run?.cardId === card.id && run.stage === card.listId,
      "Ocorrência atual de etapa inválida.",
    );
    assert(
      card.deletedAt ? !!run.endedAt : run.endedAt === null,
      "Estado da ocorrência atual inconsistente.",
    );
    assert(!card.atingiu_fechamento || card.data_fechamento, "Marco de Fechamento sem data.");
    assert(!card.atingiu_contrato || card.data_assinatura, "Marco de assinatura sem data.");
    for (const [type, reached, at] of [
      ["milestone.proposal", true, card.data_proposta],
      ["milestone.closing", card.atingiu_fechamento, card.data_fechamento],
      ["milestone.signed", card.atingiu_contrato, card.data_assinatura],
    ] as const) {
      const events = data.activities.filter(
        (event) => event.cardId === card.id && event.type === type,
      );
      assert(events.length === (reached ? 1 : 0), `Histórico do marco inconsistente: ${type}.`);
      if (reached)
        assert(
          at && Date.parse(events[0]!.createdAt) === Date.parse(at),
          `Data do marco inconsistente: ${type}.`,
        );
    }
    assert(
      data.stageRuns.filter((run) => run.cardId === card.id && !run.endedAt).length ===
        (card.deletedAt ? 0 : 1),
      "Mais de uma etapa ativa no processo.",
    );
    assert(
      data.taskExecutions.filter((task) => task.cardId === card.id && !task.endedAt).length <= 1,
      "Mais de uma tarefa ativa no processo.",
    );
  }
  for (const run of data.stageRuns) {
    assert(
      !run.endedAt || Date.parse(run.endedAt) >= Date.parse(run.startedAt),
      "Período de etapa inválido.",
    );
    if (run.tasks) {
      unique(run.tasks, "sequência da etapa");
      assert(
        run.tasks.every((task) => task.stage === run.stage),
        "Tarefa de outra etapa no snapshot.",
      );
    }
  }
  for (const task of data.taskExecutions) {
    const run = runs.get(task.stageRunId);
    assert(run?.cardId === task.cardId, "Tarefa vinculada a ocorrência de outro processo.");
    assert(Boolean(task.endedAt) === Boolean(task.outcome), "Conclusão da tarefa inconsistente.");
    assert(
      !task.endedAt || Date.parse(task.endedAt) >= Date.parse(task.startedAt),
      "Período da tarefa inválido.",
    );
    if (!task.endedAt)
      assert(
        !run.endedAt && cards.get(task.cardId)?.stageRunId === task.stageRunId,
        "Tarefa ativa fora da etapa atual.",
      );
  }
  for (const original of NATIVE_FIELDS) {
    const field = data.fields.find((field) => field.id === original.id);
    assert(
      field?.native &&
        field.active &&
        field.type === original.type &&
        field.section === original.section,
      `Campo nativo inválido: ${original.id}.`,
    );
  }
  return data;
}
