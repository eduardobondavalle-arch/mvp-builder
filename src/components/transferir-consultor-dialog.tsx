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
  registrarAuditoria,
  registrarEvento,
  type Consultor,
  type Jornada,
  type MotivoTransferencia,
} from "@/lib/data";

export function TransferirConsultorDialog({
  jornada,
  consultores,
  motivos,
  onClose,
}: {
  jornada: Jornada;
  consultores: Consultor[];
  motivos: MotivoTransferencia[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [destino, setDestino] = useState("");
  const [motivoId, setMotivoId] = useState("");
  const [observacao, setObservacao] = useState("");

  const nomeDe = (id: string) => consultores.find((c) => c.id === id)?.nome ?? id;

  const transferir = useMutation({
    mutationFn: async () => {
      if (!destino) throw new Error("Selecione o consultor de destino.");
      if (destino === jornada.consultor_id)
        throw new Error("O consultor de destino deve ser diferente do atual.");
      const motivo = motivos.find((m) => m.id === motivoId);
      if (!motivo) throw new Error("Informe o motivo da transferência.");
      if (!observacao.trim())
        throw new Error("A transferência exige justificativa detalhada.");

      const { error } = await supabase
        .from("jornadas")
        .update({ consultor_id: destino } as never)
        .eq("id", jornada.id);
      if (error) throw new Error(error.message);

      await registrarEvento({
        jornada_id: jornada.id,
        tipo: "transferencia_consultor",
        justificativa: `${motivo.nome} — ${observacao.trim()}`,
        detalhes: {
          consultor_anterior: nomeDe(jornada.consultor_id),
          consultor_novo: nomeDe(destino),
          motivo: motivo.nome,
        },
      });

      await registrarAuditoria([
        {
          entidade: "jornada",
          entidade_id: jornada.id,
          referencia: `${jornada.cliente_nome} • CPF ${jornada.cpf}`,
          acao: "transferencia_consultor",
          campo: "consultor_id",
          valor_anterior: nomeDe(jornada.consultor_id),
          valor_novo: nomeDe(destino),
          justificativa: `${motivo.nome} — ${observacao.trim()}`,
        },
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jornadas"] });
      qc.invalidateQueries({ queryKey: ["eventos", jornada.id] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      toast.success(
        "Jornada transferida. Metas, rankings e indicadores passam a considerar o novo consultor.",
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir jornada de consultor</DialogTitle>
          <DialogDescription>
            {jornada.cliente_nome} • responsável atual: {nomeDe(jornada.consultor_id)}. Todos os
            indicadores desta jornada passam a compor o resultado do novo consultor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Novo consultor responsável</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o consultor" />
              </SelectTrigger>
              <SelectContent>
                {consultores
                  .filter((c) => c.ativo && c.id !== jornada.consultor_id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo da transferência</Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
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
          <div className="space-y-1.5">
            <Label htmlFor="obs">Justificativa detalhada</Label>
            <Textarea
              id="obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Contexto da transferência para registro na auditoria"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => transferir.mutate()} disabled={transferir.isPending}>
            Confirmar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
