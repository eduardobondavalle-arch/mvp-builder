import { useState } from "react";
import { Modal } from "../ui/modal";
import { useBoard } from "../providers/board-provider";
import { stageName, type Stage } from "../../domain/types";
import { isLoss, transitionGaps, TRANSITIONS } from "../../domain/operations";
export function TransitionDialog({
  cardId,
  destination,
  onClose,
  recovery = false,
}: {
  cardId: string;
  destination: Stage;
  onClose: () => void;
  recovery?: boolean;
}) {
  const { data, mutate, pending } = useBoard();
  const [explanation, setExplanation] = useState("");
  const [reasonId, setReasonId] = useState("");
  const card = data.cards.find((c) => c.id === cardId)!;
  const gaps = transitionGaps(data, card, destination);
  const allowed = recovery || TRANSITIONS[card.listId].includes(destination);
  return (
    <Modal
      title={recovery ? "Recuperar processo" : `Mover para ${stageName(destination)}`}
      onClose={onClose}
      size="medium"
    >
      <form
        className="space-y-4 overflow-y-auto p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await mutate(
            recovery
              ? { type: "recover", cardId, explanation }
              : { type: "move", cardId, destination, explanation, reasonId },
            recovery ? "Processo recuperado." : "Card movido.",
          );
          if (result) onClose();
        }}
      >
        {!allowed && (
          <p role="alert" className="text-sm text-destructive">
            Esta transição não é permitida a partir de {stageName(card.listId)}.
          </p>
        )}
        {gaps.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-bold">Faltam {gaps.length} informações obrigatórias:</p>
            <ul className="mt-2 list-inside list-disc">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
        {!recovery && isLoss(destination) && (
          <label className="field-label">
            Motivo
            <select
              aria-label="Motivo"
              className="input mt-1"
              required
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
            >
              <option value="">Selecione o motivo</option>
              {(data.tables["motivos_perda"] ?? [])
                .filter((r) => r["ativo"] !== false)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {String(r["nome"])}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="field-label">
          {recovery
            ? "O que mudou na recuperação?"
            : destination === "pendencia"
              ? "Descreva exatamente a pendência"
              : "Explicação / parecer"}
          <textarea
            className="input mt-1 min-h-28"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            required={
              recovery ||
              ["pendencia", "direcao", "cancelado", "reprovado"].includes(destination) ||
              card.listId === "direcao"
            }
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="button-secondary" onClick={onClose}>
            Voltar
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={pending || !allowed || gaps.length > 0}
          >
            {recovery ? "Recuperar para Fechamento Enviado" : "Confirmar movimento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
