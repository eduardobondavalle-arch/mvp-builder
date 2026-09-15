import { currentActor } from "../host";
import { projectJornadas, requireCapability } from "../domain/operations";
import { readLocal, localTransaction } from "./repository";
import type { AppData, Row } from "../domain/types";
import { assertJsonData, validateCommercialRow } from "./snapshot";

type Result = { data: unknown; error: { message: string } | null };
const allowed = [
  "equipes",
  "consultores",
  "canais",
  "motivos_perda",
  "motivos_transferencia",
  "ciclos",
  "metas",
  "registros_diarios",
  "pre_leads_diarios",
  "auditoria",
];
function tableRows(data: AppData, table: string): Row[] {
  if (table === "jornadas") return projectJornadas(data);
  if (table === "auditoria")
    return [
      ...(data.tables[table] ?? []),
      ...data.activities.map((e) => ({
        id: e.id,
        entidade: e.cardId ? "fechamento" : "configuracoes",
        entidade_id: e.cardId,
        referencia: data.cards.find((c) => c.id === e.cardId)?.cliente_nome ?? e.message,
        acao: e.type,
        campo: e.field,
        valor_anterior: e.before == null ? null : JSON.stringify(e.before),
        valor_novo: e.after == null ? null : JSON.stringify(e.after),
        justificativa: e.justification,
        usuario: e.actorName,
        created_at: e.createdAt,
      })),
    ];
  if (table === "jornada_eventos")
    return [
      ...(data.tables[table] ?? []),
      ...data.activities
        .filter((e) => e.cardId)
        .map((e) => ({
          id: e.id,
          jornada_id: e.cardId,
          tipo: e.type,
          etapa_anterior: e.type === "stage.left" ? e.before : null,
          etapa_nova: e.type === "stage.entered" ? e.after : null,
          justificativa: e.justification,
          detalhes: { usuario: e.actorName },
          created_at: e.createdAt,
        })),
    ];
  if (!allowed.includes(table)) throw new Error(`Tabela indisponível: ${table}.`);
  return data.tables[table] ?? [];
}
function validateRow(data: AppData, table: string, row: Row) {
  validateCommercialRow(table, row);
  for (const key of [
    "leads",
    "atendimentos",
    "agendamentos",
    "visitas",
    "quantidade",
    "meta_contratos",
  ]) {
    const value = row[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 0))
      throw new Error("Informe quantidades inteiras e não negativas.");
  }
  if (
    row["meta_vgl"] !== undefined &&
    (typeof row["meta_vgl"] !== "number" ||
      !Number.isFinite(row["meta_vgl"]) ||
      row["meta_vgl"] < 0)
  )
    throw new Error("Meta de VGL inválida.");
  if (
    [
      "equipes",
      "consultores",
      "canais",
      "motivos_perda",
      "motivos_transferencia",
      "ciclos",
    ].includes(table) &&
    !String(row["nome"] ?? "").trim()
  )
    throw new Error("Informe o nome.");
  if (
    table === "ciclos" &&
    (!row["data_inicio"] ||
      !row["data_fim"] ||
      String(row["data_fim"]) < String(row["data_inicio"]))
  )
    throw new Error("Informe um período válido para o ciclo.");
  for (const [key, ref] of [
    ["consultor_id", "consultores"],
    ["equipe_id", "equipes"],
    ["ciclo_id", "ciclos"],
  ])
    if (row[key!] && !data.tables[ref!]?.some((r) => r.id === row[key!]))
      throw new Error("Cadastro relacionado não encontrado.");
  const others = (data.tables[table] ?? []).filter((other) => other.id !== row.id);
  const keys =
    table === "registros_diarios"
      ? ["consultor_id", "data"]
      : table === "pre_leads_diarios"
        ? ["data"]
        : ["equipes", "canais", "motivos_perda"].includes(table)
          ? ["nome"]
          : table === "metas"
            ? row["consultor_id"]
              ? ["ciclo_id", "consultor_id"]
              : row["equipe_id"]
                ? ["ciclo_id", "equipe_id", "consultor_id"]
                : []
            : [];
  if (keys.length && others.some((other) => keys.every((key) => other[key] === row[key])))
    throw new Error("Já existe um registro com esta identificação comercial.");
}
function defaults(table: string): Record<string, unknown> {
  if (table === "registros_diarios")
    return { leads: 0, atendimentos: 0, agendamentos: 0, visitas: 0 };
  if (table === "pre_leads_diarios") return { quantidade: 0 };
  if (table === "metas")
    return { equipe_id: null, consultor_id: null, meta_vgl: 0, meta_contratos: 0 };
  if (table === "ciclos") return { status: "aberto", meta_vgl: 0, meta_contratos: 0 };
  if (table === "consultores") return { ativo: true, equipe_id: null };
  return ["canais", "motivos_perda", "motivos_transferencia"].includes(table)
    ? { ativo: true }
    : {};
}
/** Porta de compatibilidade: mantém consultas e telas comerciais sem acoplar o domínio ao Supabase. */
class LocalQuery implements PromiseLike<Result> {
  private operation = "select";
  private payload: Record<string, unknown>[] = [];
  private predicates: ((row: Row) => boolean)[] = [];
  private orders: { key: string; ascending: boolean }[] = [];
  private max = Infinity;
  private one: "required" | "optional" | null = null;
  private conflict: string[] = [];
  private execution?: Promise<Result>;
  constructor(private table: string) {}
  select(_columns?: string) {
    return this;
  }
  insert(input: Record<string, unknown> | Record<string, unknown>[]) {
    this.operation = "insert";
    this.payload = Array.isArray(input) ? input : [input];
    return this;
  }
  update(input: Record<string, unknown>) {
    this.operation = "update";
    this.payload = [input];
    return this;
  }
  upsert(
    input: Record<string, unknown> | Record<string, unknown>[],
    options: { onConflict?: string } = {},
  ) {
    this.insert(input);
    this.operation = "upsert";
    this.conflict = (options.onConflict ?? "id").split(",").map((key) => key.trim());
    return this;
  }
  delete() {
    throw new Error("Exclusão física indisponível.");
  }
  eq(key: string, value: unknown) {
    this.predicates.push((r) => r[key] === value);
    return this;
  }
  in(key: string, values: unknown[]) {
    this.predicates.push((r) => values.includes(r[key]));
    return this;
  }
  order(key: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ key, ascending: options.ascending !== false });
    return this;
  }
  limit(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Limite de consulta inválido.");
    this.max = value;
    return this;
  }
  single() {
    this.one = "required";
    return this;
  }
  maybeSingle() {
    this.one = "optional";
    return this;
  }
  private checkSingle(rows: Row[]) {
    if (this.one && (rows.length > 1 || (this.one === "required" && rows.length === 0)))
      throw new Error("A consulta deve retornar um único registro.");
  }
  private async run(): Promise<Result> {
    try {
      requireCapability(currentActor(), "read");
      let rows: Row[];
      if (this.operation === "select")
        rows = tableRows(readLocal(), this.table).filter((r) => this.predicates.every((p) => p(r)));
      else
        rows = await localTransaction((source) => {
          if (!allowed.includes(this.table))
            throw new Error(
              "Jornadas são alimentadas exclusivamente pelos processos de Fechamento.",
            );
          requireCapability(
            currentActor(),
            ["registros_diarios", "pre_leads_diarios", "auditoria"].includes(this.table)
              ? "write"
              : "configure",
          );
          if (this.table === "auditoria" && this.operation !== "insert")
            throw new Error("Registros de auditoria são permanentes e não podem ser alterados.");
          assertJsonData(this.payload);
          if (this.operation === "upsert") {
            const supported = [
              "id",
              ...(this.table === "registros_diarios"
                ? ["consultor_id,data"]
                : this.table === "pre_leads_diarios"
                  ? ["data"]
                  : []),
            ];
            if (!supported.includes(this.conflict.join(",")))
              throw new Error("Chave de conflito não suportada para esta tabela.");
            if (
              this.payload.some((item) =>
                this.conflict.some(
                  (key) => item[key] === undefined || item[key] === null || item[key] === "",
                ),
              )
            )
              throw new Error("Informe todos os campos da chave de conflito.");
          }
          const data = structuredClone(source);
          const all = (data.tables[this.table] ??= []);
          const saved: Row[] = [];
          const now = new Date().toISOString();
          if (this.operation === "update") {
            for (const row of all.filter((r) => this.predicates.every((p) => p(r)))) {
              const patch = this.payload[0]!;
              if (
                (patch["id"] !== undefined && patch["id"] !== row.id) ||
                (patch["created_at"] !== undefined && patch["created_at"] !== row["created_at"])
              )
                throw new Error("Identificador e data de criação são permanentes.");
              const next = { ...row, ...patch, updated_at: now };
              validateRow(data, this.table, next);
              Object.assign(row, next);
              saved.push(row);
            }
          } else
            for (const item of this.payload) {
              const matches =
                this.operation === "upsert"
                  ? all.filter((r) => this.conflict.every((key) => r[key] === item[key]))
                  : [];
              if (matches.length > 1)
                throw new Error("A chave de conflito identifica mais de um registro.");
              const existing = matches[0];
              if (
                existing &&
                ((item["id"] !== undefined && item["id"] !== existing.id) ||
                  (item["created_at"] !== undefined &&
                    item["created_at"] !== existing["created_at"]))
              )
                throw new Error("Identificador e data de criação são permanentes.");
              const next: Row = {
                ...defaults(this.table),
                created_at: now,
                ...existing,
                ...item,
                id: existing?.id ?? ((item["id"] ?? crypto.randomUUID()) as string),
                updated_at: now,
              };
              if (!existing && all.some((row) => row.id === next.id))
                throw new Error("Identificador de registro já existente.");
              if (this.table === "auditoria") next["usuario"] = currentActor().name;
              validateRow(data, this.table, next);
              if (existing) Object.assign(existing, next);
              else all.push(next);
              saved.push(next);
            }
          this.checkSingle(saved.slice(0, this.max));
          if (!saved.length) return { data: source, result: saved };
          data.revision += 1;
          return { data, result: saved };
        });
      for (const order of [...this.orders].reverse())
        rows.sort(
          (a, b) =>
            String(a[order.key] ?? "").localeCompare(String(b[order.key] ?? ""), "pt-BR", {
              numeric: true,
            }) * (order.ascending ? 1 : -1),
        );
      rows = rows.slice(0, this.max);
      this.checkSingle(rows);
      return { data: this.one ? (rows[0] ?? null) : rows, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Falha na persistência local." },
      };
    }
  }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.execution ??= this.run();
    return this.execution.then(onfulfilled, onrejected);
  }
}
export const localCommercialClient = { from: (table: string) => new LocalQuery(table) };
