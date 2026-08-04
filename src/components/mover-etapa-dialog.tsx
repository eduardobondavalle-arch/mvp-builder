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
import { registrarEvento, type Etapa, type Jornada, type MotivoPerda } from "@/lib/data";
import { ETAPAS } from "@/lib/data";

type Patch = Record<string, string | number | null>;

type CampoForm =
  | "data_fechamento"
  | "valor_atualizado"
  | "data_envio_contrato"
  | "data_assinatura"
  | "valor_final"
  | "motivo_perda_id"
  | "descricao_perda"
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

  const mutation = useMutation({
    mutationFn: async () => {
      const patch: Patch = { etapa: destino };

      if (destino === "fechamento") {
        if (!form.data_fechamento || !form.valor_atualizado)
          throw new Error("Informe a data do envio do fechamento e o valor atual da proposta.");
        patch.data_fechamento = form.data_fechamento;
        patch.valor_atualizado = Number(form.valor_atualizado);
      }
      if (destino === "contrato_assinado") {
        if (!form.data_envio_contrato || !form.data_assinatura || !form.valor_final)
          throw new Error("Informe as datas do contrato e o valor final da locação.");
        patch.data_envio_contrato = form.data_envio_contrato;
        patch.data_assinatura = form.data_assinatura;
        patch.valor_final = Number(form.valor_final);
      }
      if (destino === "negocio_perdido") {
        if (!form.motivo_perda_id || !form.descricao_perda)
          throw new Error("Informe o motivo da perda e a descrição detalhada.");
        patch.motivo_perda_id = form.motivo_perda_id;
        patch.descricao_perda = form.descricao_perda;
      }
      if (jornada.etapa === "negocio_perdido" && destino !== "negocio_perdido") {
        if (!form.justificativa) throw new Error("Toda reabertura exige justificativa.");
      }

      const { error } = await supabase.from("jornadas").update(patch as never).eq("id", jornada.id);
      if (error) throw new Error(error.message);

      await registrarEvento({
        jornada_id: jornada.id,
        tipo: jornada.etapa === "negocio_perdido" ? "reabertura" : "movimentacao",
        etapa_anterior: jornada.etapa,
        etapa_nova: destino,
        justificativa: form.justificativa ?? null,
        detalhes: patch as Record<string, unknown>,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jornadas"] });
      qc.invalidateQueries({ queryKey: ["eventos", jornada.id] });
      toast.success(`Jornada movida para ${label}.`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campo = (key: CampoForm, label: string, type: string) => (
    <div key={key} className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
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
      <DialogContent className="max-w-lg">
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
                    {motivos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
          {jornada.etapa === "negocio_perdido" && destino !== "negocio_perdido" && (
            <div className="space-y-1.5">
              <Label htmlFor="justificativa">Motivo da reabertura</Label>
              <Textarea
                id="justificativa"
                value={form.justificativa ?? ""}
                onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
              />
            </div>
          )}
          {destino === "proposta" && jornada.etapa !== "negocio_perdido" && (
            <p className="text-sm text-muted-foreground">
              A jornada voltará para a etapa Proposta. O histórico anterior permanece registrado.
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
