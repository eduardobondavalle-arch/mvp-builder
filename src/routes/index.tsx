import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Target, Handshake, Wallet, Percent, Clock, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FiltrosBar } from "@/components/filtros-bar";
import { Progress } from "@/components/ui/progress";
import { dataQueries } from "@/lib/data";
import { brl, pct } from "@/lib/format";
import {
  aplicarFiltros,
  calcularIndicadores,
  conversaoPorCanal,
  filtrosVazios,
  funil,
  rankingConsultores,
  rankingEquipes,
} from "@/lib/metrics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inteligência Comercial | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Painel executivo da operação de locação da Adim Aluguéis: VGL, contratos, ticket médio, funil, rankings e conversão por canal.",
      },
      { property: "og:title", content: "Inteligência Comercial | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "VGL, metas por equipe, funil comercial, rankings de consultores e conversão por canal em um único painel.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [filtros, setFiltros] = useState(filtrosVazios);
  const results = useQueries({
    queries: [
      dataQueries.jornadas(),
      dataQueries.consultores(),
      dataQueries.equipes(),
      dataQueries.canais(),
      dataQueries.ciclos(),
    ],
  });

  const jornadas = results[0].data ?? [];
  const consultores = results[1].data ?? [];
  const equipes = results[2].data ?? [];
  const canais = results[3].data ?? [];
  const ciclos = results[4].data ?? [];

  const filtradas = useMemo(
    () => aplicarFiltros(jornadas, filtros, consultores, ciclos),
    [jornadas, filtros, consultores, ciclos],
  );

  const ind = useMemo(() => calcularIndicadores(filtradas), [filtradas]);
  const dadosFunil = useMemo(() => funil(filtradas), [filtradas]);
  const equipesRank = useMemo(
    () => rankingEquipes(filtradas, consultores, equipes),
    [filtradas, consultores, equipes],
  );
  const consultoresRank = useMemo(
    () => rankingConsultores(filtradas, consultores, equipes),
    [filtradas, consultores, equipes],
  );
  const canaisConv = useMemo(() => conversaoPorCanal(filtradas, canais), [filtradas, canais]);

  const cicloAtivo = ciclos.find((c) => c.id === filtros.cicloId) ?? ciclos[0];
  const metaVglEquipe = cicloAtivo && equipes.length ? cicloAtivo.meta_vgl / equipes.length : 0;
  const metaContratosEquipe =
    cicloAtivo && equipes.length ? cicloAtivo.meta_contratos / equipes.length : 0;

  const kpis = [
    { label: "VGL realizado", value: brl(ind.vgl), icon: Wallet, hint: "Valor final dos contratos" },
    {
      label: "Contratos assinados",
      value: String(ind.contratos),
      icon: Handshake,
      hint: `${ind.emNegociacao} em negociação`,
    },
    { label: "Ticket médio", value: brl(ind.ticketMedio), icon: Target, hint: "Por contrato" },
    {
      label: "Receita de intermediação",
      value: brl(ind.intermediacao),
      icon: TrendingUp,
      hint: `Taxa média ${pct(ind.taxaMedia)}`,
    },
    {
      label: "Conversão proposta → contrato",
      value: pct(ind.conversao),
      icon: Percent,
      hint: `${ind.perdidos} negócios perdidos`,
    },
    {
      label: "Tempo médio da jornada",
      value: `${ind.tempoMedioJornada.toFixed(1)} dias`,
      icon: Clock,
      hint: "1º contato até assinatura",
    },
  ];

  return (
    <AppShell
      title="Inteligência Comercial"
      subtitle="Indicadores consolidados da operação. O VGL considera exclusivamente o valor final da locação na etapa Contrato Assinado."
    >
      <div className="panel mb-8 p-5">
        <FiltrosBar
          filtros={filtros}
          onChange={setFiltros}
          ciclos={ciclos}
          equipes={equipes}
          consultores={consultores}
          canais={canais}
        />
      </div>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="label-caps">{kpi.label}</span>
              <kpi.icon className="size-4 text-primary" />
            </div>
            <p className="metric-value mt-3">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </div>
        ))}
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Funil comercial</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Volume por etapa no recorte selecionado.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosFunil} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="etapa"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  width={86}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                  {dadosFunil.map((_, i) => (
                    <Cell key={i} fill={`var(--chart-${(i % 4) + 1})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Metas por equipe</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {cicloAtivo
              ? `${cicloAtivo.nome} • meta distribuída igualmente entre as equipes`
              : "Nenhum ciclo cadastrado"}
          </p>
          <div className="space-y-5">
            {equipesRank.map((e) => {
              const atingido = metaVglEquipe ? (e.vgl / metaVglEquipe) * 100 : 0;
              return (
                <div key={e.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{e.nome}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {brl(e.vgl)} / {brl(metaVglEquipe)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, atingido)} className="mt-2 h-2" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {pct(atingido)} da meta de VGL • {e.contratos} de{" "}
                    {Math.round(metaContratosEquipe)} contratos
                  </p>
                </div>
              );
            })}
            {equipesRank.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados no recorte selecionado.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="border-b border-border p-6 pb-4">
            <h2 className="text-lg font-semibold">Ranking de consultores</h2>
            <p className="text-xs text-muted-foreground">Ordenado por VGL realizado.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-6 py-3">Consultor</th>
                <th className="label-caps px-3 py-3">Prop.</th>
                <th className="label-caps px-3 py-3">Contr.</th>
                <th className="label-caps px-3 py-3">Conv.</th>
                <th className="label-caps px-6 py-3 text-right">VGL</th>
              </tr>
            </thead>
            <tbody>
              {consultoresRank.map((c, i) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="px-6 py-3">
                    <span className="mr-2 font-mono text-xs text-primary">{i + 1}º</span>
                    {c.nome}
                    <span className="ml-2 text-xs text-muted-foreground">{c.equipe}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{c.propostas}</td>
                  <td className="px-3 py-3 font-mono text-xs">{c.contratos}</td>
                  <td className="px-3 py-3 font-mono text-xs">{pct(c.conversao, 0)}</td>
                  <td className="px-6 py-3 text-right font-mono text-xs">{brl(c.vgl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-border p-6 pb-4">
            <h2 className="text-lg font-semibold">Conversão por canal de origem</h2>
            <p className="text-xs text-muted-foreground">Propostas convertidas em contrato.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-6 py-3">Canal</th>
                <th className="label-caps px-3 py-3">Prop.</th>
                <th className="label-caps px-3 py-3">Contr.</th>
                <th className="label-caps px-3 py-3">Conv.</th>
                <th className="label-caps px-6 py-3 text-right">VGL</th>
              </tr>
            </thead>
            <tbody>
              {canaisConv.map((c) => (
                <tr key={c.nome} className="border-b border-border/50 last:border-0">
                  <td className="px-6 py-3">{c.nome}</td>
                  <td className="px-3 py-3 font-mono text-xs">{c.propostas}</td>
                  <td className="px-3 py-3 font-mono text-xs">{c.contratos}</td>
                  <td className="px-3 py-3 font-mono text-xs">{pct(c.conversao, 0)}</td>
                  <td className="px-6 py-3 text-right font-mono text-xs">{brl(c.vgl)}</td>
                </tr>
              ))}
              {canaisConv.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-sm text-muted-foreground">
                    Sem propostas no recorte selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
