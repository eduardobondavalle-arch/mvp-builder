import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FilePdf, Spinner } from "@phosphor-icons/react";

import adimLogo from "@/assets/adim-logo.png";
import { AppShell } from "@/components/app-shell";
import { FunilVisual } from "@/components/funil-visual";
import { SkeletonKpis, SkeletonPanel } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filtrarConsultores, filtrarEquipes, useAcesso } from "@/lib/acesso";
import { dataQueries, etapaLabel } from "@/lib/data";
import { brl, dateBR, pct } from "@/lib/format";
import {
  aplicarFiltros,
  calcularIndicadores,
  conversaoLais,
  conversaoPorCanal,
  conversaoPorCanalAgrupado,
  conversoesPorEtapa,
  filtrarPreLeads,
  filtrarRegistros,
  filtrosVazios,
  funilCompleto,
  motivosDePerda,
  negociacoesParadas,
  produtividadeDiaria,
  rankingConsultores,
  rankingEquipes,
  somarRegistros,
} from "@/lib/metrics";
import { exportarElementoParaPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Relatórios diários, semanais, mensais e por ciclo da operação de locação: funil, metas, rankings, canais e jornadas, exportáveis em PDF.",
      },
      { property: "og:title", content: "Relatórios | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "Gere relatórios em PDF com o funil completo, metas, rankings por unidade e por consultor da Adim Aluguéis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RelatoriosPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const somaDias = (base: string, dias: number) =>
  iso(new Date(new Date(`${base}T12:00:00`).getTime() + dias * 86400000));

type Periodo = "ciclo_atual" | "semana" | "trimestre" | "semestre" | "personalizado";

const periodos: { key: Periodo; label: string }[] = [
  { key: "ciclo_atual", label: "Ciclo atual" },
  { key: "semana", label: "Semana" },
  { key: "trimestre", label: "Trimestre (últimos 3 ciclos completos)" },
  { key: "semestre", label: "Semestre (últimos 6 ciclos completos)" },
  { key: "personalizado", label: "Período personalizado" },
];

/** Segunda-feira da semana da data informada. */
const inicioSemana = (base: string) => {
  const d = new Date(`${base}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return somaDias(base, -dow);
};


function RelatoriosPage() {
  const acesso = useAcesso();
  const relatorioRef = useRef<HTMLDivElement>(null);
  const [gerando, setGerando] = useState(false);

  const [periodo, setPeriodo] = useState<Periodo>("ciclo_atual");

  const [de, setDe] = useState(somaDias(iso(new Date()), -6));
  const [ate, setAte] = useState(iso(new Date()));
  const [equipeId, setEquipeId] = useState("all");
  const [consultorId, setConsultorId] = useState("all");

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

  const jornadasTodas = results[0].data ?? [];
  const consultores = filtrarConsultores(results[1].data ?? [], acesso);
  const equipes = filtrarEquipes(results[2].data ?? [], acesso);
  const canais = results[3].data ?? [];
  const ciclos = results[4].data ?? [];
  const motivos = results[5].data ?? [];
  const registrosTodos = results[6].data ?? [];
  const preLeadsTodos = results[7].data ?? [];
  const metas = results[8].data ?? [];
  const carregando = results.some((r) => r.isLoading);

  const hoje = iso(new Date());

  // Ciclo atual: o que contém a data de hoje; se nenhum, o mais recente já iniciado.
  const ciclo = useMemo(() => {
    const atual = ciclos.find((c) => c.data_inicio <= hoje && c.data_fim >= hoje);
    return atual ?? ciclos.find((c) => c.data_inicio <= hoje) ?? ciclos[0];
  }, [ciclos, hoje]);
  const cicloId = ciclo?.id ?? "";

  // Ciclos completos (já encerrados), do mais recente para o mais antigo.
  const ciclosCompletos = useMemo(
    () => ciclos.filter((c) => c.data_fim < hoje).sort((a, b) => (a.data_inicio < b.data_inicio ? 1 : -1)),
    [ciclos, hoje],
  );

  const intervaloUltimosCiclos = (qtd: number) => {
    const sel = ciclosCompletos.slice(0, qtd);
    if (sel.length === 0) return { de: "", ate: "" };
    return {
      de: sel[sel.length - 1]!.data_inicio,
      ate: sel[0]!.data_fim,
    };
  };

  const intervalo = useMemo(() => {
    if (periodo === "ciclo_atual")
      return { de: ciclo?.data_inicio ?? "", ate: ciclo?.data_fim ?? "" };
    if (periodo === "semana") {
      const segunda = inicioSemana(hoje);
      const inicioCiclo = ciclo?.data_inicio ?? "";
      return { de: inicioCiclo && inicioCiclo > segunda ? inicioCiclo : segunda, ate: hoje };
    }
    if (periodo === "trimestre") return intervaloUltimosCiclos(3);
    if (periodo === "semestre") return intervaloUltimosCiclos(6);
    return { de, ate };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, ciclo, ciclosCompletos, hoje, de, ate]);

  const filtros = useMemo(
    () => ({
      ...filtrosVazios,
      cicloId: "all",
      equipeId,
      consultorId,
      de: intervalo.de,
      ate: intervalo.ate,
    }),
    [equipeId, consultorId, intervalo],
  );


  const jornadas = useMemo(
    () => aplicarFiltros(jornadasTodas, filtros, consultores, ciclos),
    [jornadasTodas, filtros, consultores, ciclos],
  );
  const registros = useMemo(
    () => filtrarRegistros(registrosTodos, filtros, consultores, ciclos),
    [registrosTodos, filtros, consultores, ciclos],
  );
  const preLeads = useMemo(
    () => filtrarPreLeads(preLeadsTodos, filtros, ciclos),
    [preLeadsTodos, filtros, ciclos],
  );

  const ind = calcularIndicadores(jornadas);
  const op = somarRegistros(registros);
  const etapasFunil = funilCompleto(jornadas, registros, preLeads);
  const conversoes = conversoesPorEtapa(jornadas, registros, preLeads);
  const lais = conversaoLais(preLeads, registros);
  const equipesRank = rankingEquipes(jornadas, registros, consultores, equipes, metas, cicloId);
  const consultoresRank = rankingConsultores(
    jornadas,
    registros,
    consultores,
    equipes,
    metas,
    cicloId,
  );
  const canaisConv = conversaoPorCanal(jornadas, canais);
  const canaisConvAgrupado = conversaoPorCanalAgrupado(jornadas, canais);
  const perdas = motivosDePerda(jornadas, motivos);
  const paradas = negociacoesParadas(jornadas);
  const serie = produtividadeDiaria(registros);
  const nomeConsultor = new Map(consultores.map((c) => [c.id, c.nome]));
  const nomeCanal = new Map(canais.map((c) => [c.id, c.nome]));
  const nomeMotivo = new Map(motivos.map((m) => [m.id, m.nome]));

  const consultoresDoRecorte =
    equipeId === "all" ? consultores : consultores.filter((c) => c.equipe_id === equipeId);

  const escopo = [
    equipeId === "all"
      ? "Todas as unidades"
      : `Unidade ${equipes.find((e) => e.id === equipeId)?.nome ?? "—"}`,
    consultorId === "all"
      ? "todos os consultores"
      : `consultor ${nomeConsultor.get(consultorId) ?? "—"}`,
  ].join(" • ");

  const tituloPeriodo = periodos.find((p) => p.key === periodo)?.label ?? "";

  async function baixar() {
    const el = relatorioRef.current;
    if (!el) return;
    setGerando(true);
    try {
      await exportarElementoParaPdf(
        el,
        `relatorio-adim-${periodo}-${intervalo.de || "inicio"}-a-${intervalo.ate || "fim"}`,
      );
      toast.success("Relatório em PDF gerado.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  const canalTop = canaisConvAgrupado[0];

  const kpis = [
    { label: "VGL Total", value: brl(ind.vglTotal) },
    { label: "VGL Assinado", value: brl(ind.vglAssinado) },
    { label: "Ticket médio", value: brl(ind.ticketMedio) },
    { label: "Intermediação média", value: pct(ind.taxaMedia) },
    { label: "Receita de intermediação", value: brl(ind.intermediacao) },
    {
      label: "Tempo médio da jornada do cliente",
      value: `${ind.tempoMedioJornada.toFixed(1)} dias`,
    },
    { label: "Em negociação", value: String(ind.emNegociacao) },
    { label: "Negócios perdidos", value: String(ind.perdidos) },
    { label: "Canal com maior conversão", value: canalTop?.nome ?? "—" },
    { label: "Propostas (cards criados)", value: String(ind.propostas) },
    { label: "Fechamentos", value: String(ind.fechamentos) },
    { label: "Contratos assinados", value: String(ind.contratos) },
    { label: "Conversão Laís (pré lead → lead)", value: pct(lais.conversao) },
    { label: "Visitas realizadas", value: String(op.visitas) },
  ];


  return (
    <AppShell
      title="Relatórios"
      subtitle="Monte o recorte desejado — diário, semanal, mensal, do ciclo completo ou personalizado — por unidade e por consultor, e exporte tudo em PDF com o layout do sistema."
      actions={
        <Button onClick={baixar} disabled={gerando || carregando}>
          {gerando ? (
            <Spinner size={16} weight="bold" className="animate-spin" />
          ) : (
            <FilePdf size={16} weight="fill" />
          )}
          {gerando ? "Gerando PDF…" : "Baixar PDF"}
        </Button>
      }
    >
      <div className="panel mb-6 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Tipo de relatório</Label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger>
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
        </div>

        {periodo === "personalizado" ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="de">De</Label>
              <Input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ate">Até</Label>
              <Input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Recorte de datas</Label>
            <p className="text-sm text-muted-foreground">
              {periodo === "ciclo_atual"
                ? `Ciclo ${ciclo?.nome ?? "—"}: ${dateBR(intervalo.de)} a ${dateBR(intervalo.ate)}`
                : periodo === "semana"
                  ? `Semana atual dentro do ciclo: ${dateBR(intervalo.de)} a ${dateBR(intervalo.ate)}`
                  : intervalo.de
                    ? `${periodo === "trimestre" ? "Últimos 3" : "Últimos 6"} ciclos completos: ${dateBR(intervalo.de)} a ${dateBR(intervalo.ate)}`
                    : "Ainda não há ciclos completos suficientes."}
            </p>
          </div>
        )}


        <div className="space-y-1.5">
          <Label>Unidade</Label>
          <Select
            value={equipeId}
            onValueChange={(v) => {
              setEquipeId(v);
              setConsultorId("all");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {equipes.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Consultor</Label>
          <Select value={consultorId} onValueChange={setConsultorId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os consultores</SelectItem>
              {consultoresDoRecorte.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.ativo ? c.nome : `${c.nome} (inativo)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {carregando ? (
        <div className="space-y-6">
          <SkeletonKpis />
          <SkeletonPanel />
        </div>
      ) : (
        <div ref={relatorioRef} className="space-y-6 rounded-2xl bg-background p-1">
          <div data-pdf-page className="space-y-4 bg-background p-4">
            <header className="panel flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <img
                  src={adimLogo}
                  alt="Adim Aluguéis"
                  className="h-10 w-auto"
                  width={205}
                  height={90}
                />
                <div>
                  <p className="label-caps">Relatório {tituloPeriodo}</p>
                  <h2 className="text-xl font-semibold">Inteligência Comercial</h2>
                  <p className="text-xs text-muted-foreground">{escopo}</p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  Período: <span className="font-mono">{dateBR(intervalo.de)}</span> a{" "}
                  <span className="font-mono">{dateBR(intervalo.ate)}</span>
                </p>

                {(periodo === "ciclo_atual" || periodo === "semana") && ciclo && (
                  <p>Ciclo {ciclo.nome}</p>
                )}

                <p>
                  Emitido em {dateBR(iso(new Date()))} por {acesso.email || "—"}
                </p>
              </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="panel p-6">
                <h3 className="mb-4 text-base font-semibold">Funil comercial completo</h3>
                <FunilVisual etapas={etapasFunil} />
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {conversoes.map((c) => (
                    <div key={`${c.de}-${c.para}`} className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">
                        {c.de} → {c.para}
                      </p>
                      <p className="font-mono text-sm font-semibold">{pct(c.conversao)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid content-start gap-3 sm:grid-cols-2">
                {kpis.map((k) => (
                  <div key={k.label} className="panel p-4">
                    <p className="label-caps">{k.label}</p>
                    <p className="mt-1 font-mono text-xl font-semibold">{k.value}</p>
                  </div>
                ))}
              </section>
            </div>
          </div>

          <div data-pdf-page className="space-y-4 bg-background p-4">
            <section className="panel overflow-hidden p-6">
              <h3 className="mb-4 text-base font-semibold">Desempenho por unidade</h3>
              <Tabela
                cabecalho={[
                  "Unidade",
                  "VGL Total",
                  "VGL Assinado",
                  "Meta VGL",
                  "% meta",
                  "Fechamentos",
                  "Contratos",
                  "Propostas",
                  "Visitas",
                ]}
                linhas={equipesRank.map((e) => [
                  e.nome,
                  brl(e.vglTotal),
                  brl(e.vglAssinado),
                  brl(e.metaVgl),
                  pct(e.pctMetaVgl, 0),
                  String(e.fechamentos),
                  String(e.contratos),
                  String(e.propostas),
                  String(e.visitas),
                ])}
              />
            </section>

            <section className="panel overflow-hidden p-6">
              <h3 className="mb-4 text-base font-semibold">Desempenho por consultor</h3>
              <Tabela
                cabecalho={[
                  "Consultor",
                  "Unidade",
                  "VGL Total",
                  "VGL Assinado",
                  "% meta",
                  "Fechamentos",
                  "Contratos",
                  "Propostas",
                  "Leads",
                  "Atend.",
                  "Agend.",
                  "Visitas",
                  "Conversão",
                ]}
                linhas={consultoresRank.map((c) => [
                  c.nome,
                  c.equipe,
                  brl(c.vglTotal),
                  brl(c.vglAssinado),
                  pct(c.pctMetaVgl, 0),
                  String(c.fechamentos),
                  String(c.contratos),
                  String(c.propostas),
                  String(c.leads),
                  String(c.atendimentos),
                  String(c.agendamentos),
                  String(c.visitas),
                  pct(c.conversao, 0),
                ])}
              />
            </section>
          </div>


          <div data-pdf-page className="space-y-4 bg-background p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="panel overflow-hidden p-6">
                <h3 className="mb-4 text-base font-semibold">Conversão por canal de origem</h3>
                <Tabela
                  cabecalho={["Canal", "Propostas", "Contratos", "Conversão", "VGL"]}
                  linhas={canaisConv.map((c) => [
                    c.nome,
                    String(c.propostas),
                    String(c.contratos),
                    pct(c.conversao, 0),
                    brl(c.vgl),
                  ])}
                />
              </section>

              <section className="panel overflow-hidden p-6">
                <h3 className="mb-4 text-base font-semibold">Motivos de perda</h3>
                <Tabela
                  cabecalho={["Motivo", "Ocorrências"]}
                  linhas={perdas.map((m) => [m.nome, String(m.total)])}
                />
              </section>
            </div>

            <section className="panel overflow-hidden p-6">
              <h3 className="mb-4 text-base font-semibold">Produtividade diária</h3>
              <Tabela
                cabecalho={["Data", "Leads", "Atendimentos", "Agendamentos", "Visitas", "Lead → visita"]}
                linhas={serie.map((d) => [
                  dateBR(d.data),
                  String(d.leads),
                  String(d.atendimentos),
                  String(d.agendamentos),
                  String(d.visitas),
                  pct(d.leads ? (d.visitas / d.leads) * 100 : 0, 0),
                ])}
                rodape={[
                  "Total",
                  String(op.leads),
                  String(op.atendimentos),
                  String(op.agendamentos),
                  String(op.visitas),
                  pct(op.leads ? (op.visitas / op.leads) * 100 : 0, 0),
                ]}
              />
            </section>
          </div>

          <div data-pdf-page className="space-y-4 bg-background p-4">
            <section className="panel overflow-hidden p-6">
              <h3 className="mb-4 text-base font-semibold">Jornadas do período</h3>
              <Tabela
                cabecalho={[
                  "Cliente",
                  "Imóvel",
                  "Consultor",
                  "Canal",
                  "Etapa",
                  "Proposta",
                  "Valor proposta",
                  "Valor final",
                  "Taxa",
                  "Motivo da perda",
                ]}
                linhas={jornadas.map((j) => [
                  j.cliente_nome,
                  j.imovel,
                  nomeConsultor.get(j.consultor_id) ?? "—",
                  nomeCanal.get(j.canal_id) ?? "—",
                  etapaLabel(j.etapa),
                  dateBR(j.data_proposta),
                  brl(j.valor_proposta),
                  j.valor_final == null ? "—" : brl(j.valor_final),
                  pct(j.percentual_intermediacao),
                  j.motivo_perda_id ? (nomeMotivo.get(j.motivo_perda_id) ?? "—") : "—",
                ])}
              />
            </section>
          </div>

          <div data-pdf-page className="space-y-4 bg-background p-4">
            <section className="panel overflow-hidden p-6">
              <h3 className="mb-4 text-base font-semibold">
                Negociações paradas há mais de 15 dias
              </h3>
              <Tabela
                cabecalho={["Cliente", "Consultor", "Etapa", "Última movimentação"]}
                linhas={paradas.map((j) => [
                  j.cliente_nome,
                  nomeConsultor.get(j.consultor_id) ?? "—",
                  etapaLabel(j.etapa),
                  dateBR(j.updated_at),
                ])}
              />
            </section>

            <p className="px-2 pb-2 text-center text-[11px] text-muted-foreground">
              Adim Aluguéis • Inteligência Comercial • documento gerado automaticamente pelo sistema
            </p>
          </div>
        </div>

      )}
    </AppShell>
  );
}

function Tabela({
  cabecalho,
  linhas,
  rodape,
}: {
  cabecalho: string[];
  linhas: string[][];
  rodape?: string[];
}) {
  if (linhas.length === 0)
    return <p className="text-sm text-muted-foreground">Sem dados no recorte selecionado.</p>;

  return (
    <div className="scroll-x-soft -mx-2">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60">
            {cabecalho.map((c) => (
              <th key={c} className="label-caps px-2 py-2 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {linha.map((celula, j) => (
                <td
                  key={j}
                  className={`px-2 py-2 align-top ${j === 0 ? "font-medium" : "font-mono text-xs text-muted-foreground"}`}
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape && (
          <tfoot>
            <tr className="border-t border-border">
              {rodape.map((c, i) => (
                <td
                  key={i}
                  className={`px-2 py-2 font-semibold ${i === 0 ? "" : "font-mono text-xs"}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
