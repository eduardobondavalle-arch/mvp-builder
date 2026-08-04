import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  diffAuditoria,
  registrarAuditoria,
  registrarEvento,
  type Canal,
  type Jornada,
} from "@/lib/data";

const campos = [
  { key: "cliente_nome", label: "Nome do cliente", type: "text" },
  { key: "telefone", label: "Telefone", type: "text" },
  { key: "imovel", label: "Imóvel", type: "text" },
  { key: "data_primeiro_contato", label: "Data do primeiro contato", type: "date" },
  { key: "data_entrada_crm", label: "Data de entrada no CRM", type: "date" },
  { key: "data_visita", label: "Data da visita", type: "date" },
  { key: "data_proposta", label: "Data da proposta", type: "date" },
  { key: "valor_original", label: "Valor original do imóvel (R$)", type: "number" },
  { key: "valor_proposta", label: "Valor da proposta (R$)", type: "number" },
  { key: "valor_atualizado", label: "Valor atual da proposta (R$)", type: "number" },
  { key: "valor_final", label: "Valor final da locação (R$)", type: "number" },
  { key: "percentual_intermediacao", label: "Percentual de intermediação (%)", type: "number" },
] as const;

export function EditarJornadaDialog({
  jornada,
  canais,
  onClose,
}: {
  jornada: Jornada;
  canais: Canal[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      campos.map((c) => [
        c.key,
        (jornada as unknown as Record<string, unknown>)[c.key] == null
          ? ""
          : String((jornada as unknown as Record<string, unknown>)[c.key]),
      ]),
    ),
  );
  const [canalId, setCanalId] = useState(jornada.canal_id);
  const [justificativa, setJustificativa] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      if (!justificativa.trim())
        throw new Error("Correções exigem justificativa — nada é excluído, tudo é auditado.");

      const patch: Record<string, unknown> = {};
      for (const c of campos) {
        const valor = form[c.key] ?? "";
        const atual = (jornada as unknown as Record<string, unknown>)[c.key];
        if (valor === "" ? atual == null : String(atual ?? "") === valor) continue;
        patch[c.key] = valor === "" ? null : c.type === "number" ? Number(valor) : valor;
      }
      if (canalId !== jornada.canal_id) patch["canal_id"] = canalId;
      if (!Object.keys(patch).length) throw new Error("Nenhuma alteração para salvar.");

      const { error } = await supabase.from("jornadas").update(patch as never).eq("id", jornada.id);
      if (error) throw new Error(error.message);

      await registrarEvento({
        jornada_id: jornada.id,
        tipo: "correcao",
        justificativa: justificativa.trim(),
        detalhes: patch,
      });

      const nomeCanal = (id: string) => canais.find((c) => c.id === id)?.nome ?? id;
      await registrarAuditoria(
        diffAuditoria(
          jornada as unknown as Record<string, unknown>,
          Object.fromEntries(
            Object.entries(patch).map(([k, v]) => [
              k,
              k === "canal_id" ? nomeCanal(String(v)) : v,
            ]),
          ),
          {
            entidade: "jornada",
            entidade_id: jornada.id,
            referencia: `${jornada.cliente_nome} • CPF ${jornada.cpf}`,
            acao: "correcao",
            justificativa: justificativa.trim(),
          },
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jornadas"] });
      qc.invalidateQueries({ queryKey: ["eventos", jornada.id] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      toast.success("Jornada corrigida com registro na auditoria.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corrigir jornada</DialogTitle>
          <DialogDescription>
            {jornada.cliente_nome} • CPF {jornada.cpf}. Registros nunca são excluídos: erros são
            corrigidos aqui e cada campo alterado fica na trilha de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {campos.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <Label htmlFor={c.key}>{c.label}</Label>
              <Input
                id={c.key}
                type={c.type}
                step={c.type === "number" ? "0.01" : undefined}
                value={form[c.key] ?? ""}
                onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Canal de origem</Label>
            <Select value={canalId} onValueChange={setCanalId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canais.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="just-correcao">Justificativa da correção</Label>
            <Textarea
              id="just-correcao"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            Salvar correção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
