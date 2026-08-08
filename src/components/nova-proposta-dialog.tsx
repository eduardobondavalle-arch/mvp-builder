import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  dataQueries,
  etapaLabel,
  registrarAuditoria,
  registrarEvento,
  type Canal,
  type Consultor,
  type Jornada,
} from "@/lib/data";
import { brl, dateBR } from "@/lib/format";

type NovaJornada = {
  cliente_nome: string;
  cpf: string;
  telefone: string;
  consultor_id: string;
  canal_id: string;
  data_primeiro_contato: string;
  data_entrada_crm: string;
  data_visita: string;
  data_proposta: string;
  imovel: string;
  valor_original: string;
  valor_proposta: string;
  percentual_intermediacao: string;
};

const vazio: NovaJornada = {
  cliente_nome: "",
  cpf: "",
  telefone: "",
  consultor_id: "",
  canal_id: "",
  data_primeiro_contato: "",
  data_entrada_crm: "",
  data_visita: "",
  data_proposta: "",
  imovel: "",
  valor_original: "",
  valor_proposta: "",
  percentual_intermediacao: "",
};

export function NovaPropostaDialog({
  open,
  onOpenChange,
  consultores,
  canais,
  jornadas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consultores: Consultor[];
  canais: Canal[];
  jornadas: Jornada[];
}) {
  const qc = useQueryClient();
  const [etapa, setEtapa] = useState<"cpf" | "existente" | "form">("cpf");
  const [cpf, setCpf] = useState("");
  const [form, setForm] = useState<NovaJornada>(vazio);
  const [justificativa, setJustificativa] = useState("");

  const existentes = jornadas.filter((j) => j.cpf === cpf.trim());

  const reset = () => {
    setEtapa("cpf");
    setCpf("");
    setForm(vazio);
    setJustificativa("");
  };

  const historico = useQuery({
    ...dataQueries.eventos(existentes[0]?.id ?? ""),
    enabled: etapa === "existente" && Boolean(existentes[0]),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const obrigatorios = Object.entries(form).filter(
        ([k, v]) => k !== "cpf" && !String(v).trim(),
      );
      if (obrigatorios.length) throw new Error("Todos os campos da etapa Proposta são obrigatórios.");

      const { data, error } = await supabase
        .from("jornadas")
        .insert({
          cliente_nome: form.cliente_nome,
          cpf: cpf.trim(),
          telefone: form.telefone,
          consultor_id: form.consultor_id,
          canal_id: form.canal_id,
          data_primeiro_contato: form.data_primeiro_contato,
          data_entrada_crm: form.data_entrada_crm,
          data_visita: form.data_visita,
          data_proposta: form.data_proposta,
          imovel: form.imovel,
          valor_original: Number(form.valor_original),
          valor_proposta: Number(form.valor_proposta),
          percentual_intermediacao: Number(form.percentual_intermediacao),
          etapa: "proposta",
          justificativa_nova_jornada: justificativa || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await registrarEvento({
        jornada_id: (data as { id: string }).id,
        tipo: justificativa ? "nova_jornada_mesmo_cpf" : "criacao",
        etapa_nova: "proposta",
        justificativa: justificativa || null,
      });

      await registrarAuditoria([
        {
          entidade: "jornada",
          entidade_id: (data as { id: string }).id,
          referencia: `${form.cliente_nome} • CPF ${cpf.trim()}`,
          acao: justificativa ? "nova_jornada_mesmo_cpf" : "criacao",
          campo: "etapa",
          valor_novo: "Proposta",
          justificativa: justificativa || null,
        },
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jornadas"] });
      toast.success("Jornada comercial criada na etapa Proposta.");
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof NovaJornada, v: string) => setForm({ ...form, [k]: v });

  const inputs: { key: keyof NovaJornada; label: string; type?: string }[] = [
    { key: "cliente_nome", label: "Nome do cliente" },
    { key: "telefone", label: "Telefone" },
    { key: "imovel", label: "Imóvel" },
    { key: "data_primeiro_contato", label: "Data do primeiro contato", type: "date" },
    { key: "data_entrada_crm", label: "Data de entrada no CRM", type: "date" },
    { key: "data_visita", label: "Data da visita", type: "date" },
    { key: "data_proposta", label: "Data da proposta", type: "date" },
    { key: "valor_original", label: "Valor original do imóvel (R$)", type: "number" },
    { key: "valor_proposta", label: "Valor da proposta (R$)", type: "number" },
    { key: "percentual_intermediacao", label: "Percentual de intermediação (%)", type: "number" },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        {etapa === "cpf" && (
          <>
            <DialogHeader>
              <DialogTitle>Nova proposta</DialogTitle>
              <DialogDescription>
                O sistema acompanha pessoas. Informe o CPF para verificar se já existe uma jornada
                comercial.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF do cliente</Label>
              <Input
                id="cpf"
                value={cpf}
                placeholder="000.000.000-00"
                onChange={(e) => setCpf(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!cpf.trim()) {
                    toast.error("Informe o CPF do cliente.");
                    return;
                  }
                  setEtapa(existentes.length ? "existente" : "form");
                }}
              >
                Continuar
              </Button>
            </DialogFooter>
          </>
        )}

        {etapa === "existente" && (
          <>
            <DialogHeader>
              <DialogTitle>Jornada existente para este CPF</DialogTitle>
              <DialogDescription>
                Escolha continuar a jornada atual ou abrir uma nova — nesse caso, a justificativa é
                obrigatória.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {existentes.map((j) => (
                <div key={j.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                  <p className="font-medium">{j.cliente_nome}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {j.imovel} • proposta {dateBR(j.data_proposta)} • {brl(j.valor_proposta)} •
                    etapa atual: {etapaLabel(j.etapa)}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border border-border p-4">
                <p className="label-caps mb-2">Histórico registrado</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {(historico.data ?? []).map((e) => (
                    <li key={e.id}>
                      {dateBR(e.created_at)} • {e.tipo}
                      {e.etapa_nova ? ` → ${etapaLabel(e.etapa_nova)}` : ""}
                    </li>
                  ))}
                  {(historico.data ?? []).length === 0 && <li>Sem eventos registrados.</li>}
                </ul>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="just">Justificativa para nova jornada</Label>
                <Textarea
                  id="just"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Continuar jornada existente
              </Button>
              <Button
                onClick={() => {
                  if (!justificativa.trim()) {
                    toast.error("A criação de nova jornada exige justificativa.");
                    return;
                  }
                  setEtapa("form");
                }}
              >
                Criar nova jornada
              </Button>
            </DialogFooter>
          </>
        )}

        {etapa === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Dados da proposta</DialogTitle>
              <DialogDescription>
                CPF {cpf} • todos os campos são obrigatórios para entrar na etapa Proposta.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Consultor responsável</Label>
                <Select
                  value={form.consultor_id}
                  onValueChange={(v) => set("consultor_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultores.filter((c) => c.ativo).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Canal de origem</Label>
                <Select value={form.canal_id} onValueChange={(v) => set("canal_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {canais.filter((c) => c.ativo).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inputs.map((i) => (
                <div key={i.key} className="space-y-1.5">
                  <Label htmlFor={i.key}>{i.label}</Label>
                  <Input
                    id={i.key}
                    type={i.type ?? "text"}
                    step={i.type === "number" ? "0.01" : undefined}
                    value={form[i.key]}
                    onChange={(e) => set(i.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEtapa("cpf")}>
                Voltar
              </Button>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                Criar jornada
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
