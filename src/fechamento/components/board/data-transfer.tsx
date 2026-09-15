import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { useBoard } from "../providers/board-provider";
import { currentActor, platform } from "../../host";
import { localTransaction } from "../../persistence/repository";
import { importData } from "../../persistence/migrate";
export function DataTransfer() {
  const { data, notify } = useBoard();
  const [raw, setRaw] = useState<unknown>();
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `adim-v1-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold">Backup e migração do Comercial</h3>
      <p className="max-w-3xl text-sm text-muted-foreground">
        {platform()
          ? "Dados conectados à plataforma hospedeira."
          : "A base local fica neste navegador. Exporte um backup para preservar os processos, documentos e históricos."}
      </p>
      <button className="button-secondary" onClick={download}>
        <Download size={15} />
        Exportar backup completo
      </button>
      {!platform() && (
        <>
          <label className="button-secondary ml-2 cursor-pointer">
            <Upload size={15} />
            Selecionar arquivo de importação
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const content: unknown = JSON.parse(await file.text());
                  importData(data, content, currentActor());
                  setRaw(content);
                  setFilename(file.name);
                } catch (error) {
                  setRaw(undefined);
                  notify(error instanceof Error ? error.message : "Arquivo inválido.", "error");
                }
              }}
            />
          </label>
          {raw !== undefined && (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm">Arquivo validado: {filename}</p>
              <button
                className="button-primary mt-3"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await localTransaction((source) => {
                      const next = importData(source, raw, currentActor());
                      const importedAt = Date.now();
                      window.localStorage.setItem(
                        `adim-backup-before-import:${importedAt}`,
                        JSON.stringify(source),
                      );
                      window.localStorage.setItem(
                        `adim-original-import:${importedAt}`,
                        JSON.stringify(raw),
                      );
                      return { data: next, result: next };
                    });
                    setRaw(undefined);
                    notify("Dados importados.");
                  } catch (error) {
                    notify(
                      error instanceof Error ? error.message : "Falha na importação.",
                      "error",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Importar arquivo validado
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
