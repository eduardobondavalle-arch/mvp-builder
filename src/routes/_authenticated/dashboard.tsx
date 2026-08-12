import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Target,
  Handshake,
  Wallet,
  Percent,
  Clock,
  TrendingUp,
  Bot,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SkeletonKpis, SkeletonPanel } from "@/components/skeletons";
import { FiltrosBar } from "@/components/filtros-bar";
import { FunilVisual } from "@/components/funil-visual";
import { Progress } from "@/components/ui/progress";
import { filtrarConsultores, filtrarEquipes, useAcesso } from "@/lib/acesso";
import { dataQueries, etapaLabel } from "@/lib/data";
import { brl, dateBR, pct } from "@/lib/format";
import {
  aplicarFiltros,
  calcularIndicadores,
  conversaoLais,
  conversaoPorCanal,
  conversaoPorCanalAgrupado,
  filtrarPreLeads,
  filtrarRegistros,
  filtrosVazios,
  funilCompleto,
  motivosDePerda,
  negociacoesParadas,
  produtividadeDiaria,
  rankingConsultores,
  rankingEquipes,

} from "@/lib/metrics";
import {
  cicloAtualDe,
  filtrosDoPeriodo,
  intervaloDoPeriodo,
  iso,
  periodos,
  somaDias,
  type Periodo,
} from "@/lib/periodos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Inteligência Comercial | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Painel executivo da operação de locação da Adim Aluguéis: VGL, contratos, funil completo, metas, rankings e conversão por canal.",
      },
      { property: "og:title", content: "Inteligência Comercial | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "Painel executivo da operação de locação da Adim Aluguéis: VGL, contratos, funil completo, metas, rankings e conversão por canal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const chartTooltip = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
  },
};

function Dashboard() {
  const acesso = useAcesso();
  const [periodo, setPeriodo] = useState<Periodo>("ciclo_atual");
  const hoje = iso(new Date());
  const [de, setDe] = useState(somaDias(hoje, -6));
  const [ate, setAte] = useState(hoje);
  const [escopo, setEscopo] = useState(filtrosVazios);
  const results = useQueries({
    queries: [
      dataQueries.jornadas(),
      dataQueries.consultores(),
      dataQueries.equipes(),
      dataQueries.canais(),
      dataQueries.ciclos(),
      dataQueries.motivos(),
      dataQueries.registros(),
      dataQueries.preLeads(),
      dataQueries.metas(),
    ],
  });

  const jornadas = results[0].data ?? [];
  const consultores = filtrarConsultores(results[1].data ?? [], acesso);
  const equipes = filtrarEquipes(results[2].data ?? [], acesso);
  const canais = results[3].data ?? [];
  const ciclos = results[4].data ?? [];
  const motivos = results[5].data ?? [];
  const registros = results[6].data ?? [];
  const preLeads = results[7].data ?? [];
  const metas = results[8].data ?? [];
  const carregando = results.some((r) => r.isLoading);

  const cicloAtivo = useMemo(() => cicloAtualDe(ciclos, hoje), [ciclos, hoje]);
  const cicloId = cicloAtivo?.id ?? "";

  const intervalo = useMemo(
    () => intervaloDoPeriodo(periodo, ciclos, hoje, { de, ate }),
    [periodo, ciclos, hoje, de, ate],
  );

  // Mesma lógica da aba de relatórios: presets de período + escopo por equipe/consultor/canal.
  const filtros = useMemo(
    () =>
      filtrosDoPeriodo(periodo, ciclos, hoje, { de, ate }, {
        equipeId: escopo.equipeId,
        consultorId: escopo.consultorId,
        canalId: escopo.canalId,
      }),
    [periodo, ciclos, hoje, de, ate, escopo],
  );

  const filtradas = useMemo(
    () => aplicarFiltros(jornadas, filtros, consultores, ciclos),
    [jornadas, filtros, consultores, ciclos],
  );
  const registrosFiltrados = useMemo(
    () => filtrarRegistros(registros, filtros, consultores, ciclos),
    [registros, filtros, consultores, ciclos],
  );
  const preLeadsFiltrados = useMemo(
    () => filtrarPreLeads(preLeads, filtros, ciclos),
    [preLeads, filtros, ciclos],
  );

  const ind = useMemo(() => calcularIndicadores(filtradas), [filtradas]);
  const dadosFunil = useMemo(
    () => funilCompleto(filtradas, registrosFiltrados, preLeadsFiltrados),
    [filtradas, registrosFiltrados, preLeadsFiltrados],
  );
  const lais = useMemo(
    () => conversaoLais(preLeadsFiltrados, registrosFiltrados),
    [preLeadsFiltrados, registrosFiltrados],
  );
  const equipesRank = useMemo(
    () => rankingEquipes(filtradas, registrosFiltrados, consultores, equipes, metas, cicloId),
    [filtradas, registrosFiltrados, consultores, equipes, metas, cicloId],
  );
  const consultoresRank = useMemo(
    () => rankingConsultores(filtradas, registrosFiltrados, consultores, equipes, metas, cicloId),
    [filtradas, registrosFiltrados, consultores, equipes, metas, cicloId],
  );
  const canaisConv = useMemo(() => conversaoPorCanal(filtradas, canais), [filtradas, canais]);
  const canaisAgrupado = useMemo(
    () => conversaoPorCanalAgrupado(filtradas, canais),
    [filtradas, canais],
  );
  const perdas = useMemo(() => motivosDePerda(filtradas, motivos), [filtradas, motivos]);
  const paradas = useMemo(() => negociacoesParadas(filtradas), [filtradas]);
  const serieDiaria = useMemo(() => produtividadeDiaria(registrosFiltrados), [registrosFiltrados]);
  const nomeConsultor = new Map(consultores.map((c) => [c.id, c.nome]));

  const metaVglTotal = equipesRank.reduce((s, e) => s + e.metaVgl, 0) || cicloAtivo?.meta_vgl || 0;
  const metaContratosTotal =
    equipesRank.reduce((s, e) => s + e.metaContratos, 0) || cicloAtivo?.meta_contratos || 0;

  const canalTop = canaisAgrupado[0];

  const kpis = [
    {
      label: "VGL Total",
      value: brl(ind.vglTotal),
      icon: Wallet,
      hint: metaVglTotal
        ? `${pct((ind.vglTotal / metaVglTotal) * 100, 0)} da meta`
        : "Fechamento + contrato assinado",
    },
    {
      label: "VGL em Proposta",
      value: brl(ind.vglProposta),
      icon: Wallet,
      hint: `${ind.propostasAbertas} cards na coluna Proposta`,
    },
    {
      label: "VGL Assinado",
      value: brl(ind.vglAssinado),
      icon: Handshake,
      hint: `${ind.contratos} contratos assinados`,
    },
    {
      label: "Ticket médio",
      value: brl(ind.ticketMedio),
      icon: Target,
      hint: "Média dos cards em fechamento e contrato",
    },
    {
      label: "Intermediação média",
      value: pct(ind.taxaMedia),
      icon: Percent,
      hint: "Média do % de intermediação das propostas",
    },
    {
      label: "Receita de intermediação",
      value: brl(ind.intermediacao),
      icon: TrendingUp,
      hint: "Fechamento + contrato assinado",
    },
    {
      label: "Tempo médio da jornada do cliente",
      value: `${ind.tempoMedioJornada.toFixed(1)} dias`,
      icon: Clock,
      hint: "Da entrada do cliente ao envio da proposta",
    },
    {
      label: "Em negociação",
      value: String(ind.emNegociacao),
      icon: RefreshCcw,
      hint: "Cards em proposta e fechamento",
    },
    {
      label: "Negócios perdidos",
      value: String(ind.perdidos),
      icon: AlertTriangle,
      hint: `${ind.reabertas} reabertas • conversão ${pct(ind.conversao, 0)}`,
    },
    {
      label: "Canal com maior conversão",
      value: canalTop?.nome ?? "—",
      icon: Bot,
      hint: canalTop
        ? `${pct(canalTop.conversao, 0)} • ${canalTop.contratos}/${canalTop.propostas} propostas`
        : "Sem propostas no recorte",
    },
  ];


  return (
    <AppShell
      title="Inteligência Comercial"
      subtitle="Indicadores consolidados da operação. Proposta em diante vem dos cards do Painel de Propostas: o VGL Total soma os cards em Fechamento e Contrato Assinado; o VGL Assinado considera apenas os contratos assinados."
    >
      <div className="panel mb-8 space-y-3 p-5">
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="label-caps mb-1.5 block">Período</span>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {periodo === "personalizado" && (
            <>
              <label className="block">
                <span className="label-caps mb-1.5 block">De</span>
                <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
              </label>
              <label className="block">
                <span className="label-caps mb-1.5 block">Até</span>
                <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
              </label>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {intervalo.de && intervalo.ate
              ? `${dateBR(intervalo.de)} a ${dateBR(intervalo.ate)}`
              : "Base completa"}
            {periodo === "semana" || periodo === "personalizado"
              ? " • cards pela data da proposta"
              : " • cards pela data de assinatura/perda"}
          </p>
        </div>
        <FiltrosBar
          filtros={filtros}
          onChange={setEscopo}
          ciclos={ciclos}
          equipes={equipes}
          consultores={consultores}
          canais={canais}
          mostrarPeriodo={false}
        />
      </div>

      {carregando && (
        <>
          <SkeletonKpis />
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <SkeletonPanel linhas={6} />
            <SkeletonPanel linhas={4} />
          </div>
          <SkeletonPanel className="mb-8" linhas={5} />
        </>
      )}

      {!carregando && (
      <>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className="panel rise-in p-5"
            style={{ "--delay": `${i * 35}ms` } as CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="label-caps">{kpi.label}</span>
              <kpi.icon className="size-4 shrink-0 text-primary" />
            </div>
            <p className="metric-value mt-3">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
          </div>
        ))}
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Funil comercial completo</h2>
          <p className="mb-5 text-xs text-muted-foreground">
            Pré Lead e Lead → Visita vêm do registro diário; Proposta → Contrato vêm da jornada
            comercial. À direita, a conversão em relação à etapa anterior.
          </p>
          <FunilVisual etapas={dadosFunil} />
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Metas por equipe</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {cicloAtivo
              ? `${cicloAtivo.nome} • fechamento + contrato assinado no recorte`
              : "Nenhum ciclo cadastrado"}
          </p>
          <div className="space-y-5">
            {equipesRank.map((e) => (
              <div key={e.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{e.nome}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {brl(e.vglTotal)} / {brl(e.metaVgl)}
                  </span>
                </div>
                <Progress value={Math.min(100, e.pctMetaVgl)} className="mt-2 h-2" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {pct(e.pctMetaVgl)} da meta de VGL • {e.fechamentos} de {e.metaContratos} contratos (
                  {pct(e.pctMetaContratos, 0)}) • {e.visitas} visitas
                </p>
              </div>
            ))}
            {equipesRank.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados no recorte selecionado.</p>
            )}
          </div>
        </section>
      </div>

      <section className="panel mb-8 p-6">
        <h2 className="text-lg font-semibold">Produtividade diária</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Evolução de leads, atendimentos, agendamentos e visitas no período.
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serieDiaria} margin={{ left: 0, right: 16 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="data"
                tickFormatter={dateBR}
                stroke="var(--muted-foreground)"
                fontSize={12}
              />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip {...chartTooltip} labelFormatter={(v) => dateBR(String(v))} />
              {(["leads", "atendimentos", "agendamentos", "visitas"] as const).map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={`var(--chart-${i + 1})`}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={280}
                  animationEasing="ease-out"
                  name={k[0]!.toUpperCase() + k.slice(1)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {serieDiaria.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum registro diário lançado no recorte selecionado.
          </p>
        )}
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="border-b border-border p-6 pb-4">
            <h2 className="text-lg font-semibold">Ranking de consultores</h2>
            <p className="text-xs text-muted-foreground">
              Ordenado por VGL realizado, com atingimento individual de meta.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps px-6 py-3">Consultor</th>
                  <th className="label-caps px-3 py-3">Visitas</th>
                  <th className="label-caps px-3 py-3">Prop.</th>
                  <th className="label-caps px-3 py-3">Contr.</th>
                  <th className="label-caps px-3 py-3">Conv.</th>
                  <th className="label-caps px-3 py-3">% meta</th>
                  <th className="label-caps px-6 py-3 text-right">VGL</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {consultoresRank.map((c, i) => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="mr-2 font-mono text-xs text-primary">{i + 1}º</span>
                      {c.nome}
                      <span className="ml-2 text-xs text-muted-foreground">{c.equipe}</span>
                      {!c.ativo && (
                        <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{c.visitas}</td>
                    <td className="px-3 py-3 font-mono text-xs">{c.propostas}</td>
                    <td className="px-3 py-3 font-mono text-xs">{c.contratos}</td>
                    <td className="px-3 py-3 font-mono text-xs">{pct(c.conversao, 0)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{pct(c.pctMetaVgl, 0)}</td>
                    <td className="px-6 py-3 text-right font-mono text-xs">{brl(c.vgl)}</td>
                  </tr>
                ))}
                {consultoresRank.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 text-sm text-muted-foreground">
                      Nenhum consultor cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-border p-6 pb-4">
            <h2 className="text-lg font-semibold">Conversão por canal de origem</h2>
            <p className="text-xs text-muted-foreground">Propostas convertidas em contrato.</p>
          </div>
          <div className="overflow-x-auto">
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
              <tbody className="stagger-rows">
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
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Motivos de perda</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Distribuição das jornadas na etapa Negócio Perdido.
          </p>
          <ul className="space-y-3">
            {perdas.map((m) => (
              <li key={m.nome}>
                <div className="flex justify-between text-sm">
                  <span>{m.nome}</span>
                  <span className="font-mono text-xs text-muted-foreground">{m.total}</span>
                </div>
                <Progress
                  value={(m.total / (perdas[0]?.total || 1)) * 100}
                  className="mt-1.5 h-1.5"
                />
              </li>
            ))}
            {perdas.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma perda no recorte.</li>
            )}
          </ul>
        </section>

        <section className="panel p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="size-4 text-chart-5" /> Negociações paradas
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Jornadas em Proposta ou Fechamento sem movimentação há mais de 15 dias.
          </p>
          <ul className="space-y-3">
            {paradas.slice(0, 8).map((j) => (
              <li key={j.id} className="flex justify-between gap-3 text-sm">
                <span>
                  {j.cliente_nome}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {nomeConsultor.get(j.consultor_id) ?? "—"} • {etapaLabel(j.etapa)}
                  </span>
                </span>
                <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                  {dateBR(j.updated_at)}
                </span>
              </li>
            ))}
            {paradas.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nenhuma negociação parada no recorte.
              </li>
            )}
          </ul>
        </section>
      </div>
      </>
      )}
    </AppShell>
  );
}
