import { z } from "zod";
import {
  STAGES,
  NATIVE_FIELDS,
  stageName,
  supervisorForUnit,
  type AppData,
  type Actor,
  type Stage,
  type Card,
  type Person,
  type Value,
  type TaskDefinition,
  type TaskExecution,
  type FieldDefinition,
  type DocumentDefinition,
  type Catalog,
  type Attachment,
  type Analysis,
} from "./types";

const id = () => crypto.randomUUID();
const HOUR = 3_600_000;
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
function fail(message: string): never {
  throw new DomainError(message);
}
const text = (value: unknown, label: string) =>
  z.string().trim().min(1, `${label} é obrigatório.`).max(10000).parse(value);
const iso = (date: Date) => date.toISOString();
const deadline = (now: Date, hours: number) => new Date(now.getTime() + hours * HOUR).toISOString();
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function requireCapability(actor: Actor, permission: Actor["permissions"][number]) {
  if (!actor.id || !actor.permissions.includes(permission))
    fail("A plataforma não autorizou esta ação.");
}
function event(
  data: AppData,
  actor: Actor,
  now: Date,
  cardId: string,
  type: string,
  message: string,
  extra: Partial<AppData["activities"][number]> = {},
) {
  data.activities.push({
    id: id(),
    cardId,
    actorId: actor.id,
    actorName: actor.name,
    type,
    message,
    field: null,
    before: null,
    after: null,
    justification: null,
    ...structuredClone(extra),
    createdAt: iso(now),
  });
}
function diff(
  data: AppData,
  actor: Actor,
  now: Date,
  cardId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = "",
) {
  for (const [field, value] of Object.entries(after))
    if (!equal(before[field], value))
      event(data, actor, now, cardId, "field.changed", "Alterou informação", {
        field: prefix + field,
        before: before[field] ?? null,
        after: value,
      });
}
export const isLoss = (stage: Stage) => stage === "cancelado" || stage === "reprovado";
export function canRecover(card: Card, now = new Date()) {
  return (
    !card.deletedAt &&
    isLoss(card.listId) &&
    !card.definitiveLoss &&
    !!card.recoveryDeadline &&
    now.getTime() < Date.parse(card.recoveryDeadline)
  );
}
export const TRANSITIONS: Record<Stage, Stage[]> = {
  proposta: ["fechamento_enviado", "cancelado"],
  fechamento_enviado: ["pendencia", "direcao", "aprovado", "cancelado", "reprovado"],
  pendencia: ["fechamento_enviado"],
  direcao: ["fechamento_enviado"],
  aprovado: ["entrega_chaves", "pendencia", "direcao", "cancelado", "reprovado"],
  entrega_chaves: ["concluido", "cancelado"],
  concluido: [],
  cancelado: [],
  reprovado: [],
};
export const activeTask = (data: AppData, card: Card) =>
  data.taskExecutions.find((t) => t.cardId === card.id && !t.endedAt);
const taskOrder = (a: TaskDefinition, b: TaskDefinition) =>
  a.position - b.position || a.id.localeCompare(b.id);
const stageTasks = (data: AppData, stage: Stage) =>
  data.tasks.filter((t) => t.stage === stage && t.active).sort(taskOrder);
/** A configuração vale para a próxima entrada; uma execução em andamento conserva sua sequência. */
export function taskSequence(data: AppData, card: Card): TaskDefinition[] {
  const snapshot = data.stageRuns.find((run) => run.id === card.stageRunId)?.tasks;
  if (snapshot) return snapshot;
  // Compatibilidade com bases anteriores ao snapshot da etapa: preservar execuções existentes.
  const tasks = new Map(stageTasks(data, card.listId).map((task) => [task.id, task]));
  for (const execution of data.taskExecutions.filter(
    (task) => task.stageRunId === card.stageRunId,
  )) {
    tasks.set(execution.taskId, {
      id: execution.taskId,
      stage: card.listId,
      name: execution.name,
      position: execution.position,
      slaHours: execution.slaHours,
      required: execution.required,
      active: true,
    });
  }
  return [...tasks.values()].sort(taskOrder);
}
/** Retrabalho de uma tarefa também exige refazer as tarefas posteriores da sequência. */
export function isTaskCompleted(data: AppData, card: Card, taskId: string) {
  const sequence = taskSequence(data, card);
  const position = sequence.findIndex((task) => task.id === taskId);
  if (position < 0) return false;
  const relevant = new Set(sequence.slice(0, position + 1).map((task) => task.id));
  const latest = data.taskExecutions
    .filter((task) => task.stageRunId === card.stageRunId && relevant.has(task.taskId))
    .at(-1);
  return latest?.taskId === taskId && latest.outcome === "completed";
}
function beginTask(
  data: AppData,
  card: Card,
  task: TaskDefinition,
  actor: Actor,
  now: Date,
  rework = false,
) {
  if (activeTask(data, card)) fail("Já existe uma tarefa ativa.");
  const execution: TaskExecution = {
    id: id(),
    cardId: card.id,
    stageRunId: card.stageRunId,
    taskId: task.id,
    name: task.name,
    position: task.position,
    slaHours: task.slaHours,
    required: task.required,
    actorId: actor.id,
    startedAt: iso(now),
    endedAt: null,
    outcome: null,
  };
  data.taskExecutions.push(execution);
  event(
    data,
    actor,
    now,
    card.id,
    rework ? "task.rework" : "task.started",
    `${rework ? "Retornou à" : "Iniciou"} tarefa: ${task.name}`,
    { after: execution },
  );
}
function finishTask(
  data: AppData,
  card: Card,
  actor: Actor,
  now: Date,
  outcome: NonNullable<TaskExecution["outcome"]>,
) {
  const execution = activeTask(data, card);
  if (!execution) return;
  execution.endedAt = iso(now);
  execution.outcome = outcome;
  event(
    data,
    actor,
    now,
    card.id,
    outcome === "completed" ? "task.completed" : "task.ended",
    `Encerrou tarefa: ${execution.name}`,
    { after: { ...execution, durationMs: now.getTime() - Date.parse(execution.startedAt) } },
  );
}
function enter(data: AppData, card: Card, stage: Stage, actor: Actor, now: Date) {
  const hours = STAGES.find((s) => s.id === stage)!.slaHours;
  card.listId = stage;
  card.enteredListAt = iso(now);
  card.stageRunId = id();
  const tasks =
    isLoss(stage) || stage === "concluido" ? [] : structuredClone(stageTasks(data, stage));
  data.stageRuns.push({
    id: card.stageRunId,
    cardId: card.id,
    stage,
    startedAt: iso(now),
    endedAt: null,
    dueAt: hours ? deadline(now, hours) : null,
    actorId: actor.id,
    tasks,
  });
  event(data, actor, now, card.id, "stage.entered", `Entrou em ${stageName(stage)}`, {
    after: stage,
  });
  if (stage === "fechamento_enviado" && !card.atingiu_fechamento) {
    card.atingiu_fechamento = true;
    card.data_fechamento = iso(now);
    event(data, actor, now, card.id, "milestone.closing", "Primeiro Fechamento Enviado");
  }
  if (stage === "entrega_chaves") {
    card.keyAppointment = null;
    card.keyDeliveredAt = null;
    if (!card.atingiu_contrato) {
      card.atingiu_contrato = true;
      card.data_assinatura = iso(now);
      event(
        data,
        actor,
        now,
        card.id,
        "milestone.signed",
        "Primeira Entrega das Chaves / Contrato Assinado",
      );
    }
  }
  const first = tasks[0];
  if (first) beginTask(data, card, first, actor, now);
}
function leave(data: AppData, card: Card, actor: Actor, now: Date) {
  const run = data.stageRuns.find((r) => r.id === card.stageRunId);
  if (run) run.endedAt = iso(now);
  finishTask(data, card, actor, now, "stage_exit");
  event(data, actor, now, card.id, "stage.left", `Saiu de ${stageName(card.listId)}`, {
    before: card.listId,
  });
}
const projectionStage = (card: Card): Card["etapa"] =>
  isLoss(card.listId)
    ? "negocio_perdido"
    : card.atingiu_contrato
      ? "contrato_assinado"
      : card.atingiu_fechamento
        ? "fechamento"
        : "proposta";
export function projectJornadas(data: AppData) {
  return data.cards
    .filter((card) => !card.deletedAt)
    .map((card) => ({ ...card, etapa: projectionStage(card) }));
}

function fieldValue(data: AppData, card: Card, field: FieldDefinition, person?: Person): unknown {
  const key = field.id.split(".").at(-1)!;
  if (field.type === "attachment")
    return (
      data.attachments.some(
        (a) =>
          a.cardId === card.id &&
          a.fieldId === field.id &&
          a.personId === (person?.id ?? null) &&
          !a.removedAt,
      ) || null
    );
  if (!field.native) return person ? person.custom[field.id] : card.custom[field.id];
  if (person) return (person as unknown as Record<string, unknown>)[key];
  if (field.section === "analise")
    return (card.analysis as unknown as Record<string, unknown>)[key];
  if (!card.providedFields.includes(key)) return null;
  return (card as unknown as Record<string, unknown>)[key];
}
const missing = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && !value.trim());
export function transitionGaps(data: AppData, card: Card, destination: Stage) {
  const gaps: string[] = [];
  for (const field of data.fields.filter((f) => f.active && f.requiredAt.includes(destination))) {
    if (field.section === "geral" || field.section === "analise") {
      const value = fieldValue(data, card, field);
      if (missing(value) || (field.id === "contractCreated" && value !== true))
        gaps.push(field.name);
    } else {
      const people = data.people.filter(
        (p) => p.cardId === card.id && p.active && p.role === field.section,
      );
      // Exigências por pessoa são aplicadas a todas as pessoas daquele papel existentes no processo.
      for (const person of people)
        if (missing(fieldValue(data, card, field, person)))
          gaps.push(`${person.name || field.section}: ${field.name}`);
    }
  }
  for (const doc of data.documents.filter((d) => d.active && d.requiredAt.includes(destination))) {
    const persons =
      doc.entity === "geral" || doc.entity === "analise"
        ? [null]
        : data.people.filter((p) => p.cardId === card.id && p.active && p.role === doc.entity);
    for (const person of persons)
      if (
        !data.attachments.some(
          (a) =>
            a.cardId === card.id &&
            a.personId === (person?.id ?? null) &&
            a.documentId === doc.id &&
            !a.removedAt,
        )
      )
        gaps.push(`${person?.name ? person.name + ": " : ""}${doc.name}`);
  }
  if (!isLoss(destination) && !isLoss(card.listId) && card.stageRunId) {
    for (const task of taskSequence(data, card).filter((task) => task.required)) {
      if (!isTaskCompleted(data, card, task.id)) gaps.push(`Tarefa: ${task.name}`);
    }
  }
  return gaps;
}
function validateGates(data: AppData, card: Card, destination: Stage) {
  const gaps = transitionGaps(data, card, destination);
  if (gaps.length)
    fail(
      `Não é possível avançar este fechamento. Faltam ${gaps.length} informações obrigatórias: ${gaps.join(", ")}.`,
    );
}
function validCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (!cpf.trim()) return true;
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  return [9, 10].every((length) => {
    const sum = [...digits.slice(0, length)].reduce(
      (s, n, i) => s + Number(n) * (length + 1 - i),
      0,
    );
    const result = (sum * 10) % 11;
    return (result === 10 ? 0 : result) === Number(digits[length]);
  });
}
function validateValue(field: FieldDefinition, value: Value) {
  if (missing(value)) return;
  if (["number", "currency", "percentage"].includes(field.type)) {
    if (typeof value !== "number" || !Number.isFinite(value))
      fail(`${field.name}: informe um número válido.`);
    if (field.type !== "number" && value < 0) fail(`${field.name} não pode ser negativo.`);
    if (field.type === "percentage" && value > 100) fail(`${field.name} deve estar entre 0 e 100.`);
  } else if (field.type === "boolean" && typeof value !== "boolean")
    fail(`${field.name}: selecione Sim ou Não.`);
  else if (
    ["date", "datetime"].includes(field.type) &&
    (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
  )
    fail(`${field.name}: data inválida.`);
  else if (
    field.type === "select" &&
    field.options.length &&
    !field.options.includes(String(value))
  )
    fail(`${field.name}: opção inválida.`);
  else if (
    ["text", "long_text", "phone", "select"].includes(field.type) &&
    typeof value !== "string"
  )
    fail(`${field.name}: informe um texto válido.`);
  else if (typeof value === "string" && value.length > 10000)
    fail(`${field.name}: texto muito longo.`);
}
function validateCustom(
  data: AppData,
  values: Record<string, Value>,
  section: FieldDefinition["section"],
) {
  for (const [fieldId, value] of Object.entries(values)) {
    const field = data.fields.find(
      (candidate) => candidate.id === fieldId && !candidate.native && candidate.section === section,
    );
    if (!field || field.type === "attachment")
      fail("Campo personalizado incompatível com a seção.");
    validateValue(field, value);
  }
}
function validateCard(data: AppData, card: Card) {
  text(card.cliente_nome, "Nome do cliente");
  if (!validCpf(card.cpf)) fail("Informe um CPF válido.");
  for (const field of data.fields.filter(
    (f) => f.active && (f.section === "geral" || f.section === "analise"),
  ))
    validateValue(field, (fieldValue(data, card, field) ?? null) as Value);
  const relations: [string, string, string?][] = [
    [card.unitId, "equipes"],
    [card.consultor_id, "consultores"],
    [card.canal_id, "canais"],
  ];
  for (const [ref, table] of relations)
    if (ref && !data.tables[table]?.some((r) => r.id === ref))
      fail("Cadastro vinculado não encontrado.");
  const consultant = data.tables["consultores"]?.find((r) => r.id === card.consultor_id);
  if (consultant && card.unitId && consultant["equipe_id"] !== card.unitId)
    fail("O consultor deve pertencer à unidade selecionada.");
  for (const [key, kind] of Object.entries({
    captorId: "captor",
    propertyTypeId: "property_type",
    captureOriginId: "capture_origin",
    guaranteeId: "guarantee",
  })) {
    const ref = (card as unknown as Record<string, unknown>)[key];
    const entry = data.catalogs.find((c) => c.id === ref && c.kind === kind);
    if (ref && !entry) fail("Cadastro operacional não encontrado.");
    if (entry?.unitId && card.unitId && entry.unitId !== card.unitId)
      fail("O captador deve pertencer à unidade selecionada.");
  }
}
export type CardPatch = Record<string, Value>;
export type PersonDraft = Omit<Person, "cardId">;
export type Command =
  | {
      type: "create";
      values: CardPatch;
      people: PersonDraft[];
      custom?: Record<string, Value>;
      attachments?: Omit<Attachment, "id" | "cardId" | "uploaderId" | "createdAt" | "removedAt">[];
    }
  | { type: "edit"; cardId: string; values: CardPatch }
  | { type: "analysis"; cardId: string; analysis: Analysis }
  | { type: "custom"; cardId: string; fieldId: string; value: Value; personId?: string }
  | { type: "people"; cardId: string; people: PersonDraft[] }
  | {
      type: "move";
      cardId: string;
      destination: Stage;
      explanation: string;
      reasonId: string;
      beforeCardId?: string;
    }
  | { type: "recover"; cardId: string; explanation: string }
  | { type: "task"; cardId: string; taskId: string | null }
  | { type: "schedule"; cardId: string; appointment: string }
  | { type: "deliver"; cardId: string }
  | { type: "comment"; cardId: string; body: string }
  | {
      type: "attach";
      cardId: string;
      attachment: Omit<Attachment, "id" | "cardId" | "uploaderId" | "createdAt" | "removedAt">;
    }
  | { type: "remove_attachment"; cardId: string; attachmentId: string }
  | { type: "delete"; cardId: string; explanation: string }
  | { type: "field"; field: FieldDefinition }
  | { type: "document"; document: DocumentDefinition }
  | { type: "task_config"; task: TaskDefinition }
  | { type: "catalog"; catalog: Catalog }
  | { type: "notification_read"; notificationId: string }
  | { type: "tick" };

const valueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const patchSchema = z.record(valueSchema);
const stageSchema = z.enum([
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
const sectionSchema = z.enum(["geral", "locatario", "fiador", "conjuge", "morador", "analise"]);
const personSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["locatario", "fiador", "conjuge", "morador"]),
    relatedTo: z.string().nullable(),
    name: z.string(),
    cpf: z.string(),
    rg: z.string(),
    profession: z.string(),
    income: z.number().finite().nonnegative().nullable(),
    maritalStatus: z.string(),
    phone: z.string(),
    custom: patchSchema,
    active: z.boolean(),
  })
  .strict();
const analysisSchema = z
  .object({
    opinion: z.string(),
    result: z.string(),
    reviewed: z.string(),
    reasonId: z.string(),
    explanation: z.string(),
  })
  .strict();
const fieldSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
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
    section: sectionSchema,
    options: z.array(z.string().min(1)),
    native: z.boolean(),
    active: z.boolean(),
    requiredAt: z.array(stageSchema),
  })
  .strict();
const attachmentSchema = z
  .object({
    personId: z.string().nullable(),
    documentId: z.string(),
    fieldId: z.string().nullable(),
    filename: z.string().min(1).max(255),
    mimeType: z.string(),
    size: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024),
    storagePath: z.string(),
    url: z.string(),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create"),
      values: patchSchema,
      people: z.array(personSchema),
      custom: patchSchema.optional(),
      attachments: z.array(attachmentSchema).optional(),
    })
    .strict(),
  z.object({ type: z.literal("edit"), cardId: z.string(), values: patchSchema }).strict(),
  z.object({ type: z.literal("analysis"), cardId: z.string(), analysis: analysisSchema }).strict(),
  z
    .object({
      type: z.literal("custom"),
      cardId: z.string(),
      fieldId: z.string(),
      value: valueSchema,
      personId: z.string().optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("people"), cardId: z.string(), people: z.array(personSchema) })
    .strict(),
  z
    .object({
      type: z.literal("move"),
      cardId: z.string(),
      destination: stageSchema,
      explanation: z.string(),
      reasonId: z.string(),
      beforeCardId: z.string().optional(),
    })
    .strict(),
  z.object({ type: z.literal("recover"), cardId: z.string(), explanation: z.string() }).strict(),
  z.object({ type: z.literal("task"), cardId: z.string(), taskId: z.string().nullable() }).strict(),
  z
    .object({
      type: z.literal("schedule"),
      cardId: z.string(),
      appointment: z.string().datetime({ offset: true }),
    })
    .strict(),
  z.object({ type: z.literal("deliver"), cardId: z.string() }).strict(),
  z
    .object({
      type: z.literal("comment"),
      cardId: z.string(),
      body: z.string().trim().min(1).max(5000),
    })
    .strict(),
  z
    .object({
      type: z.literal("attach"),
      cardId: z.string(),
      attachment: z
        .object({
          personId: z.string().nullable(),
          documentId: z.string(),
          fieldId: z.string().nullable(),
          filename: z.string().min(1).max(255),
          mimeType: z.string(),
          size: z
            .number()
            .int()
            .positive()
            .max(20 * 1024 * 1024),
          storagePath: z.string(),
          url: z.string(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({ type: z.literal("remove_attachment"), cardId: z.string(), attachmentId: z.string() })
    .strict(),
  z.object({ type: z.literal("delete"), cardId: z.string(), explanation: z.string() }).strict(),
  z.object({ type: z.literal("field"), field: fieldSchema }).strict(),
  z
    .object({
      type: z.literal("document"),
      document: z
        .object({
          id: z.string().min(1),
          name: z.string().trim().min(1),
          entity: sectionSchema,
          active: z.boolean(),
          requiredAt: z.array(stageSchema),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("task_config"),
      task: z
        .object({
          id: z.string().min(1),
          stage: stageSchema,
          name: z.string().trim().min(1),
          slaHours: z.number().finite().positive().max(8760),
          position: z.number().finite(),
          active: z.boolean(),
          required: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("catalog"),
      catalog: z
        .object({
          id: z.string().min(1),
          kind: z.string().min(1),
          name: z.string().trim().min(1),
          unitId: z.string(),
          active: z.boolean(),
          definitive: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("notification_read"), notificationId: z.string() }).strict(),
  z.object({ type: z.literal("tick") }).strict(),
]);

function patchCard(card: Card, values: CardPatch, data: AppData) {
  const allowed = new Map(NATIVE_FIELDS.filter((f) => f.section === "geral").map((f) => [f.id, f]));
  for (const [key, value] of Object.entries(values)) {
    const field = allowed.get(key);
    if (!field) fail(`Campo protegido ou desconhecido: ${key}.`);
    validateValue(field, value);
    const empty = missing(value);
    const normalized = empty
      ? ["valor_original", "valor_proposta", "percentual_intermediacao"].includes(key)
        ? 0
        : ["number", "currency", "percentage", "boolean"].includes(field.type) ||
            key === "data_envio_contrato"
          ? null
          : ""
      : value;
    (card as unknown as Record<string, unknown>)[key] = normalized;
    if (empty) card.providedFields = card.providedFields.filter((provided) => provided !== key);
    else if (!card.providedFields.includes(key)) card.providedFields.push(key);
  }
  if (Object.prototype.hasOwnProperty.call(values, "unitId")) {
    const unit = data.tables["equipes"]?.find((row) => row.id === card.unitId);
    card.supervisorId = supervisorForUnit(unit);
    if (card.supervisorId && !card.providedFields.includes("supervisorId"))
      card.providedFields.push("supervisorId");
    if (!card.supervisorId)
      card.providedFields = card.providedFields.filter((field) => field !== "supervisorId");
  }
  validateCard(data, card);
}
export function emptyPerson(
  role: Person["role"] = "locatario",
  relatedTo: string | null = null,
): PersonDraft {
  return {
    id: id(),
    role,
    relatedTo,
    name: "",
    cpf: "",
    rg: "",
    profession: "",
    income: null,
    maritalStatus: "",
    phone: "",
    custom: {},
    active: true,
  };
}
function savePeople(data: AppData, card: Card, people: PersonDraft[], actor: Actor, now: Date) {
  const parsed = z.array(personSchema).parse(people);
  if (new Set(parsed.map((p) => p.id)).size !== parsed.length)
    fail("Pessoas com identificadores repetidos.");
  if (!parsed.some((p) => p.role === "locatario" && p.active))
    fail("Inclua ao menos um locatário.");
  for (const person of parsed) {
    const existing = data.people.find((p) => p.id === person.id);
    if (existing && existing.cardId !== card.id) fail("Pessoa pertence a outro processo.");
    if (person.active) {
      text(person.name, "Nome da pessoa");
      if (!validCpf(person.cpf)) fail(`CPF inválido: ${person.name}.`);
      if (
        person.role === "conjuge" &&
        !parsed.some(
          (p) => p.id === person.relatedTo && p.active && ["locatario", "fiador"].includes(p.role),
        )
      )
        fail("Vincule o cônjuge a um locatário ou fiador ativo.");
      validateCustom(data, person.custom, person.role);
      for (const field of data.fields.filter((f) => f.section === person.role && f.active))
        validateValue(
          field,
          (field.native
            ? (person as unknown as Record<string, Value>)[field.id.split(".").at(-1)!]
            : person.custom[field.id]) ?? null,
        );
    }
    diff(
      data,
      actor,
      now,
      card.id,
      existing ? { ...existing } : {},
      { ...person },
      `pessoas.${person.id}.`,
    );
    if (existing) Object.assign(existing, person);
    else data.people.push({ ...person, cardId: card.id });
  }
  for (const previous of data.people.filter(
    (p) => p.cardId === card.id && p.active && !parsed.some((p2) => p2.id === p.id),
  )) {
    previous.active = false;
    event(data, actor, now, card.id, "person.removed", `Desativou pessoa: ${previous.name}`, {
      before: previous.id,
    });
  }
  const primary = parsed.find((p) => p.active && p.role === "locatario")!;
  const next = {
    cliente_nome: primary.name,
    cpf: primary.cpf.replace(/\D/g, ""),
    telefone: primary.phone,
  };
  diff(data, actor, now, card.id, { ...card }, next);
  Object.assign(card, next);
}
function expire(data: AppData, actor: Actor, now: Date) {
  for (const card of data.cards)
    if (
      !card.deletedAt &&
      isLoss(card.listId) &&
      !card.definitiveLoss &&
      card.recoveryDeadline &&
      now.getTime() >= Date.parse(card.recoveryDeadline)
    ) {
      card.definitiveLoss = true;
      event(
        data,
        actor,
        new Date(card.recoveryDeadline),
        card.id,
        "recovery.expired",
        "Janela de recuperação encerrada",
      );
    }
}
/** Única fronteira de mutações: comando validado, cópia atômica e auditoria no mesmo resultado. */
export function execute(source: AppData, input: Command, actor: Actor, now = new Date()): AppData {
  const command = commandSchema.parse(input) as Command;
  const config = ["field", "document", "task_config", "catalog"].includes(command.type);
  requireCapability(
    actor,
    command.type === "tick"
      ? "read"
      : command.type === "delete"
        ? "delete"
        : config
          ? "configure"
          : "write",
  );
  const data = structuredClone(source);
  for (const card of data.cards) {
    const run = data.stageRuns.find((stageRun) => stageRun.id === card.stageRunId);
    if (run && !run.tasks) run.tasks = structuredClone(taskSequence(data, card));
  }
  expire(data, actor, now);
  if (command.type === "tick")
    return equal(source, data) ? source : { ...data, revision: source.revision + 1 };
  if (command.type === "create") {
    const card: Card = {
      id: id(),
      cliente_nome: "",
      cpf: "",
      telefone: "",
      consultor_id: "",
      canal_id: "",
      data_primeiro_contato: "",
      data_entrada_crm: "",
      data_visita: "",
      data_proposta: iso(now),
      imovel: "",
      valor_original: 0,
      valor_proposta: 0,
      percentual_intermediacao: 0,
      etapa: "proposta",
      data_fechamento: null,
      valor_atualizado: null,
      data_envio_contrato: null,
      data_assinatura: null,
      valor_final: null,
      motivo_perda_id: null,
      descricao_perda: null,
      data_perda: null,
      atingiu_fechamento: false,
      atingiu_contrato: false,
      motivo_reabertura: null,
      justificativa_nova_jornada: null,
      created_at: iso(now),
      updated_at: iso(now),
      listId: "proposta",
      unitId: "",
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
      custom: command.custom ?? {},
      providedFields: [],
      analysis: { opinion: "", result: "", reviewed: "", reasonId: "", explanation: "" },
      position:
        Math.max(0, ...data.cards.filter((c) => c.listId === "proposta").map((c) => c.position)) +
        1024,
      enteredListAt: iso(now),
      stageRunId: "",
      keyAppointment: null,
      keyDeliveredAt: null,
      recoveryDeadline: null,
      definitiveLoss: false,
      recovered: false,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      version: 1,
    };
    const primary = command.people.find((p) => p.role === "locatario" && p.active);
    for (const [fieldId, value] of Object.entries(card.custom)) {
      const field = data.fields.find(
        (candidate) =>
          candidate.id === fieldId &&
          !candidate.native &&
          ["geral", "analise"].includes(candidate.section),
      );
      if (!field) fail("Campo personalizado incompatível com a seção.");
      validateCustom(data, { [fieldId]: value }, field.section);
    }
    patchCard(
      card,
      {
        ...command.values,
        cliente_nome: primary?.name ?? command.values["cliente_nome"] ?? "",
        cpf: primary?.cpf ?? command.values["cpf"] ?? "",
        telefone: primary?.phone ?? command.values["telefone"] ?? "",
      },
      data,
    );
    data.cards.push(card);
    savePeople(data, card, command.people, actor, now);
    for (const attachment of command.attachments ?? []) {
      const attached = execute(data, { type: "attach", cardId: card.id, attachment }, actor, now);
      data.attachments = attached.attachments;
      data.activities = attached.activities;
    }
    validateGates(data, card, "proposta");
    event(data, actor, now, card.id, "milestone.proposal", "Proposta enviada / processo criado");
    enter(data, card, "proposta", actor, now);
  } else if (config) {
    if (command.type === "field") {
      const original = NATIVE_FIELDS.find((f) => f.id === command.field.id);
      if (
        original &&
        (!command.field.native ||
          !command.field.active ||
          command.field.type !== original.type ||
          command.field.section !== original.section)
      )
        fail("Campo nativo protegido: apenas nome e obrigatoriedade podem ser administrados.");
      if (!original && command.field.native) fail("Não é possível criar campos nativos.");
      if (command.field.type === "select" && !command.field.native && !command.field.options.length)
        fail("Informe as opções da lista.");
      upsert(data.fields, command.field, data, actor, now, "field");
    } else if (command.type === "document")
      upsert(data.documents, command.document, data, actor, now, "document");
    else if (command.type === "task_config") {
      if (isLoss(command.task.stage) || command.task.stage === "concluido")
        fail("Etapa sem execução operacional ativa.");
      const existing = data.tasks.find((t) => t.id === command.task.id);
      if (existing && existing.stage !== command.task.stage)
        fail("Crie outra tarefa para outra etapa; preserve esta definição.");
      upsert(data.tasks, command.task, data, actor, now, "task");
    } else if (command.type === "catalog") {
      if (
        command.catalog.unitId &&
        !data.tables["equipes"]?.some((r) => r.id === command.catalog.unitId)
      )
        fail("Unidade não encontrada.");
      upsert(data.catalogs, command.catalog, data, actor, now, "catalog");
      if (command.catalog.kind === "reason") {
        const rows = (data.tables["motivos_perda"] ??= []);
        const row = rows.find((r) => r.id === command.catalog.id);
        if (row) Object.assign(row, { nome: command.catalog.name, ativo: command.catalog.active });
        else
          rows.push({
            id: command.catalog.id,
            nome: command.catalog.name,
            ativo: command.catalog.active,
          });
      }
    }
  } else if (command.type === "notification_read") {
    const notification = data.notifications.find((n) => n.id === command.notificationId);
    if (!notification) fail("Notificação não encontrada.");
    notification.readAt = iso(now);
  } else if ("cardId" in command) {
    const card = data.cards.find((c) => c.id === command.cardId);
    if (!card || card.deletedAt) fail("Processo não encontrado ou excluído administrativamente.");
    if (command.type === "edit") {
      const before = { ...card };
      patchCard(card, command.values, data);
      diff(data, actor, now, card.id, before, command.values);
      const primary = data.people.find(
        (p) => p.cardId === card.id && p.active && p.role === "locatario",
      );
      if (primary) {
        const next = { name: card.cliente_nome, cpf: card.cpf, phone: card.telefone };
        diff(data, actor, now, card.id, { ...primary }, next, `pessoas.${primary.id}.`);
        Object.assign(primary, next);
      }
    } else if (command.type === "analysis") {
      diff(data, actor, now, card.id, { ...card.analysis }, { ...command.analysis }, "analise.");
      card.analysis = command.analysis;
    } else if (command.type === "people") savePeople(data, card, command.people, actor, now);
    else if (command.type === "custom") {
      const field = data.fields.find((f) => f.id === command.fieldId && f.active && !f.native);
      if (!field || field.type === "attachment") fail("Campo personalizado não encontrado.");
      validateValue(field, command.value);
      const person = command.personId
        ? data.people.find((p) => p.id === command.personId && p.cardId === card.id && p.active)
        : undefined;
      if (command.personId && (!person || person.role !== field.section))
        fail("Pessoa incompatível com o campo.");
      if (!person && field.section !== "geral" && field.section !== "analise")
        fail("Selecione uma pessoa para o campo.");
      const target = person?.custom ?? card.custom;
      diff(
        data,
        actor,
        now,
        card.id,
        target,
        { [field.id]: command.value },
        person ? `pessoas.${person.id}.custom.` : "custom.",
      );
      target[field.id] = command.value;
    } else if (command.type === "move") {
      const destination = command.destination;
      if (destination !== card.listId) {
        if (!TRANSITIONS[card.listId].includes(destination))
          fail(`Transição não permitida: ${stageName(card.listId)} → ${stageName(destination)}.`);
        if (
          ["pendencia", "direcao", "cancelado", "reprovado"].includes(destination) ||
          card.listId === "direcao"
        )
          text(command.explanation, "Explicação / parecer");
        if (destination === "concluido" && !card.keyDeliveredAt)
          fail("Confirme a entrega efetiva das chaves.");
        validateGates(data, card, destination);
        if (isLoss(destination)) {
          const reason =
            data.catalogs.find(
              (r) => r.kind === "reason" && r.id === command.reasonId && r.active,
            ) ??
            data.tables["motivos_perda"]?.find(
              (r) => r.id === command.reasonId && r["ativo"] !== false,
            );
          if (!reason) fail("Selecione um motivo estruturado de perda / reprovação.");
          card.motivo_perda_id = command.reasonId;
          card.descricao_perda = command.explanation;
          card.data_perda = iso(now);
          card.definitiveLoss =
            card.listId === "proposta" ||
            (destination === "reprovado" && Boolean((reason as Catalog).definitive));
          card.recoveryDeadline = card.definitiveLoss ? null : deadline(now, 12);
          event(
            data,
            actor,
            now,
            card.id,
            destination === "cancelado" ? "card.cancelled" : "card.rejected",
            stageName(destination),
            {
              before: card.listId,
              after: { reasonId: command.reasonId, recoveryDeadline: card.recoveryDeadline },
              justification: command.explanation,
            },
          );
          if (card.recoveryDeadline)
            event(data, actor, now, card.id, "recovery.opened", "Janela de recuperação: 12 horas", {
              after: card.recoveryDeadline,
            });
          if (destination === "reprovado") {
            const next = {
              ...card.analysis,
              result: "Reprovado",
              reasonId: command.reasonId,
              explanation: command.explanation,
            };
            diff(data, actor, now, card.id, { ...card.analysis }, next, "analise.");
            card.analysis = next;
          }
        }
        if (destination === "pendencia") {
          card.analysis.opinion = command.explanation;
          event(data, actor, now, card.id, "documentation.pending", "Pendência de documentação", {
            justification: command.explanation,
          });
          for (const [recipientKind, recipientId] of [
            ["supervisao", card.supervisorId],
            ["consultor", card.consultor_id],
          ] as const)
            data.notifications.push({
              id: id(),
              cardId: card.id,
              recipientId,
              recipientKind,
              body: command.explanation,
              createdAt: iso(now),
              readAt: null,
            });
        }
        if (destination === "direcao") card.analysis.opinion = command.explanation;
        if (destination === "direcao" || card.listId === "direcao")
          event(
            data,
            actor,
            now,
            card.id,
            destination === "direcao" ? "direction.sent" : "direction.recorded",
            destination === "direcao" ? "Encaminhou à Direção" : "Registrou desfecho da Direção",
            { justification: command.explanation },
          );
        leave(data, card, actor, now);
        enter(data, card, destination, actor, now);
        if (destination === "concluido")
          event(data, actor, now, card.id, "card.completed", "Fechamento concluído");
      }
      const siblings = data.cards
        .filter((c) => c.id !== card.id && !c.deletedAt && c.listId === destination)
        .sort((a, b) => a.position - b.position);
      const index = command.beforeCardId
        ? siblings.findIndex((c) => c.id === command.beforeCardId)
        : siblings.length;
      const target = index < 0 ? siblings.length : index;
      const before = siblings[target - 1]?.position;
      const after = siblings[target]?.position;
      card.position =
        before == null
          ? (after ?? 2048) - 1024
          : after == null
            ? before + 1024
            : (before + after) / 2;
      if (before !== undefined && after !== undefined && Math.abs(after - before) < 0.000001) {
        siblings.splice(target, 0, card);
        siblings.forEach((c, i) => {
          c.position = (i + 1) * 1024;
        });
      }
      event(data, actor, now, card.id, "card.ordered", "Atualizou posição do card", {
        after: card.position,
      });
    } else if (command.type === "recover") {
      if (!canRecover(card, now)) fail("Este processo não pode mais ser recuperado.");
      text(command.explanation, "Observação do que mudou na recuperação");
      validateGates(data, card, "fechamento_enviado");
      event(data, actor, now, card.id, "recovery.closed", "Janela encerrada por recuperação");
      event(data, actor, now, card.id, "card.recovered", "Processo recuperado", {
        justification: command.explanation,
      });
      card.recovered = true;
      card.motivo_reabertura = command.explanation;
      card.recoveryDeadline = null;
      card.definitiveLoss = false;
      leave(data, card, actor, now);
      enter(data, card, "fechamento_enviado", actor, now);
    } else if (command.type === "task") {
      if (isLoss(card.listId) || card.listId === "concluido")
        fail("Etapa sem execução operacional ativa.");
      const sequence = taskSequence(data, card);
      const current = activeTask(data, card);
      const last = data.taskExecutions.filter((t) => t.stageRunId === card.stageRunId).at(-1);
      const position = sequence.findIndex((task) => task.id === (current?.taskId ?? last?.taskId));
      const next = sequence[position + 1];
      if (command.taskId === null) {
        if (!current) fail("Não há tarefa ativa.");
        finishTask(data, card, actor, now, "completed");
        if (next) beginTask(data, card, next, actor, now);
      } else {
        const task = sequence.find((t) => t.id === command.taskId);
        if (!task) fail("Tarefa não encontrada nesta etapa.");
        if (current?.taskId === task.id) fail("Esta tarefa já está ativa.");
        const wasExecuted = data.taskExecutions.some(
          (t) => t.stageRunId === card.stageRunId && t.taskId === task.id,
        );
        const rework = wasExecuted && sequence.findIndex((item) => item.id === task.id) <= position;
        if (!rework && task.id !== next?.id)
          fail("Conclua a sequência de tarefas sem pular etapas.");
        finishTask(data, card, actor, now, rework ? "rework" : "completed");
        beginTask(data, card, task, actor, now, rework);
      }
    } else if (command.type === "schedule") {
      if (card.listId !== "entrega_chaves") fail("Agendamento disponível na Entrega das Chaves.");
      if (card.keyDeliveredAt) fail("A entrega já foi confirmada.");
      if (Date.parse(command.appointment) <= now.getTime()) fail("Agende uma data/hora futura.");
      event(data, actor, now, card.id, "keys.scheduled", "Agendou a entrega das chaves", {
        before: card.keyAppointment,
        after: command.appointment,
      });
      card.keyAppointment = command.appointment;
      const run = data.stageRuns.find((r) => r.id === card.stageRunId)!;
      run.dueAt = command.appointment;
    } else if (command.type === "deliver") {
      if (card.listId !== "entrega_chaves" || !card.keyAppointment)
        fail("Agende a entrega antes de confirmar a entrega efetiva.");
      if (card.keyDeliveredAt) fail("Entrega já confirmada.");
      card.keyDeliveredAt = iso(now);
      event(data, actor, now, card.id, "keys.delivered", "Confirmou entrega efetiva das chaves");
    } else if (command.type === "comment") {
      data.comments.push({
        id: id(),
        cardId: card.id,
        authorId: actor.id,
        authorName: actor.name,
        body: command.body,
        createdAt: iso(now),
      });
      event(data, actor, now, card.id, "comment.added", "Adicionou comentário");
    } else if (command.type === "attach") {
      const a = command.attachment;
      const person = a.personId
        ? data.people.find((p) => p.id === a.personId && p.cardId === card.id && p.active)
        : undefined;
      if (a.personId && !person) fail("Pessoa do anexo não encontrada.");
      const document = a.documentId
        ? data.documents.find((d) => d.id === a.documentId && d.active)
        : undefined;
      const field = a.fieldId
        ? data.fields.find((f) => f.id === a.fieldId && f.active && f.type === "attachment")
        : undefined;
      if (a.documentId && !document) fail("Tipo de documento não encontrado.");
      if (a.fieldId && !field) fail("Campo de anexo não encontrado.");
      for (const section of [document?.entity, field?.section]) {
        if (section && (person ? person.role !== section : !["geral", "analise"].includes(section)))
          fail("Pessoa incompatível com o tipo de documento ou campo de anexo.");
      }
      if (!/^(data:application\/octet-stream;base64,|https:\/\/)/.test(a.url))
        fail("Endereço de anexo inválido.");
      data.attachments.push({
        ...a,
        id: id(),
        cardId: card.id,
        uploaderId: actor.id,
        createdAt: iso(now),
        removedAt: null,
      });
      event(data, actor, now, card.id, "attachment.added", `Anexou ${a.filename}`, {
        after: {
          filename: a.filename,
          personId: a.personId,
          documentId: a.documentId,
          fieldId: a.fieldId,
        },
      });
    } else if (command.type === "remove_attachment") {
      const attachment = data.attachments.find(
        (a) => a.id === command.attachmentId && a.cardId === card.id && !a.removedAt,
      );
      if (!attachment) fail("Anexo não encontrado.");
      attachment.removedAt = iso(now);
      event(
        data,
        actor,
        now,
        card.id,
        "attachment.removed",
        `Desativou anexo ${attachment.filename}`,
      );
    } else if (command.type === "delete") {
      text(command.explanation, "Justificativa da exclusão administrativa");
      leave(data, card, actor, now);
      card.deletedAt = iso(now);
      card.deletedBy = actor.id;
      card.deleteReason = command.explanation;
      event(data, actor, now, card.id, "card.deleted", "Exclusão administrativa (soft delete)", {
        justification: command.explanation,
      });
    }
    card.etapa = projectionStage(card);
    card.updated_at = iso(now);
    card.version += 1;
  }
  data.revision = source.revision + 1;
  return data;
}
function upsert<T extends { id: string }>(
  rows: T[],
  value: T,
  data: AppData,
  actor: Actor,
  now: Date,
  kind: string,
) {
  const previous = rows.find((r) => r.id === value.id);
  event(data, actor, now, "", `config.${kind}`, "Atualizou configuração", {
    field: value.id,
    before: previous ? structuredClone(previous) : null,
    after: value,
  });
  if (previous) Object.assign(previous, value);
  else rows.push(value);
}
