import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Handshake,
  Wallet,
  Percent,
  ArrowsClockwise,
  Television,
  Target,
} from "@phosphor-icons/react";

import { FunilVisual } from "@/components/funil-visual";
import { Progress } from "@/components/ui/progress";
import { filtrarConsultores, filtrarEquipes, useAcesso } from "@/lib/acesso";
import { dataQueries } from "@/lib/data";
import { brl, pct } from "@/lib/format";
import {
  aplicarFiltros,
  calcularIndicadores,
  filtrarPreLeads,
  filtrarRegistros,
  funilCompleto,
  rankingConsultores,
  rankingEquipes,
} from "@/lib/metrics";
import { cicloAtualDe, filtrosDoPeriodo, iso, type Periodo } from "@/lib/periodos";
import adimLogo from "@/assets/adim-logo.png";

export const Route = createFileRoute("/_authenticated/tv")({
  head: () => ({
    meta: [
      { title: "TV | Adim Aluguéis" },
      {
        name: "description",
        content: "Painel para TV com funil, VGL, ranking de consultores e metas das unidades da Adim Aluguéis.",
      },
      { property: "og:title", content: "TV | Adim Aluguéis" },
      {
        property: "og:description",
        content: "Painel para TV com funil, VGL, ranking de consultores e metas das unidades da Adim Aluguéis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TvPage,
});

const PERIODO: Periodo = "ciclo_atual";

function TvPage() {
  const acesso = useAcesso();
  const [agora, setAgora] = useState(() => iso(new Date()));
  const [equipeSel, setEquipeSel] = useState<string>("all");

  // Atualiza o recorte a cada minuto para manter o painel sempre fresco.
  useEffect(() => {
    const id = setInterval(() => setAgora(iso(new Date())), 60000);
    return () => clearInterval(id);
  }, []);

  const results = useQueries({
    queries: [
      dataQueries.jornadas(),
      dataQueries.consultores(),
      dataQueries.equipes(),
      dataQueries.canais(),
      dataQueries.ciclos(),
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
  const registrosTodos = results[5].data ?? [];
  const preLeadsTodos = results[6].data ?? [];
  const metas = results[7].data ?? [];
  const carregando = results.some((r) => r.isLoading);

  const hoje = agora;
  const cicloAtivo = useMemo(() => cicloAtualDe(ciclos, hoje), [ciclos, hoje]);
  const cicloId = cicloAtivo?.id ?? "";

  const filtros = useMemo(
    () => ({ ...filtrosDoPeriodo(PERIODO, ciclos, hoje, { de: "", ate: "" }), equipeId: equipeSel }),
    [ciclos, hoje, equipeSel],
  );

  const consultoresEscopo = useMemo(
    () => (equipeSel === "all" ? consultores : consultores.filter((c) => c.equipe_id === equipeSel)),
    [consultores, equipeSel],
  );
  const equipesEscopo = useMemo(
    () => (equipeSel === "all" ? equipes : equipes.filter((e) => e.id === equipeSel)),
    [equipes, equipeSel],
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

  const ind = useMemo(() => calcularIndicadores(jornadas), [jornadas]);
  const etapasFunil = useMemo(
    () => funilCompleto(jornadas, registros, preLeads),
    [jornadas, registros, preLeads],
  );
  const consultoresRank = useMemo(
    () => rankingConsultores(jornadas, registros, consultoresEscopo, equipesEscopo, metas, cicloId),
    [jornadas, registros, consultoresEscopo, equipesEscopo, metas, cicloId],
  );
  const equipesRank = useMemo(
    () => rankingEquipes(jornadas, registros, consultoresEscopo, equipesEscopo, metas, cicloId),
    [jornadas, registros, consultoresEscopo, equipesEscopo, metas, cicloId],
  );

  const kpis = [
    { label: "VGL Total", value: brl(ind.vglTotal), icon: Wallet },
    { label: "VGL Assinado", value: brl(ind.vglAssinado), icon: Handshake },
    { label: "Ticket Médio", value: brl(ind.ticketMedio), icon: Target },
    { label: "Intermediação Média", value: pct(ind.taxaMedia), icon: Percent },
    { label: "Contratos em Negociação", value: String(ind.emNegociacao), icon: ArrowsClockwise },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 text-foreground lg:p-6">
      <header className="mb-4 flex items-center justify-between lg:mb-6">
        <div className="flex items-center gap-3">
          <img
            src={adimLogo}
            alt="Adim Aluguéis"
            className="h-10 w-auto shrink-0"
            width={205}
            height={90}
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
              Painel da TV
            </h1>
            <p className="text-xs text-muted-foreground lg:text-sm">
              {cicloAtivo ? `${cicloAtivo.nome} • ` : ""}
              atualizado a cada minuto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-secondary/50 p-1">
            {[{ id: "all", nome: "Todas" }, ...equipes.map((e) => ({ id: e.id, nome: e.nome }))].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEquipeSel(opt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95 lg:text-sm ${
                  equipeSel === opt.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.nome}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Television size={24} weight="duotone" />
            <span className="hidden text-sm sm:inline">{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </header>

      {carregando ? (
        <div className="grid flex-1 place-items-center text-muted-foreground">
          <p className="text-lg">Carregando painel…</p>
        </div>
      ) : (
        <div className="grid flex-1 gap-4 lg:grid-cols-[55%_1fr] lg:gap-6">
          {/* Esquerda — Funil */}
          <section className="panel flex flex-col p-5 lg:p-8">
            <h2 className="mb-2 text-lg font-semibold lg:text-xl">Funil atualizado</h2>
            <p className="mb-6 text-xs text-muted-foreground lg:text-sm">
              Pré Lead → Visita vêm do registro diário; Proposta → Contrato vêm do Painel de Propostas.
            </p>
            <div className="flex w-full flex-1 flex-col justify-center">
              <FunilVisual etapas={etapasFunil} size="lg" />
            </div>
          </section>

          {/* Direita */}
          <div className="grid grid-rows-[auto_1fr] gap-4 lg:gap-6">
            {/* Superior — KPIs */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="panel flex flex-col justify-between p-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <kpi.icon size={20} weight="duotone" className="shrink-0 text-primary" />
                    <span className="text-[11px] font-medium uppercase tracking-wide lg:text-xs">
                      {kpi.label}
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-xl font-semibold lg:text-2xl">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </section>

            {/* Inferior — Ranking e Metas */}
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <section className="panel flex flex-col p-5 lg:p-6">
                <h2 className="mb-4 text-lg font-semibold lg:text-xl">Ranking de consultores</h2>
                <div className="flex-1 overflow-auto">
                  {consultoresRank.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem consultores no recorte.</p>
                  ) : (
                    <div className="space-y-3">
                      {consultoresRank.slice(0, 10).map((c, i) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{c.nome}</p>
                              <p className="text-xs text-muted-foreground">{c.equipe}</p>
                            </div>
                          </div>
                          <p className="shrink-0 font-mono text-sm font-semibold">
                            {brl(c.vgl)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel flex flex-col p-5 lg:p-6">
                <h2 className="mb-4 text-lg font-semibold lg:text-xl">% da meta das unidades</h2>
                <div className="flex-1 overflow-auto">
                  {equipesRank.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem unidades no recorte.</p>
                  ) : (
                    <div className="space-y-5">
                      {equipesRank.map((e) => (
                        <div key={e.id}>
                          <div className="flex items-baseline justify-between text-sm lg:text-base">
                            <span className="font-medium">{e.nome}</span>
                            <span className="font-mono text-xs text-muted-foreground lg:text-sm">
                              {brl(e.vglTotal)} / {brl(e.metaVgl)}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(100, e.pctMetaVgl)}
                            className="mt-2 h-3"
                          />
                          <p className="mt-1.5 text-xs text-muted-foreground lg:text-sm">
                            {pct(e.pctMetaVgl)} da meta de VGL • {e.fechamentos} de{" "}
                            {e.metaContratos} contratos ({pct(e.pctMetaContratos, 0)})
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
