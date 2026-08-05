import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Save, Users } from "lucide-react";


import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { dataQueries, registrarAuditoria, type RegistroDiario } from "@/lib/data";
import { dateBR, pct } from "@/lib/format";

export const Route = createFileRoute("/registro-diario")({
  head: () => ({
    meta: [
      { title: "Registro Diário | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Lançamento diário de produtividade por consultor: leads recebidos, atendimentos, agendamentos e visitas, além dos pré leads da empresa.",
      },
      { property: "og:title", content: "Registro Diário | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "Base operacional do funil comercial da Adim Aluguéis, lançada dia a dia pela supervisão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegistroDiarioPage,
});

const hoje = () => new Date().toISOString().slice(0, 10);

type Linha = { leads: string; atendimentos: string; agendamentos: string; visitas: string };
const linhaVazia: Linha = { leads: "", atendimentos: "", agendamentos: "", visitas: "" };
const campos = ["leads", "atendimentos", "agendamentos", "visitas"] as const;

function RegistroDiarioPage() {
  const qc = useQueryClient();
  const [data, setData] = useState(hoje);
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [preLead, setPreLead] = useState("");

  const results = useQueries({
    queries: [
      dataQueries.consultores(),
      dataQueries.equipes(),
      dataQueries.registros(),
      dataQueries.preLeads(),
    ],
  });
  const consultores = (results[0].data ?? []).filter((c) => c.ativo);
  const equipes = results[1].data ?? [];
  const registros = results[2].data ?? [];
  const preLeads = results[3].data ?? [];

  const doDia = registros.filter((r) => r.data === data);
  const preLeadDoDia = preLeads.find((p) => p.data === data);

  useEffect(() => {
    const mapa: Record<string, Linha> = {};
    for (const r of doDia)
      mapa[r.consultor_id] = {
        leads: String(r.leads),
        atendimentos: String(r.atendimentos),
        agendamentos: String(r.agendamentos),
        visitas: String(r.visitas),
      };
    setLinhas(mapa);
    setPreLead(preLeadDoDia ? String(preLeadDoDia.quantidade) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, registros.length, preLeads.length]);

  const salvar = useMutation({
    mutationFn: async () => {
      const anteriores = new Map<string, RegistroDiario>(doDia.map((r) => [r.consultor_id, r]));
      const payload = Object.entries(linhas)
        .filter(([, l]) => campos.some((k) => String(l[k]).trim() !== ""))
        .map(([consultor_id, l]) => ({
          data,
          consultor_id,
          leads: Number(l.leads || 0),
          atendimentos: Number(l.atendimentos || 0),
          agendamentos: Number(l.agendamentos || 0),
          visitas: Number(l.visitas || 0),
        }));

      for (const p of payload) {
        if (p.atendimentos > p.leads)
          throw new Error("Atendimentos não podem exceder os leads recebidos no dia.");
        if (p.agendamentos > p.atendimentos)
          throw new Error("Agendamentos não podem exceder os atendimentos do dia.");
        if (p.visitas > p.agendamentos)
          throw new Error("Visitas não podem exceder os agendamentos do dia.");
      }

      if (payload.length) {
        const { error } = await supabase
          .from("registros_diarios")
          .upsert(payload as never, { onConflict: "consultor_id,data" });
        if (error) throw new Error(error.message);
      }

      if (preLead.trim()) {
        const { error } = await supabase
          .from("pre_leads_diarios")
          .upsert({ data, quantidade: Number(preLead) } as never, { onConflict: "data" });
        if (error) throw new Error(error.message);
      }

      const nomes = new Map(consultores.map((c) => [c.id, c.nome]));
      await registrarAuditoria([
        ...payload.flatMap((p) => {
          const antes = anteriores.get(p.consultor_id);
          return campos
            .filter((k) => String(antes?.[k] ?? "") !== String(p[k]))
            .map((k) => ({
              entidade: "registro_diario",
              referencia: `${nomes.get(p.consultor_id) ?? p.consultor_id} • ${data}`,
              acao: antes ? "edicao" : "criacao",
              campo: k,
              valor_anterior: antes ? String(antes[k]) : null,
              valor_novo: String(p[k]),
            }));
        }),
        ...(preLead.trim() && String(preLeadDoDia?.quantidade ?? "") !== preLead.trim()
          ? [
              {
                entidade: "pre_lead",
                referencia: data,
                acao: preLeadDoDia ? "edicao" : "criacao",
                campo: "quantidade",
                valor_anterior: preLeadDoDia ? String(preLeadDoDia.quantidade) : null,
                valor_novo: preLead.trim(),
              },
            ]
          : []),
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registros_diarios"] });
      qc.invalidateQueries({ queryKey: ["pre_leads"] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      toast.success(`Registro de ${dateBR(data)} salvo.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = campos.reduce(
    (acc, k) => ({
      ...acc,
      [k]: Object.values(linhas).reduce((s, l) => s + Number(l[k] || 0), 0),
    }),
    {} as Record<(typeof campos)[number], number>,
  );

  const equipeNome = new Map(equipes.map((e) => [e.id, e.nome]));

  return (
    <AppShell
      title="Registro Diário"
      subtitle="Lançamento operacional feito pela supervisão. É a única origem dos volumes de lead, atendimento, agendamento e visita — nada aqui é excluído, apenas corrigido."
      actions={
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          <Save className="size-4" /> Salvar o dia
        </Button>
      }
    >
      <div className="panel mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="data">Data do registro</Label>
          <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prelead">Pré leads da empresa (Laís)</Label>
          <Input
            id="prelead"
            type="number"
            min="0"
            value={preLead}
            placeholder="0"
            onChange={(e) => setPreLead(e.target.value)}
          />
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="label-caps">Consolidado do dia</p>
          <p className="mt-1 text-sm">
            {total.leads} leads → {total.atendimentos} atend. → {total.agendamentos} agend. →{" "}
            {total.visitas} visitas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lead → visita: {pct(total.leads ? (total.visitas / total.leads) * 100 : 0)}
          </p>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-border p-6 pb-4">
          <h2 className="text-lg font-semibold">Produtividade por consultor</h2>
          <p className="text-xs text-muted-foreground">
            {dateBR(data)} • {doDia.length ? "registro já lançado, alterações são auditadas" : "novo lançamento"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-6 py-3">Consultor</th>
                {campos.map((k) => (
                  <th key={k} className="label-caps px-3 py-3">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consultores.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="px-6 py-2 whitespace-nowrap">
                    {c.nome}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.equipe_id ? (equipeNome.get(c.equipe_id) ?? "—") : "—"}
                    </span>
                  </td>
                  {campos.map((k) => (
                    <td key={k} className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        className="h-9 w-20"
                        aria-label={`${k} de ${c.nome}`}
                        value={linhas[c.id]?.[k] ?? ""}
                        onChange={(e) =>
                          setLinhas((prev) => ({
                            ...prev,
                            [c.id]: { ...(prev[c.id] ?? linhaVazia), [k]: e.target.value },
                          }))
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {consultores.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-sm text-muted-foreground">
                    Cadastre consultores ativos para lançar a produtividade.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
