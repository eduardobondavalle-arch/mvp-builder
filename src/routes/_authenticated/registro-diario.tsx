import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Save, Users } from "lucide-react";


import { AppShell } from "@/components/app-shell";
import { SkeletonCards } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { filtrarConsultores, filtrarEquipes, useAcesso } from "@/lib/acesso";
import { dataQueries, registrarAuditoria, type RegistroDiario } from "@/lib/data";
import { dateBR, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/registro-diario")({
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
  const [equipeSel, setEquipeSel] = useState<string | null>(null);


  const acesso = useAcesso();
  const results = useQueries({
    queries: [
      dataQueries.consultores(),
      dataQueries.equipes(),
      dataQueries.registros(),
      dataQueries.preLeads(),
    ],
  });
  const consultores = filtrarConsultores(
    (results[0].data ?? []).filter((c) => c.ativo),
    acesso,
  );
  const equipes = filtrarEquipes(results[1].data ?? [], acesso);
  const registros = results[2].data ?? [];
  const preLeads = results[3].data ?? [];
  const carregando = results.some((r) => r.isLoading);

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

  const lancados = new Set(doDia.map((r) => r.consultor_id));
  const SEM_EQUIPE = "sem-equipe";

  const grupos = [
    ...equipes.map((e) => ({ id: e.id, nome: e.nome })),
    ...(consultores.some((c) => !c.equipe_id) ? [{ id: SEM_EQUIPE, nome: "Sem equipe" }] : []),
  ].map((g) => {
    const membros = consultores.filter((c) =>
      g.id === SEM_EQUIPE ? !c.equipe_id : c.equipe_id === g.id,
    );
    const pendentes = membros.filter((c) => !lancados.has(c.id));
    return { ...g, membros, pendentes: pendentes.length };
  });

  const grupoAtual = grupos.find((g) => g.id === equipeSel) ?? null;

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

      {carregando ? (
        <SkeletonCards total={2} />
      ) : !grupoAtual ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Selecione a unidade</h2>
            <p className="text-xs text-muted-foreground">
              {dateBR(data)} • unidades com pendência aparecem em destaque
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {grupos.map((g, gi) => {
              const pendente = g.pendentes > 0;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setEquipeSel(g.id)}
                  style={{ "--delay": `${gi * 45}ms` } as CSSProperties}
                  className={`panel rise-in press flex items-center justify-between gap-3 p-5 text-left hover:border-primary/60 hover:shadow-md ${
                    pendente ? "border-destructive/60 bg-destructive/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {pendente ? (
                      <AlertTriangle className="size-5 shrink-0 text-destructive" />
                    ) : (
                      <CheckCircle2 className="size-5 shrink-0 text-primary" />
                    )}
                    <div>
                      <p
                        className={`font-semibold ${pendente ? "text-destructive" : ""}`}
                      >
                        Equipe {g.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.membros.length} consultor(es) •{" "}
                        {pendente
                          ? `${g.pendentes} pendente(s) de preenchimento`
                          : "registro do dia completo"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
            {grupos.length === 0 && (
              <p className="panel p-6 text-sm text-muted-foreground">
                Cadastre equipes e consultores ativos para lançar a produtividade.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6 pb-4">
            <div className="flex items-center gap-3">
              <Users className="size-5 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Equipe {grupoAtual.nome}</h2>
                <p className="text-xs text-muted-foreground">
                  {dateBR(data)} •{" "}
                  {grupoAtual.pendentes
                    ? `${grupoAtual.pendentes} consultor(es) pendente(s)`
                    : "todos lançados, alterações são auditadas"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEquipeSel(null)}>
              <ArrowLeft className="size-4" /> Unidades
            </Button>
          </div>

          <ul className="divide-y divide-border/60">
            {grupoAtual.membros.map((c) => {
              const pendente = !lancados.has(c.id);
              return (
                <li
                  key={c.id}
                  className={`p-4 transition-colors duration-[180ms] sm:px-6 ${pendente ? "bg-destructive/5" : ""}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    {pendente ? (
                      <AlertTriangle className="size-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                    <span className={`text-sm font-medium ${pendente ? "text-destructive" : ""}`}>
                      {c.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {pendente ? "pendente" : "lançado"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {campos.map((k) => (
                      <div key={k} className="space-y-1">
                        <span className="label-caps">{k}</span>
                        <Input
                          type="number"
                          min="0"
                          className="h-9"
                          aria-label={`${k} de ${c.nome}`}
                          value={linhas[c.id]?.[k] ?? ""}
                          onChange={(e) =>
                            setLinhas((prev) => ({
                              ...prev,
                              [c.id]: { ...(prev[c.id] ?? linhaVazia), [k]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
            {grupoAtual.membros.length === 0 && (
              <li className="p-6 text-sm text-muted-foreground">
                Nenhum consultor ativo nesta unidade.
              </li>
            )}
          </ul>
        </section>
      )}
    </AppShell>

  );
}
