import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Plus, Save, Settings2 } from "lucide-react";
import { useBoard } from "../providers/board-provider";
import {
  STAGES,
  FIELD_TYPES,
  SECTIONS,
  CATALOGS,
  type FieldDefinition,
  type DocumentDefinition,
  type TaskDefinition,
  type Catalog,
  type Stage,
} from "../../domain/types";
import { currentActor } from "../../host";
import { DataTransfer } from "./data-transfer";

/** Painel, abas e editores portados dos padrões de board-settings-panel do projeto de referência. */
export function BoardSettingsPanel() {
  const [tab, setTab] = useState("tasks");
  if (!currentActor().permissions.includes("configure"))
    return <div className="empty-box">Configurações são administradas pela plataforma.</div>;
  return (
    <div className="h-full overflow-y-auto pb-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Settings2 size={18} />
        Configurações
      </h2>
      <div className="panel mt-4 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[var(--border)] px-3">
          {[
            ["tasks", "Gerar Tarefas"],
            ["fields", "Campos do Card"],
            ["documents", "Documentos Obrigatórios"],
            ["directories", "Cadastros e Motivos"],
            ["data", "Dados e migração"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`shrink-0 border-b-2 px-4 py-4 text-xs font-semibold ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setTab(key!)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          {tab === "tasks" ? (
            <TaskSettings />
          ) : tab === "fields" ? (
            <FieldSettings />
          ) : tab === "documents" ? (
            <DocumentSettings />
          ) : tab === "directories" ? (
            <CatalogSettings />
          ) : (
            <DataTransfer />
          )}
        </div>
      </div>
    </div>
  );
}
function StageRequirements({
  value,
  onChange,
}: {
  value: Stage[];
  onChange: (value: Stage[]) => void;
}) {
  return (
    <fieldset className="rounded-xl bg-secondary p-3">
      <legend className="field-label px-1">Obrigatório na entrada da etapa</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage) => (
          <label key={stage.id} className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={value.includes(stage.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...value, stage.id] : value.filter((v) => v !== stage.id),
                )
              }
            />
            {stage.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Label({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="field-label">
      {title}
      {children}
    </label>
  );
}
function FieldSettings() {
  const { data } = useBoard();
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [section, setSection] = useState("geral");
  const draft: FieldDefinition = {
    id: newId,
    name: "",
    type: "text",
    section: "geral",
    options: [],
    native: false,
    active: true,
    requiredAt: [],
  };
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold">Campos personalizados e obrigatoriedade</h3>
      <FieldEditor key={newId} field={draft} isNew onSaved={() => setNewId(crypto.randomUUID())} />
      <Label title="Seção exibida">
        <select
          className="input mt-1 max-w-md"
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          {Object.entries(SECTIONS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </Label>
      {data.fields
        .filter((f) => f.section === section)
        .map((field) => (
          <FieldEditor key={field.id} field={field} />
        ))}
    </div>
  );
}
function FieldEditor({
  field,
  isNew = false,
  onSaved,
}: {
  field: FieldDefinition;
  isNew?: boolean;
  onSaved?: () => void;
}) {
  const { mutate, pending } = useBoard();
  const [draft, setDraft] = useState(field);
  const [options, setOptions] = useState(field.options.join("\n"));
  return (
    <form
      className="space-y-3 rounded-xl border border-[var(--border)] bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = {
          ...draft,
          options: options
            .split(/\n/)
            .map((v) => v.trim())
            .filter(Boolean),
        };
        if (await mutate({ type: "field", field: next }, "Campo salvo.")) onSaved?.();
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Label title={isNew ? "Nome do novo campo" : "Nome do campo"}>
          <input
            className="input mt-1"
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Label>
        <Label title="Tipo">
          <select
            className="input mt-1"
            disabled={field.native}
            value={draft.type}
            onChange={(e) =>
              setDraft((d) => ({ ...d, type: e.target.value as FieldDefinition["type"] }))
            }
          >
            {Object.entries(FIELD_TYPES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Label>
        <Label title="Local de exibição">
          <select
            className="input mt-1"
            disabled={field.native}
            value={draft.section}
            onChange={(e) =>
              setDraft((d) => ({ ...d, section: e.target.value as FieldDefinition["section"] }))
            }
          >
            {Object.entries(SECTIONS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Label>
      </div>
      {draft.type === "select" && !field.native && (
        <Label title="Opções (uma por linha)">
          <textarea
            className="input mt-1"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
        </Label>
      )}
      <StageRequirements
        value={draft.requiredAt}
        onChange={(requiredAt) => setDraft((d) => ({ ...d, requiredAt }))}
      />
      <div className="flex items-center justify-between">
        {field.native ? (
          <span className="text-xs text-muted-foreground">Campo nativo protegido</span>
        ) : (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            />
            Campo ativo
          </label>
        )}
        <button className="button-primary" disabled={pending}>
          {isNew ? <Plus size={14} /> : <Save size={14} />}
          {isNew ? "Adicionar campo" : "Salvar campo"}
        </button>
      </div>
    </form>
  );
}
function TaskSettings() {
  const { data, mutate, pending } = useBoard();
  const [stage, setStage] = useState<Stage>("proposta");
  const [name, setName] = useState("");
  const [sla, setSla] = useState("");
  const [required, setRequired] = useState(false);
  const tasks = data.tasks.filter((t) => t.stage === stage).sort((a, b) => a.position - b.position);
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold">Sequência de tarefas por etapa</h3>
      <p className="text-sm text-muted-foreground">
        Alterações valem para a próxima entrada na etapa. Processos em andamento conservam sua
        sequência e seus prazos.
      </p>
      <Label title="Etapa fixa">
        <select
          className="input mt-1 max-w-xl"
          value={stage}
          onChange={(e) => setStage(e.target.value as Stage)}
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.slaHours ? ` · SLA ${s.slaHours}h` : ""}
            </option>
          ))}
        </select>
      </Label>
      <form
        className="grid items-end gap-3 rounded-xl bg-secondary p-4 md:grid-cols-[1fr_140px_auto_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await mutate(
              {
                type: "task_config",
                task: {
                  id: crypto.randomUUID(),
                  stage,
                  name,
                  slaHours: Number(sla),
                  position: Math.max(0, ...tasks.map((t) => t.position)) + 1024,
                  active: true,
                  required,
                },
              },
              "Tarefa criada.",
            )
          ) {
            setName("");
            setSla("");
          }
        }}
      >
        <Label title="Nome da tarefa">
          <input
            className="input mt-1"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Label>
        <Label title="SLA em horas">
          <input
            className="input mt-1"
            type="number"
            step="any"
            min="0.01"
            required
            value={sla}
            onChange={(e) => setSla(e.target.value)}
          />
        </Label>
        <label className="flex min-h-10 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Exigir ao sair
        </label>
        <button className="button-primary" disabled={pending}>
          <Plus size={14} />
          Criar tarefa
        </button>
      </form>
      {tasks.map((task, index) => (
        <TaskEditor
          key={task.id}
          task={task}
          onMove={async (direction) => {
            const target = index + direction;
            if (target < 0 || target >= tasks.length) return;
            const before = direction < 0 ? tasks[target - 1]?.position : tasks[target]?.position;
            const after = direction < 0 ? tasks[target]?.position : tasks[target + 1]?.position;
            const position =
              before == null
                ? (after ?? 2048) - 1024
                : after == null
                  ? before + 1024
                  : (before + after) / 2;
            await mutate(
              { type: "task_config", task: { ...task, position } },
              "Sequência atualizada.",
            );
          }}
        />
      ))}
      {!tasks.length && <div className="empty-box">Nenhuma tarefa configurada nesta etapa.</div>}
    </section>
  );
}
function TaskEditor({
  task,
  onMove,
}: {
  task: TaskDefinition;
  onMove: (direction: number) => void;
}) {
  const { mutate, pending } = useBoard();
  const [draft, setDraft] = useState(task);
  return (
    <form
      className="grid items-end gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_110px_auto_auto_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        await mutate(
          { type: "task_config", task: { ...draft, position: task.position } },
          "Tarefa atualizada.",
        );
      }}
    >
      <Label title="Tarefa">
        <input
          className="input mt-1"
          value={draft.name}
          required
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </Label>
      <Label title="SLA (horas)">
        <input
          className="input mt-1"
          type="number"
          step="any"
          min="0.01"
          required
          value={draft.slaHours}
          onChange={(e) => setDraft((d) => ({ ...d, slaHours: Number(e.target.value) }))}
        />
      </Label>
      <label className="text-xs">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
        />{" "}
        Exigir ao sair
      </label>
      <label className="text-xs">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
        />{" "}
        Ativa
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          className="icon-button"
          aria-label={`Subir tarefa ${task.name}`}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Descer tarefa ${task.name}`}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={15} />
        </button>
        <button
          className="icon-button"
          disabled={pending}
          aria-label={`Salvar tarefa ${task.name}`}
        >
          <Save size={15} />
        </button>
      </div>
    </form>
  );
}
function DocumentSettings() {
  const { data } = useBoard();
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const draft: DocumentDefinition = {
    id: newId,
    name: "",
    entity: "geral",
    active: true,
    requiredAt: [],
  };
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold">Tipos de documento e exigências por pessoa</h3>
      <DocumentEditor
        key={newId}
        document={draft}
        isNew
        onSaved={() => setNewId(crypto.randomUUID())}
      />
      {data.documents.map((document) => (
        <DocumentEditor key={document.id} document={document} />
      ))}
    </section>
  );
}
function DocumentEditor({
  document,
  isNew = false,
  onSaved,
}: {
  document: DocumentDefinition;
  isNew?: boolean;
  onSaved?: () => void;
}) {
  const { mutate, pending } = useBoard();
  const [draft, setDraft] = useState(document);
  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await mutate({ type: "document", document: draft }, "Documento configurado."))
          onSaved?.();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Label title="Nome do documento">
          <input
            className="input mt-1"
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Label>
        <Label title="Aplica-se a">
          <select
            className="input mt-1"
            value={draft.entity}
            onChange={(e) =>
              setDraft((d) => ({ ...d, entity: e.target.value as DocumentDefinition["entity"] }))
            }
          >
            {Object.entries(SECTIONS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Label>
      </div>
      <StageRequirements
        value={draft.requiredAt}
        onChange={(requiredAt) => setDraft((d) => ({ ...d, requiredAt }))}
      />
      <div className="flex items-center justify-between">
        <label className="text-xs">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
          />{" "}
          Ativo
        </label>
        <button className="button-primary" disabled={pending}>
          {isNew ? "Adicionar documento" : "Salvar documento"}
        </button>
      </div>
    </form>
  );
}
function CatalogSettings() {
  const { data } = useBoard();
  const [kind, setKind] = useState("captor");
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const draft: Catalog = { id: newId, kind, name: "", unitId: "", active: true, definitive: false };
  return (
    <section className="space-y-4">
      <Link to="/cadastros" className="button-secondary">
        Administrar unidades, consultores e canais
      </Link>
      <Label title="Catálogo">
        <select
          className="input mt-1 max-w-lg"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setNewId(crypto.randomUUID());
          }}
        >
          {Object.entries(CATALOGS).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </Label>
      <CatalogEditor
        key={newId}
        catalog={draft}
        isNew
        onSaved={() => setNewId(crypto.randomUUID())}
      />
      {data.catalogs
        .filter((c) => c.kind === kind)
        .map((catalog) => (
          <CatalogEditor key={catalog.id} catalog={catalog} />
        ))}
    </section>
  );
}
function CatalogEditor({
  catalog,
  isNew = false,
  onSaved,
}: {
  catalog: Catalog;
  isNew?: boolean;
  onSaved?: () => void;
}) {
  const { data, mutate, pending } = useBoard();
  const [draft, setDraft] = useState(catalog);
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await mutate({ type: "catalog", catalog: draft }, "Cadastro salvo.")) onSaved?.();
      }}
    >
      <Label title="Nome">
        <input
          className="input mt-1"
          required
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </Label>
      {catalog.kind === "captor" && (
        <Label title="Unidade">
          <select
            className="input mt-1"
            required
            value={draft.unitId}
            onChange={(e) => setDraft((d) => ({ ...d, unitId: e.target.value }))}
          >
            <option value="">Selecione a unidade</option>
            {(data.tables["equipes"] ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {String(r["nome"])}
              </option>
            ))}
          </select>
        </Label>
      )}
      {catalog.kind === "reason" && (
        <label className="flex min-h-10 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.definitive}
            onChange={(e) => setDraft((d) => ({ ...d, definitive: e.target.checked }))}
          />
          Reprovação definitiva (problema judicial/legal)
        </label>
      )}
      <label className="flex min-h-10 items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
        />
        Ativo
      </label>
      <button className="button-primary" disabled={pending}>
        {isNew ? "Adicionar cadastro" : "Salvar cadastro"}
      </button>
    </form>
  );
}
