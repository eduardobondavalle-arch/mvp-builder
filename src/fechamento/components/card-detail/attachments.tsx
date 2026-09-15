import { useState } from "react";
import { Download, Paperclip, Trash2 } from "lucide-react";
import type { AppData, Attachment } from "../../domain/types";
import type { PersonDraft } from "../../domain/operations";
import { platform } from "../../host";
import { formatBytes } from "../../utils";

export type AttachmentDraft = Omit<
  Attachment,
  "id" | "cardId" | "uploaderId" | "createdAt" | "removedAt"
>;
export function Attachments({
  data,
  cardId,
  people,
  attachments,
  onAdd,
  onRemove,
  notify,
}: {
  data: AppData;
  cardId: string;
  people: PersonDraft[];
  attachments: (AttachmentDraft & { id: string })[];
  onAdd: (draft: AttachmentDraft) => Promise<unknown> | void;
  onRemove: (id: string) => Promise<unknown> | void;
  notify: (message: string, kind?: "error") => void;
}) {
  const [personId, setPersonId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [uploading, setUploading] = useState(false);
  const section = people.find((p) => p.id === personId)?.role ?? "geral";
  async function upload(file?: File) {
    if (!file) return;
    if (!platform() && file.size > 2 * 1024 * 1024) {
      notify("Cada anexo pode ter até 2 MB no armazenamento local.", "error");
      return;
    }
    if (file.size === 0) {
      notify("O arquivo está vazio.", "error");
      return;
    }
    setUploading(true);
    try {
      let location: { storagePath: string; url: string };
      if (platform()) location = await platform()!.upload(file, cardId);
      else {
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Não foi possível ler o anexo."));
          reader.onload = () =>
            resolve(`data:application/octet-stream;base64,${String(reader.result).split(",")[1]}`);
          reader.readAsDataURL(file);
        });
        location = { storagePath: `local/${cardId}/${crypto.randomUUID()}`, url };
      }
      await onAdd({
        personId: personId || null,
        documentId,
        fieldId: fieldId || null,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        ...location,
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Falha ao anexar arquivo.", "error");
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Paperclip size={16} />
        Anexos e documentos
      </h3>
      <div className="grid items-end gap-2 rounded-xl bg-secondary p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label">
          Pessoa / entidade
          <select
            className="input mt-1"
            value={personId}
            onChange={(e) => {
              setPersonId(e.target.value);
              setDocumentId("");
              setFieldId("");
            }}
          >
            <option value="">Processo</option>
            {people
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
          </select>
        </label>
        <label className="field-label">
          Tipo de documento
          <select
            className="input mt-1"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
          >
            <option value="">Anexo geral</option>
            {data.documents
              .filter(
                (d) => d.active && (d.entity === section || (!personId && d.entity === "analise")),
              )
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field-label">
          Campo de anexo
          <select
            className="input mt-1"
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
          >
            <option value="">Sem campo específico</option>
            {data.fields
              .filter(
                (f) =>
                  f.active &&
                  f.type === "attachment" &&
                  (f.section === section || (!personId && f.section === "analise")),
              )
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </label>
        <label className="button-secondary cursor-pointer">
          <Paperclip size={14} />
          {uploading ? "Anexando…" : "Anexar documento"}
          <input
            type="file"
            className="sr-only"
            disabled={uploading}
            aria-label="Anexar documento"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="space-y-2">
        {attachments.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3"
          >
            <Paperclip size={15} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{a.filename}</p>
              <p className="text-[10px] text-muted-foreground">
                {people.find((p) => p.id === a.personId)?.name ?? "Processo"} ·{" "}
                {data.documents.find((d) => d.id === a.documentId)?.name ?? "Anexo geral"} ·{" "}
                {formatBytes(a.size)}
              </p>
            </div>
            <a
              href={a.url}
              download={a.filename}
              className="icon-button"
              aria-label={`Baixar ${a.filename}`}
            >
              <Download size={14} />
            </a>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remover ${a.filename}`}
              onClick={() => void onRemove(a.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
