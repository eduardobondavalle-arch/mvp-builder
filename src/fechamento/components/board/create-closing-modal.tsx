import { useState, type FormEvent } from "react";
import { useBoard } from "../providers/board-provider";
import { Modal } from "../ui/modal";
import { GeneralFields, PeopleEditor } from "../card-detail/fields";
import { Attachments, type AttachmentDraft } from "../card-detail/attachments";
import { emptyPerson } from "../../domain/operations";
import type { Value } from "../../domain/types";

export function CreateClosingModal({
  onClose,
  onCreated,
  onOpenSettings,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const { data, mutate, notify, pending } = useBoard();
  const [tab, setTab] = useState("geral");
  const [values, setValues] = useState<Record<string, Value>>({});
  const [custom, setCustom] = useState<Record<string, Value>>({});
  const [people, setPeople] = useState(() => [emptyPerson()]);
  const [attachments, setAttachments] = useState<(AttachmentDraft & { id: string })[]>([]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await mutate(
      {
        type: "create",
        values,
        people,
        custom,
        attachments: attachments.map(({ id: _id, ...a }) => a),
      },
      "Proposta enviada.",
    );
    if (result) {
      onClose();
      onCreated(result.cards.at(-1)!.id);
    }
  }
  return (
    <Modal
      title="Formulário de Proposta"
      description="Os dados e documentos da proposta alimentam diretamente o processo de fechamento."
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-col">
        <div className="flex border-b border-[var(--border)] px-5">
          {[
            ["geral", "Geral"],
            ["pessoas", "Pessoas"],
            ["documentos", "Documentos"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`shrink-0 border-b-2 px-4 py-4 text-xs font-semibold ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setTab(key!)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          {!(data.tables["consultores"] ?? []).length && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Cadastre os consultores em Cadastros para atribuir o responsável comercial.{" "}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                Abrir configurações
              </button>
            </div>
          )}
          {tab === "geral" && (
            <GeneralFields
              data={data}
              values={values}
              custom={custom}
              includeIdentity={false}
              onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
              onCustom={(key, value) => setCustom((v) => ({ ...v, [key]: value }))}
            />
          )}
          {tab === "pessoas" && <PeopleEditor data={data} people={people} onChange={setPeople} />}
          {tab === "documentos" && (
            <Attachments
              data={data}
              cardId="proposta"
              people={people}
              attachments={attachments}
              notify={notify}
              onAdd={(a) =>
                setAttachments((current) => [...current, { ...a, id: crypto.randomUUID() }])
              }
              onRemove={(id) => setAttachments((current) => current.filter((a) => a.id !== id))}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button-primary" disabled={pending}>
            {pending ? "Enviando…" : "Enviar proposta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
