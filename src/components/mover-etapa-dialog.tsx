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
  ETAPAS,
  etapaLabel,
  registrarAuditoria,
  registrarEvento,
  type Etapa,
  type Jornada,
  type MotivoPerda,
} from "@/lib/data";

type Patch = Record<string, string | number | boolean | null>;

type CampoForm =
  | "data_fechamento"
  | "valor_atualizado"
  | "data_envio_contrato"
  | "data_assinatura"
  | "valor_final"
  | "motivo_perda_id"
  | "descricao_perda"
  | "data_perda"
  | "justificativa";

type FormState = Partial<Record<CampoForm, string>>;

export function MoverEtapaDialog({
  jornada,
  destino,
  motivos,
  onClose,
}: {
  jornada: Jornada;
  destino: Etapa;
  motivos: MotivoPerda[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({});
  const label = ETAPAS.find((e) => e.key === destino)?.label ?? destino;
  const reabertura = jornada.etapa === "negocio_perdido" && destino !== "negocio_perdido";
  const retrocesso =
    ETAPAS.findIndex((e) => e.key === destino) < ETAPAS.findIndex((e) => e.key === jornada.etapa) &&
    jornada.etapa !== "negocio_perdido";

  const mutation = useMutation({
    mutationFn: async () => {
      const patch: Patch = { etapa: destino };

      if (destino === "fechamento") {
        if (!form.data_fechamento || !form.valor_atualizado)
          throw new Error("Informe a data do envio do fechamento e o valor atual da proposta.");
        if (form.data_fechamento < jornada.data_proposta)
          throw new Error("A data do fechamento não pode ser anterior à data da proposta.");
        patch["data_fechamento"] = form.data_fechamento;
        patch["valor_atualizado"] = Number(form.valor_atualizado);
        patch["atingiu_fechamento"] = true;
      }
      if (destino === "contrato_assinado") {
        if (!form.data_envio_contrato || !form.data_assinatura || !form.valor_final)
          throw new Error("Informe as datas do contrato e o valor final da locação.");
        if (form.data_assinatura < form.data_envio_contrato)
          throw new Error("A assinatura não pode ocorrer antes do envio do contrato.");
        patch["data_envio_contrato"] = form.data_envio_contrato;
        patch["data_assinatura"] = form.data_assinatura;
        patch["valor_final"] = Number(form.valor_final);
        patch["atingiu_fechamento"] = true;
        patch["atingiu_contrato"] = true;
      }
      if (destino === "negocio_perdido") {
        if (!form.motivo_perda_id || !form.descricao_perda)
          throw new Error("Informe o motivo da perda e a descrição detalhada.");
        patch["motivo_perda_id"] = form.motivo_perda_id;
        patch["descricao_perda"] = form.descricao_perda;
        patch["data_perda"] = form.data_perda || new Date().toISOString().slice(0, 10);
      }
      if ((reabertura || retrocesso) && !form.justificativa?.trim())
        throw new Error(
          reabertura
            ? "Toda reabertura de negócio perdido exige justificativa."
            : "O retorno para uma etapa anterior exige justificativa.",
        );
      if (reabertura) patch["motivo_reabertura"] = form.justificativa ?? null;

      const { error } = await supabase.from("jornadas").update(patch as never).eq("id", jornada.id);
      if (error) throw new Error(error.message);

      await registrarEvento({
        jornada_id: jornada.id,
        tipo: reabertura ? "reabertura" : retrocesso ? "retorno_etapa" : "movimentacao",
        etapa_anterior: jornada.etapa,
        etapa_nova: destino,
        justificativa: form.justificativa ?? null,
        detalhes: patch as Record<string, unknown>,
      });

      await registrarAuditoria([
        {
          entidade: "jornada",
          entidade_id: jornada.id,
          referencia: `${jornada.cliente_nome} • CPF ${jornada.cpf}`,
          acao: reabertura ? "reabertura" : "movimentacao",
          campo: "etapa",
          valor_anterior: etapaLabel(jornada.etapa),
          valor_novo: label,
          justificativa: form.justificativa ?? null,
        },
        ...Object.entries(patch)
          .filter(([campo]) => campo !== "etapa")
          .map(([campo, valor]) => ({
            entidade: "jornada",
            entidade_id: jornada.id,
            referencia: `${jornada.cliente_nome} • CPF ${jornada.cpf}`,
            acao: "movimentacao",
            campo,
            valor_anterior:
              (jornada as unknown as Record<string, unknown>)[campo] == null
                ? null
                : String((jornada as unknown as Record<string, unknown>)[campo]),
            valor_novo: valor == null ? null : String(valor),
          })),
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jornadas"] });
      qc.invalidateQueries({ queryKey: ["eventos", jornada.id] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      toast.success(`Jornada movida para ${label}.`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campo = (key: CampoForm, texto: string, type: string) => (
    <div key={key} className="space-y-1.5">
      <Label htmlFor={key}>{texto}</Label>
      <Input
        id={key}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mover para {label}</DialogTitle>
          <DialogDescription>
            {jornada.cliente_nome} • as informações obrigatórias desta etapa precisam ser
            preenchidas antes da movimentação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {destino === "fechamento" && (
            <>
              {campo("data_fechamento", "Data do envio do fechamento", "date")}
              {campo("valor_atualizado", "Valor atual da proposta (R$)", "number")}
            </>
          )}
          {destino === "contrato_assinado" && (
            <>
              {campo("data_envio_contrato", "Data do envio do contrato", "date")}
              {campo("data_assinatura", "Data da assinatura", "date")}
              {campo("valor_final", "Valor final da locação (R$)", "number")}
              <p className="text-xs text-muted-foreground">
                O VGL considera exclusivamente este valor final.
              </p>
            </>
          )}
          {destino === "negocio_perdido" && (
            <>
              <div className="space-y-1.5">
                <Label>Motivo da perda</Label>
                <Select
                  value={form.motivo_perda_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, motivo_perda_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivos
                      .filter((m) => m.ativo)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {campo("data_perda", "Data da perda", "date")}
              <div className="space-y-1.5">
                <Label htmlFor="descricao_perda">Descrição detalhada</Label>
                <Textarea
                  id="descricao_perda"
                  value={form.descricao_perda ?? ""}
                  onChange={(e) => setForm({ ...form, descricao_perda: e.target.value })}
                />
              </div>
            </>
          )}
          {(reabertura || retrocesso) && (
            <div className="space-y-1.5">
              <Label htmlFor="justificativa">
                {reabertura ? "Motivo da reabertura" : "Justificativa do retorno de etapa"}
              </Label>
              <Textarea
                id="justificativa"
                value={form.justificativa ?? ""}
                onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
              />
            </div>
          )}
          {(jornada.atingiu_fechamento || jornada.atingiu_contrato) && (
            <p className="text-xs text-muted-foreground">
              Esta jornada já passou por{" "}
              {jornada.atingiu_contrato ? "Contrato Assinado" : "Fechamento"} — o funil não conta a
              mesma etapa duas vezes.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Confirmar movimentação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
