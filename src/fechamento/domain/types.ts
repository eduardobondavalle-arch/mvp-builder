import type { Jornada } from "@/lib/data";

export const STAGES = [
  { id: "proposta", name: "PROPOSTA", slaHours: 12 },
  { id: "fechamento_enviado", name: "FECHAMENTO ENVIADO", slaHours: 12 },
  { id: "aprovado", name: "APROVADO", slaHours: 48 },
  { id: "entrega_chaves", name: "ENTREGA DAS CHAVES", slaHours: 12 },
  { id: "concluido", name: "FECHAMENTO CONCLUÍDO", slaHours: null },
  { id: "pendencia", name: "PENDÊNCIA DE DOCUMENTAÇÃO", slaHours: 12 },
  { id: "direcao", name: "APROVAÇÃO DA DIREÇÃO", slaHours: 12 },
  { id: "cancelado", name: "CONTRATO CANCELADO", slaHours: null },
  { id: "reprovado", name: "CADASTRO REPROVADO", slaHours: null },
] as const;
export type Stage = (typeof STAGES)[number]["id"];
export type Value = string | number | boolean | null;
export type Section = "geral" | "locatario" | "fiador" | "conjuge" | "morador" | "analise";
export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "phone"
  | "attachment";
export type Permission = "read" | "write" | "configure" | "delete";
/** Capacidades fornecidas pela plataforma hospedeira; nenhuma matriz de perfis própria. */
export type Actor = { id: string; name: string; permissions: Permission[] };
export type Catalog = {
  id: string;
  kind: string;
  name: string;
  unitId: string;
  active: boolean;
  definitive: boolean;
};
export type FieldDefinition = {
  id: string;
  name: string;
  type: FieldType;
  section: Section;
  options: string[];
  native: boolean;
  active: boolean;
  requiredAt: Stage[];
};
export type DocumentDefinition = {
  id: string;
  name: string;
  entity: Section;
  active: boolean;
  requiredAt: Stage[];
};
export type TaskDefinition = {
  id: string;
  stage: Stage;
  name: string;
  slaHours: number;
  position: number;
  active: boolean;
  required: boolean;
};
export type Person = {
  id: string;
  cardId: string;
  role: Exclude<Section, "geral" | "analise">;
  relatedTo: string | null;
  name: string;
  cpf: string;
  rg: string;
  profession: string;
  income: number | null;
  maritalStatus: string;
  phone: string;
  custom: Record<string, Value>;
  active: boolean;
};
export type Analysis = {
  opinion: string;
  result: string;
  reviewed: string;
  reasonId: string;
  explanation: string;
};
export type Card = Jornada & {
  listId: Stage;
  unitId: string;
  captorId: string;
  supervisorId: string;
  closingOwnerId: string;
  leaseType: string;
  propertyTypeId: string;
  captureOriginId: string;
  guaranteeId: string;
  guaranteeDetails: string;
  address: string;
  condominium: number | null;
  iptu: number | null;
  garbageFee: number | null;
  administrationPercentage: number | null;
  context: string;
  contractCreated: boolean | null;
  custom: Record<string, Value>;
  providedFields: string[];
  analysis: Analysis;
  position: number;
  enteredListAt: string;
  stageRunId: string;
  keyAppointment: string | null;
  keyDeliveredAt: string | null;
  recoveryDeadline: string | null;
  definitiveLoss: boolean;
  recovered: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteReason: string | null;
  version: number;
};
export type StageRun = {
  id: string;
  cardId: string;
  stage: Stage;
  startedAt: string;
  endedAt: string | null;
  dueAt: string | null;
  actorId: string;
  tasks?: TaskDefinition[];
};
export type TaskExecution = {
  id: string;
  cardId: string;
  stageRunId: string;
  taskId: string;
  name: string;
  position: number;
  slaHours: number;
  required: boolean;
  actorId: string;
  startedAt: string;
  endedAt: string | null;
  outcome: "completed" | "rework" | "stage_exit" | null;
};
export type Comment = {
  id: string;
  cardId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};
export type Attachment = {
  id: string;
  cardId: string;
  personId: string | null;
  documentId: string;
  fieldId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url: string;
  uploaderId: string;
  createdAt: string;
  removedAt: string | null;
};
export type Activity = {
  id: string;
  cardId: string;
  actorId: string;
  actorName: string;
  type: string;
  message: string;
  field: string | null;
  before: unknown;
  after: unknown;
  justification: string | null;
  createdAt: string;
};
export type Notification = {
  id: string;
  cardId: string;
  recipientId: string;
  recipientKind: "supervisao" | "consultor";
  body: string;
  createdAt: string;
  readAt: string | null;
};
export type Row = Record<string, unknown> & { id: string };
export function supervisorForUnit(unit?: Row) {
  if (!unit) return "";
  const configured = String(unit["supervisor"] ?? "").trim();
  if (configured) return configured;
  const name = String(unit["nome"] ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (name === "balneario camboriu") return "Mayara";
  if (name === "itapema") return "Jenifer";
  return "";
}
export type AppData = {
  schemaVersion: 1;
  revision: number;
  cards: Card[];
  people: Person[];
  catalogs: Catalog[];
  fields: FieldDefinition[];
  documents: DocumentDefinition[];
  tasks: TaskDefinition[];
  stageRuns: StageRun[];
  taskExecutions: TaskExecution[];
  comments: Comment[];
  attachments: Attachment[];
  activities: Activity[];
  notifications: Notification[];
  tables: Record<string, Row[]>;
};
export type BoardList = {
  id: Stage;
  name: string;
  position: number;
  slaHours: number | null;
  completedState: boolean;
  archived: false;
};
export const LISTS: BoardList[] = STAGES.map((stage, index) => ({
  ...stage,
  position: (index + 1) * 1024,
  completedState: stage.id === "concluido",
  archived: false,
}));
export type CardFilters = {
  query: string;
  unitId: string;
  consultantId: string;
  captorId: string;
  channelId: string;
  recovered: boolean;
};
export const EMPTY_FILTERS: CardFilters = {
  query: "",
  unitId: "",
  consultantId: "",
  captorId: "",
  channelId: "",
  recovered: false,
};
export const stageName = (stage: Stage) => STAGES.find((s) => s.id === stage)!.name;

export const FIELD_TYPES: Record<FieldType, string> = {
  text: "Texto",
  long_text: "Texto longo",
  number: "Número",
  currency: "Moeda",
  percentage: "Percentual",
  date: "Data",
  datetime: "Data/hora",
  boolean: "Sim/não",
  select: "Lista",
  phone: "Telefone",
  attachment: "Anexo",
};
export const SECTIONS: Record<Section, string> = {
  geral: "Geral",
  locatario: "Pessoas / Locatário",
  fiador: "Pessoas / Fiador",
  conjuge: "Pessoas / Cônjuge",
  morador: "Pessoas / Morador",
  analise: "Análise",
};
export const CATALOGS: Record<string, string> = {
  captor: "Captadores",
  property_type: "Tipos de imóvel",
  capture_origin: "Origens da captação",
  guarantee: "Garantias",
  reason: "Motivos de perda / reprovação",
};

const nativeFields: [string, string, FieldType, Section?][] = [
  ["cliente_nome", "Nome do cliente / locatário principal", "text"],
  ["cpf", "CPF", "text"],
  ["telefone", "Telefone", "phone"],
  ["unitId", "Unidade", "select"],
  ["consultor_id", "Consultor responsável", "select"],
  ["canal_id", "Origem do lead / Canal", "select"],
  ["captorId", "Captador responsável", "select"],
  ["supervisorId", "Responsável da Supervisão", "text"],
  ["closingOwnerId", "Responsável do Fechamento", "text"],
  ["leaseType", "Tipo de locação", "select"],
  ["imovel", "Código do imóvel", "text"],
  ["address", "Endereço completo do imóvel", "long_text"],
  ["propertyTypeId", "Tipo de imóvel", "select"],
  ["captureOriginId", "Origem da captação", "select"],
  ["guaranteeId", "Garantia utilizada", "select"],
  ["guaranteeDetails", "Detalhes da garantia", "long_text"],
  ["valor_original", "Valor Original", "currency"],
  ["valor_proposta", "Valor da Proposta", "currency"],
  ["valor_atualizado", "Valor atualizado", "currency"],
  ["valor_final", "Valor final", "currency"],
  ["percentual_intermediacao", "% de intermediação", "percentage"],
  ["administrationPercentage", "% de administração", "percentage"],
  ["condominium", "Condomínio", "currency"],
  ["iptu", "IPTU", "currency"],
  ["garbageFee", "Taxa de lixo", "currency"],
  ["data_primeiro_contato", "Data do primeiro contato", "date"],
  ["data_entrada_crm", "Data de entrada no CRM", "date"],
  ["data_visita", "Data da visita", "date"],
  ["data_envio_contrato", "Data de envio do contrato", "date"],
  ["contractCreated", "Contrato criado", "boolean"],
  ["context", "Detalhes / contexto do fechamento", "long_text"],
  ["justificativa_nova_jornada", "Justificativa da nova jornada", "long_text"],
  ["name", "Nome completo", "text", "locatario"],
  ["cpf", "CPF", "text", "locatario"],
  ["rg", "RG", "text", "locatario"],
  ["profession", "Profissão", "text", "locatario"],
  ["income", "Renda", "currency", "locatario"],
  ["maritalStatus", "Estado civil", "text", "locatario"],
  ["phone", "Telefone", "phone", "locatario"],
  ["opinion", "Pendência de documentação / Aprovação da Direção", "long_text", "analise"],
  ["reasonId", "Motivo da reprovação", "select", "analise"],
  ["explanation", "Justificativa da reprovação", "long_text", "analise"],
];
export const NATIVE_FIELDS: FieldDefinition[] = nativeFields.flatMap(
  ([id, name, type, section = "geral"]) => {
    const sections: Section[] =
      section === "locatario" ? ["locatario", "fiador", "conjuge", "morador"] : [section];
    return sections.map((s) => ({
      id: s === "geral" ? id : `${s}.${id}`,
      name,
      type,
      section: s,
      options: id === "leaseType" ? ["Residencial", "Comercial"] : [],
      native: true,
      active: true,
      requiredAt: [],
    }));
  },
);

export function createInitialData(): AppData {
  return {
    schemaVersion: 1,
    revision: 0,
    cards: [],
    people: [],
    catalogs: [
      ...["Ativa", "Orgânica", "Retorno"].map((name, i) => ({
        id: `capture-${i}`,
        kind: "capture_origin",
        name,
        unitId: "",
        active: true,
        definitive: false,
      })),
    ],
    fields: structuredClone(NATIVE_FIELDS),
    documents: [],
    tasks: [],
    stageRuns: [],
    taskExecutions: [],
    comments: [],
    attachments: [],
    activities: [],
    notifications: [],
    tables: {
      equipes: [
        { id: "70000000-0000-4000-8000-000000000001", nome: "Itapema" },
        { id: "70000000-0000-4000-8000-000000000002", nome: "Balneário Camboriú" },
      ],
      consultores: [],
      canais: [],
      motivos_perda: [],
      motivos_transferencia: [],
      ciclos: [],
      metas: [],
      registros_diarios: [],
      pre_leads_diarios: [],
      auditoria: [],
    },
  };
}
