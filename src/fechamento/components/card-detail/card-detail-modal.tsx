import { useState, type FormEvent } from "react";
import { Clock3, History, MessageSquare, Send, Trash2 } from "lucide-react";
import { useBoard } from "../providers/board-provider";
import { Modal } from "../ui/modal";
import { TransitionDialog } from "../board/transition-dialog";
import { GeneralFields, PeopleEditor, FieldControl } from "./fields";
import { Attachments } from "./attachments";
import {
  activeTask,
  canRecover,
  taskSequence,
  isTaskCompleted,
  TRANSITIONS,
  type PersonDraft,
} from "../../domain/operations";
import {
  stageName,
  type Card,
  type Value,
  type Stage,
  type Analysis,
  type Activity,
} from "../../domain/types";
import { slaState } from "../../domain/sla";
import { formatDate, cn } from "../../utils";
import { currentActor } from "../../host";

/** Layout e controles derivados do modal de detalhe do fechamento-locacao. */
export function CardDetailModal({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const { data, mutate, now, pending } = useBoard();
  const [tab, setTab] = useState("geral");
  const [destination, setDestination] = useState<Stage | null>(null);
  const [recover, setRecover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const card = data.cards.find((c) => c.id === cardId);
  if (!card || card.deletedAt) return null;
  const task = activeTask(data, card);
  const tasks = taskSequence(data, card);
  const canWrite = currentActor().permissions.includes("write");
  return (
    <Modal
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{card.cliente_nome}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium">{card.imovel}</span>
          {card.recovered && <span className="text-xs text-emerald-700">↻ Recuperado</span>}
        </span>
      }
      description={stageName(card.listId)}
      onClose={onClose}
      size="fullscreen"
    >
      <div
        className="flex flex-wrap gap-3 border-b border-[var(--border)] bg-card px-5 py-3 text-xs"
        aria-label="Sequência de tarefas"
      >
        {tasks.map((t) => {
          const last = data.taskExecutions
            .filter((e) => e.stageRunId === card.stageRunId && e.taskId === t.id)
            .at(-1);
          return (
            <span
              key={t.id}
              className={
                task?.taskId === t.id
                  ? "font-bold text-primary"
                  : isTaskCompleted(data, card, t.id)
                    ? "text-emerald-700"
                    : "text-muted-foreground"
              }
            >
              {task?.taskId === t.id ? "●" : isTaskCompleted(data, card, t.id) ? "✓" : "○"} {t.name}
            </span>
          );
        })}
        {!tasks.length && (
          <span className="text-muted-foreground">Nenhuma tarefa configurada nesta etapa.</span>
        )}
      </div>
      <div className="grid min-h-0 flex-1 overflow-y-auto bg-[var(--background)] xl:grid-cols-[minmax(0,1fr)_340px] xl:overflow-hidden">
        <div className="flex min-h-0 flex-col">
          <div
            className="flex shrink-0 overflow-x-auto border-b border-[var(--border)] px-4"
            role="tablist"
            aria-label="Detalhes do fechamento"
          >
            {[
              ["geral", "Geral"],
              ["pessoas", "Pessoas"],
              ["analise", "Análise"],
              ["auditoria", "Auditoria"],
            ].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`shrink-0 border-b-2 px-4 py-4 text-sm font-semibold ${tab === key ? "border-primary" : "border-transparent text-muted-foreground"}`}
                onClick={() => setTab(key!)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6" role="tabpanel">
            {tab === "geral" && (
              <>
                <GeneralEditor card={card} />
                <Comments cardId={card.id} />
              </>
            )}
            {tab === "pessoas" && <PeopleSection card={card} />}
            {tab === "analise" && <AnalysisEditor key={card.listId} card={card} />}
            {tab === "auditoria" && (
              <div className="space-y-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <History size={16} />
                  Histórico e auditoria
                </h3>
                {data.activities
                  .filter((a) => a.cardId === card.id)
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <ActivityEntry key={entry.id} entry={entry} />
                  ))}
              </div>
            )}
          </div>
        </div>
        <aside className="space-y-5 border-l border-[var(--border)] bg-[var(--card)] p-5 xl:overflow-y-auto">
          <SlaPanel card={card} />
          <section>
            <h3 className="field-label mb-3">Tarefas da etapa</h3>
            <div className="space-y-2">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  disabled={!canWrite || pending || task?.taskId === t.id}
                  className={cn(
                    "button-secondary h-auto min-h-10 w-full justify-start text-left",
                    task?.taskId === t.id && "border-primary text-primary",
                  )}
                  onClick={() =>
                    void mutate({ type: "task", cardId, taskId: t.id }, "Tarefa atualizada.")
                  }
                >
                  {task?.taskId === t.id ? "● " : "○ "}
                  {t.name} · {t.slaHours}h
                </button>
              ))}
            </div>
            {task && (
              <button
                disabled={pending || !canWrite}
                className="button-primary mt-3 w-full"
                onClick={() =>
                  void mutate({ type: "task", cardId, taskId: null }, "Tarefa concluída.")
                }
              >
                Concluir tarefa atual
              </button>
            )}
          </section>
          <section>
            <label className="field-label">
              Etapa atual
              <select
                aria-label="Etapa atual"
                className="input mt-1"
                value={card.listId}
                disabled={!canWrite || pending}
                onChange={(e) => setDestination(e.target.value as Stage)}
              >
                <option value={card.listId}>{stageName(card.listId)}</option>
                {TRANSITIONS[card.listId].map((stage) => (
                  <option key={stage} value={stage}>
                    {stageName(stage)}
                  </option>
                ))}
              </select>
            </label>
          </section>
          {canRecover(card, new Date(now)) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p>Recuperação até {formatDate(card.recoveryDeadline, true)}.</p>
              <button
                disabled={!canWrite}
                className="button-secondary mt-3 w-full"
                onClick={() => setRecover(true)}
              >
                Recuperar processo
              </button>
            </div>
          )}
          {card.listId === "entrega_chaves" && <KeyDelivery card={card} />}
          <section className="space-y-1 border-t border-[var(--border)] pt-4 text-xs text-muted-foreground">
            <p>Proposta: {formatDate(card.data_proposta, true)}</p>
            <p>
              Primeiro fechamento:{" "}
              {card.atingiu_fechamento ? formatDate(card.data_fechamento, true) : "—"}
            </p>
            <p>
              Contrato assinado:{" "}
              {card.atingiu_contrato ? formatDate(card.data_assinatura, true) : "—"}
            </p>
            <p className="pt-3">Atualizado em {formatDate(card.updated_at, true)}</p>
            {card.data_perda && (
              <div className="space-y-1 pt-3">
                <p>Última perda: {formatDate(card.data_perda, true)}</p>
                <p>
                  Motivo:{" "}
                  {data.catalogs.find(
                    (item) => item.kind === "reason" && item.id === card.motivo_perda_id,
                  )?.name ??
                    String(
                      data.tables["motivos_perda"]?.find(
                        (item) => item.id === card.motivo_perda_id,
                      )?.["nome"] ?? "—",
                    )}
                </p>
                <p>{card.descricao_perda}</p>
              </div>
            )}
            {card.motivo_reabertura && (
              <p className="pt-3">Recuperação: {card.motivo_reabertura}</p>
            )}
          </section>
          {currentActor().permissions.includes("delete") && (
            <button className="button-ghost w-full text-rose-700" onClick={() => setDeleting(true)}>
              <Trash2 size={14} />
              Exclusão administrativa
            </button>
          )}
        </aside>
      </div>
      {destination && (
        <TransitionDialog
          cardId={cardId}
          destination={destination}
          onClose={() => setDestination(null)}
        />
      )}
      {recover && (
        <TransitionDialog
          cardId={cardId}
          destination="fechamento_enviado"
          recovery
          onClose={() => setRecover(false)}
        />
      )}
      {deleting && (
        <Modal title="Exclusão administrativa" onClose={() => setDeleting(false)} size="medium">
          <form
            className="space-y-4 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  { type: "delete", cardId, explanation: deleteReason },
                  "Processo excluído administrativamente.",
                )
              )
                onClose();
            }}
          >
            <label className="field-label">
              Justificativa
              <textarea
                required
                className="input mt-1"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </label>
            <button className="button-primary" disabled={pending}>
              Confirmar exclusão lógica
            </button>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
function GeneralEditor({ card }: { card: Card }) {
  const { data, mutate, notify, pending } = useBoard();
  const [changes, setChanges] = useState<Record<string, Value>>({});
  const [custom, setCustom] = useState<Record<string, Value>>({});
  const saved = Object.fromEntries(
    data.fields
      .filter((f) => f.native && f.section === "geral")
      .map((f) => [
        f.id,
        card.providedFields.includes(f.id)
          ? ((card as unknown as Record<string, Value>)[f.id] ?? null)
          : null,
      ]),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (
      Object.keys(changes).length &&
      !(await mutate({ type: "edit", cardId: card.id, values: changes }))
    )
      return;
    for (const [fieldId, value] of Object.entries(custom))
      if (!(await mutate({ type: "custom", cardId: card.id, fieldId, value }))) return;
    setChanges({});
    setCustom({});
    notify("Dados do fechamento salvos.");
  }
  return (
    <>
      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <fieldset disabled={!currentActor().permissions.includes("write") || pending}>
          <GeneralFields
            data={data}
            values={{ ...saved, ...changes }}
            custom={{ ...card.custom, ...custom }}
            onChange={(key, value) => setChanges((c) => ({ ...c, [key]: value }))}
            onCustom={(key, value) => setCustom((c) => ({ ...c, [key]: value }))}
          />
        </fieldset>
        <button
          disabled={pending || !currentActor().permissions.includes("write")}
          className="button-primary"
        >
          Salvar dados do fechamento
        </button>
      </form>
      <AttachmentSection card={card} />
    </>
  );
}
function PeopleSection({ card }: { card: Card }) {
  const { data, mutate, pending } = useBoard();
  const [people, setPeople] = useState<PersonDraft[]>(() =>
    data.people.filter((p) => p.cardId === card.id).map(({ cardId: _cardId, ...p }) => p),
  );
  return (
    <>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await mutate({ type: "people", cardId: card.id, people }, "Pessoas atualizadas.");
        }}
      >
        <fieldset disabled={!currentActor().permissions.includes("write") || pending}>
          <PeopleEditor data={data} people={people} onChange={setPeople} />
        </fieldset>
        <button
          className="button-primary"
          disabled={pending || !currentActor().permissions.includes("write")}
        >
          Salvar pessoas
        </button>
      </form>
      <AttachmentSection card={card} />
    </>
  );
}
function AttachmentSection({ card }: { card: Card }) {
  const { data, mutate, notify } = useBoard();
  return (
    <fieldset disabled={!currentActor().permissions.includes("write")}>
      <Attachments
        data={data}
        cardId={card.id}
        people={data.people.filter((p) => p.cardId === card.id)}
        attachments={data.attachments.filter((a) => a.cardId === card.id && !a.removedAt)}
        notify={notify}
        onAdd={(attachment) =>
          mutate({ type: "attach", cardId: card.id, attachment }, "Anexo adicionado.")
        }
        onRemove={(attachmentId) =>
          mutate({ type: "remove_attachment", cardId: card.id, attachmentId }, "Anexo desativado.")
        }
      />
    </fieldset>
  );
}
function AnalysisEditor({ card }: { card: Card }) {
  const { data, mutate, pending } = useBoard();
  const [analysis, setAnalysis] = useState<Analysis>(card.analysis);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await mutate({ type: "analysis", cardId: card.id, analysis }, "Análise registrada.");
      }}
    >
      <fieldset
        className="space-y-4"
        disabled={!currentActor().permissions.includes("write") || pending}
      >
        {data.fields
          .filter(
            (f) =>
              f.active &&
              f.section === "analise" &&
              ["analise.reasonId", "analise.explanation", "analise.opinion"].includes(f.id),
          )
          .sort(
            (a, b) =>
              ["analise.reasonId", "analise.explanation", "analise.opinion"].indexOf(a.id) -
              ["analise.reasonId", "analise.explanation", "analise.opinion"].indexOf(b.id),
          )
          .map((field) => (
            <FieldControl
              key={field.id}
              field={
                field.id === "analise.opinion"
                  ? { ...field, name: "Pendência de documentação / Aprovação da Direção" }
                  : field
              }
              data={data}
              value={
                field.native
                  ? (analysis as unknown as Record<string, Value>)[field.id.split(".").at(-1)!]
                  : card.custom[field.id]
              }
              onChange={(value) =>
                field.native
                  ? setAnalysis((a) => ({ ...a, [field.id.split(".").at(-1)!]: value }))
                  : void mutate({ type: "custom", cardId: card.id, fieldId: field.id, value })
              }
            />
          ))}
      </fieldset>
      <button
        className="button-primary"
        disabled={pending || !currentActor().permissions.includes("write")}
      >
        Salvar análise
      </button>
    </form>
  );
}
function Comments({ cardId }: { cardId: string }) {
  const { data, mutate, pending } = useBoard();
  const [comment, setComment] = useState("");
  const entries = data.comments.filter((c) => c.cardId === cardId);
  return (
    <section className="flex min-h-80 flex-col border-t border-[var(--border)] pt-5">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <MessageSquare size={16} />
        Comentários
      </h3>
      <div className="space-y-5 py-5">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs">
              {entry.authorName.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 max-w-[90%]">
              <p className="text-xs">
                <strong>{entry.authorName}</strong>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {formatDate(entry.createdAt, true)}
                </span>
              </p>
              <p className="mt-1.5 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm leading-6">
                {entry.body}
              </p>
            </div>
          </div>
        ))}
        {!entries.length && (
          <div className="empty-box">
            Ainda não há comentários. Registre decisões e alinhamentos deste fechamento.
          </div>
        )}
      </div>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await mutate({ type: "comment", cardId, body: comment }, "Comentário adicionado."))
            setComment("");
        }}
      >
        <textarea
          className="input min-h-24"
          placeholder="Escreva um comentário…"
          aria-label="Novo comentário"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          className="button-primary"
          disabled={!comment.trim() || pending || !currentActor().permissions.includes("write")}
        >
          <Send size={14} />
          Comentar
        </button>
      </form>
    </section>
  );
}
function SlaPanel({ card }: { card: Card }) {
  const { data, now } = useBoard();
  const state = slaState(data, card, now);
  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        state.stageOverdue || state.taskOverdue
          ? "border-rose-400 bg-rose-50 text-rose-900"
          : "border-border bg-secondary",
      )}
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase">
        <Clock3 size={15} />
        SLA da etapa
      </p>
      <p className="mt-2 text-sm font-semibold">
        {state.stage ? formatDate(state.stage, true) : "Sem SLA operacional"}
      </p>
      {state.stageOverdue && <p className="text-xs">Prazo da etapa extrapolado</p>}
      <p className="mt-4 text-xs font-bold uppercase">SLA da tarefa</p>
      <p className="mt-2 text-sm">
        {state.task ? formatDate(state.task, true) : "Nenhuma tarefa ativa"}
      </p>
      {state.taskOverdue && <p className="text-xs">Tarefa atrasada</p>}
    </section>
  );
}
function KeyDelivery({ card }: { card: Card }) {
  const { mutate, pending } = useBoard();
  const [appointment, setAppointment] = useState("");
  return (
    <section className="space-y-3">
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await mutate(
            { type: "schedule", cardId: card.id, appointment: new Date(appointment).toISOString() },
            "Entrega agendada.",
          );
        }}
      >
        <label className="field-label">
          Data e horário da entrega
          <input
            required
            type="datetime-local"
            className="input mt-1"
            value={appointment}
            onChange={(e) => setAppointment(e.target.value)}
          />
        </label>
        <button
          className="button-secondary w-full"
          disabled={!currentActor().permissions.includes("write") || pending}
        >
          Agendar entrega
        </button>
      </form>
      {card.keyAppointment && (
        <p className="text-xs">Agendada: {formatDate(card.keyAppointment, true)}</p>
      )}
      {card.keyDeliveredAt ? (
        <p className="text-xs text-emerald-700">
          Entrega confirmada: {formatDate(card.keyDeliveredAt, true)}
        </p>
      ) : (
        <button
          className="button-primary w-full"
          disabled={
            !card.keyAppointment || pending || !currentActor().permissions.includes("write")
          }
          onClick={() =>
            void mutate({ type: "deliver", cardId: card.id }, "Entrega efetiva confirmada.")
          }
        >
          Confirmar entrega efetiva
        </button>
      )}
    </section>
  );
}
function ActivityEntry({ entry }: { entry: Activity }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <History size={13} />
      </span>
      <div className="min-w-0">
        <p className="leading-5">
          <strong>{entry.actorName}</strong> · {entry.message}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatDate(entry.createdAt, true)}
          {entry.field && ` · ${entry.field}`}
        </p>
        {entry.justification && <p className="mt-1 whitespace-pre-wrap">{entry.justification}</p>}
        {(entry.before !== null || entry.after !== null) && (
          <details className="mt-2">
            <summary className="cursor-pointer text-muted-foreground">
              Valores anterior e novo
            </summary>
            <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 text-[10px]">
              {JSON.stringify({ anterior: entry.before, novo: entry.after }, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
