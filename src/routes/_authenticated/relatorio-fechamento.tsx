import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { BarChart3, Download, Timer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { BoardProvider, useBoard } from "@/fechamento/components/providers/board-provider";
import {
  closingReport,
  type ClosingFilters,
  type DurationMetric,
} from "@/fechamento/domain/closing-report";
import { STAGES, type Stage } from "@/fechamento/domain/types";
import { platform } from "@/fechamento/host";

export const Route = createFileRoute("/_authenticated/relatorio-fechamento")({
  head: () => ({ meta: [{ title: "Relatório de Fechamento | Adim Aluguéis" }] }),
  component: () => (
    <AppShell
      title="Relatório de Fechamento"
      subtitle="Acompanhe todos os cards que chegaram a Fechamento Enviado: conversão, tempo nas etapas, SLA, tarefas e gargalos."
    >
      <BoardProvider>
        <ClosingReportPage />
      </BoardProvider>
    </AppShell>
  ),
});

const duration = (ms: number | null) => {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}min`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};
const percent = (part: number, total: number) =>
  total ? `${Math.round((part / total) * 100)}%` : "—";
const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const stageLabel = (stage: Stage) => STAGES.find((item) => item.id === stage)?.name ?? stage;

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string;
  value: string;
  note: string;
  icon?: typeof Timer;
}) {
  return (
    <article className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
        <span>{title}</span>
        {Icon && <Icon size={17} />}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}

function DurationTable({
  rows,
  task = false,
}: {
  rows: (DurationMetric & { stage?: Stage })[];
  task?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] text-left text-xs">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className="px-3 py-3 font-semibold">{task ? "Tarefa / etapa" : "Etapa"}</th>
            <th className="px-3 py-3 font-semibold">Cards</th>
            <th className="px-3 py-3 font-semibold">Passagens</th>
            <th className="px-3 py-3 font-semibold">Encerradas</th>
            <th className="px-3 py-3 font-semibold">Média</th>
            <th className="px-3 py-3 font-semibold">Mediana</th>
            <th className="px-3 py-3 font-semibold">P90</th>
            <th className="px-3 py-3 font-semibold">Tempo acumulado</th>
            <th className="px-3 py-3 font-semibold">Abertas</th>
            <th className="px-3 py-3 font-semibold">SLA vencido</th>
            {task && <th className="px-3 py-3 font-semibold">Retrabalho</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-3 font-semibold">
                {row.name}
                {row.stage && (
                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                    {stageLabel(row.stage)}
                  </span>
                )}
              </td>
              <td className="px-3 py-3">{row.cards}</td>
              <td className="px-3 py-3">{row.visits}</td>
              <td className="px-3 py-3">{row.finished}</td>
              <td className="px-3 py-3 font-semibold">{duration(row.averageMs)}</td>
              <td className="px-3 py-3">{duration(row.medianMs)}</td>
              <td className="px-3 py-3">{duration(row.p90Ms)}</td>
              <td className="px-3 py-3">{duration(row.totalMs)}</td>
              <td className="px-3 py-3">{row.open}</td>
              <td className="px-3 py-3">{row.overdue}</td>
              {task && <td className="px-3 py-3">{row.rework}</td>}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={task ? 11 : 10} className="px-3 py-5 text-center text-muted-foreground">
                Sem registros neste período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClosingReportPage() {
  const { data, now } = useBoard();
  const [filters, setFilters] = useState<ClosingFilters>({
    from: "",
    to: "",
    unitId: "",
    consultantId: "",
  });
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scope = platform()?.commercialScope;
  const allowedUnitIds = scope && !scope.companyWide ? scope.unitIds : undefined;
  const report = useMemo(
    () => closingReport(data, { ...filters, ...(allowedUnitIds ? { allowedUnitIds } : {}) }, now),
    [data, filters, now, allowedUnitIds],
  );
  const units = (data.tables["equipes"] ?? []).filter(
    (unit) => !scope || scope.companyWide || scope.unitIds.includes(unit.id),
  );
  const consultants = (data.tables["consultores"] ?? []).filter(
    (consultant) =>
      (!allowedUnitIds || allowedUnitIds.includes(String(consultant["equipe_id"]))) &&
      (!filters.unitId || consultant["equipe_id"] === filters.unitId),
  );
  const unitName = new Map(
    (data.tables["equipes"] ?? []).map((row) => [row.id, String(row["nome"])]),
  );
  const consultantName = new Map(
    (data.tables["consultores"] ?? []).map((row) => [row.id, String(row["nome"])]),
  );
  const reasonName = new Map(
    (data.tables["motivos_perda"] ?? []).map((row) => [row.id, String(row["nome"])]),
  );
  const funnel = [
    ["Fechamento enviado", report.total],
    ["Passaram por Aprovado", report.approvedEver],
    ["Passaram por Entrega das Chaves", report.keysEver],
    ["Concluídos", report.concluded],
  ] as const;
  async function exportPdf() {
    if (!contentRef.current || exporting) return;
    setExporting(true);
    try {
      const { exportarElementoParaPdf } = await import("@/lib/pdf");
      await exportarElementoParaPdf(contentRef.current, "relatorio-fechamento-adim.pdf");
    } catch {
      toast.error("Não foi possível exportar o PDF.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <label className="field-label min-w-36 flex-1">
          Entrada em Fechamento: de
          <input
            type="date"
            className="input mt-1"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => setFilters((old) => ({ ...old, from: event.target.value }))}
          />
        </label>
        <label className="field-label min-w-36 flex-1">
          Até
          <input
            type="date"
            className="input mt-1"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => setFilters((old) => ({ ...old, to: event.target.value }))}
          />
        </label>
        <label className="field-label min-w-44 flex-1">
          Unidade
          <select
            className="input mt-1"
            value={filters.unitId}
            onChange={(event) =>
              setFilters((old) => ({ ...old, unitId: event.target.value, consultantId: "" }))
            }
          >
            <option value="">Todas as unidades</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {String(unit["nome"])}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label min-w-44 flex-1">
          Consultor
          <select
            className="input mt-1"
            value={filters.consultantId}
            onChange={(event) =>
              setFilters((old) => ({ ...old, consultantId: event.target.value }))
            }
          >
            <option value="">Todos os consultores</option>
            {consultants.map((consultant) => (
              <option key={consultant.id} value={consultant.id}>
                {String(consultant["nome"])}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button-secondary"
          disabled={exporting}
          onClick={() => void exportPdf()}
        >
          <Download size={15} />
          {exporting ? "Exportando…" : "Exportar PDF"}
        </button>
      </div>

      <div ref={contentRef} className="space-y-6">
        <p className="text-xs text-muted-foreground">
          Amostra: primeira entrada em Fechamento Enviado no período escolhido. Os tempos usam
          passagens encerradas; filas abertas e cards de teste excluídos são tratados separadamente.
          {report.missingClosingHistory > 0 &&
            ` ${report.missingClosingHistory} card(s) importado(s) não têm histórico completo da etapa; permanecem nos totais, mas não nas médias sem registro.`}
        </p>
        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Indicadores do fechamento"
        >
          <MetricCard
            title="Cards analisados"
            value={String(report.total)}
            note="100% dos cards elegíveis"
            icon={BarChart3}
          />
          <MetricCard
            title="Em andamento"
            value={String(report.active)}
            note={`${report.overdueOpen} com SLA da etapa vencido`}
            icon={Timer}
          />
          <MetricCard
            title="Concluídos"
            value={`${report.concluded} · ${percent(report.concluded, report.total)}`}
            note={`${report.lost} cancelados ou reprovados`}
          />
          <MetricCard
            title="Ciclo médio até conclusão"
            value={duration(report.averageCycleMs)}
            note={`${report.completedCycleCount} ciclos concluídos · mediana ${duration(report.medianCycleMs)}`}
          />
          <MetricCard
            title="Aprovação"
            value={percent(report.approvedEver, report.total)}
            note={`${report.approvedEver} cards passaram por Aprovado`}
          />
          <MetricCard
            title="Entrega das chaves"
            value={percent(report.keysEver, report.total)}
            note={`${report.keysEver} cards chegaram à etapa`}
          />
          <MetricCard
            title="Recuperados"
            value={String(report.recovered)}
            note="Cards que retornaram após perda"
          />
          <MetricCard
            title="SLA aberto vencido"
            value={String(report.overdueOpen)}
            note={percent(report.overdueOpen, report.active) + " dos cards em andamento"}
            icon={TriangleAlert}
          />
          <MetricCard
            title="Aluguel proposto · soma mensal"
            value={money(report.proposedRentTotal)}
            note="Soma da proposta de cada card, uma única vez"
          />
          <MetricCard
            title="Aluguel proposto · média"
            value={money(report.proposedRentAverage)}
            note="Ticket médio dos cards analisados"
          />
          <MetricCard
            title="Diferença frente ao original"
            value={
              report.negotiatedDifferencePercent === null
                ? "—"
                : `${report.negotiatedDifferencePercent.toFixed(1)}%`
            }
            note="Diferença ponderada entre valor original e proposta"
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-base font-semibold">Conversão desde o fechamento</h2>
            <p className="mb-5 text-xs text-muted-foreground">
              Cada card é contado uma vez por marco alcançado.
            </p>
            <div className="space-y-4">
              {funnel.map(([label, count]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span>{label}</span>
                    <strong>
                      {count} · {percent(count, report.total)}
                    </strong>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${report.total ? (count / report.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="text-base font-semibold">Maiores gargalos</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="field-label">Etapa · maior média</p>
                <p className="mt-2 font-semibold">
                  {report.stageBottleneck?.name ?? "Sem amostra"}
                </p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {duration(report.stageBottleneck?.averageMs ?? null)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report.stageBottleneck?.finished ?? 0} passagens encerradas
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="field-label">Tarefa · maior média</p>
                <p className="mt-2 font-semibold">{report.taskBottleneck?.name ?? "Sem amostra"}</p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {duration(report.taskBottleneck?.averageMs ?? null)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report.taskBottleneck?.finished ?? 0} execuções encerradas
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="field-label">Etapa · maior fila</p>
                <p className="mt-2 font-semibold">{report.stageBacklog?.name ?? "Sem fila"}</p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {report.stageBacklog?.open ?? 0} cards
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="field-label">Tarefa · maior fila</p>
                <p className="mt-2 font-semibold">{report.taskBacklog?.name ?? "Sem fila"}</p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {report.taskBacklog?.open ?? 0} execuções
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-base font-semibold">Cards por etapa atual</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Distribuição dos cards da amostra neste momento.
            </p>
            <div className="space-y-2">
              {report.outcomeByStage
                .filter((entry) => entry.count > 0)
                .map((entry) => (
                  <div
                    key={entry.stage}
                    className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-xs last:border-0"
                  >
                    <span>{stageLabel(entry.stage)}</span>
                    <strong>
                      {entry.count} · {percent(entry.count, report.total)}
                    </strong>
                  </div>
                ))}
              {!report.total && (
                <p className="text-xs text-muted-foreground">Nenhum card no período.</p>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="text-base font-semibold">Entradas em Fechamento Enviado</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Últimos dias com entradas dentro do filtro.
            </p>
            <div className="flex min-h-32 items-end gap-2 overflow-x-auto">
              {report.entryByDay.slice(-12).map((entry) => (
                <div
                  key={entry.day}
                  className="flex min-w-12 flex-1 flex-col items-center gap-1 text-center text-[10px]"
                  title={`${entry.day}: ${entry.count} cards`}
                >
                  <strong>{entry.count}</strong>
                  <div
                    className="w-full rounded-t bg-primary/85"
                    style={{
                      height: `${Math.max(8, (entry.count / Math.max(...report.entryByDay.map((day) => day.count))) * 80)}px`,
                    }}
                  />
                  <span className="text-muted-foreground">
                    {entry.day.slice(5).split("-").reverse().join("/")}
                  </span>
                </div>
              ))}
              {!report.entryByDay.length && (
                <p className="self-center text-xs text-muted-foreground">
                  Nenhuma entrada no período.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="panel p-5">
          <h2 className="text-base font-semibold">Tempo por etapa</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Média, mediana e P90 consideram apenas passagens encerradas. SLA vencido inclui
            passagens encerradas fora do prazo e passagens abertas em atraso.
          </p>
          <DurationTable rows={report.stageMetrics} />
        </section>
        <section className="panel p-5">
          <h2 className="text-base font-semibold">Tempo por tarefa</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Cada execução é medida separadamente; uma volta à tarefa conta como retrabalho e
            preserva o histórico anterior.
          </p>
          <DurationTable rows={report.taskMetrics} task />
        </section>

        {report.lossReasons.length > 0 && (
          <section className="panel p-5">
            <h2 className="mb-3 text-base font-semibold">Motivos de cancelamento e reprovação</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {report.lossReasons.map((entry) => (
                <div
                  key={entry.reasonId}
                  className="flex justify-between gap-3 rounded-xl border border-border p-3 text-xs"
                >
                  <span>{reasonName.get(entry.reasonId) ?? "Sem motivo cadastrado"}</span>
                  <strong>{entry.count}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="panel p-5">
            <h2 className="mb-4 text-base font-semibold">Fila em andamento · mais antigos</h2>
            <div className="space-y-2">
              {report.openCards.slice(0, 10).map(({ card, ageMs, stageAgeMs, overdue }) => (
                <div
                  key={card.id}
                  className="flex flex-wrap justify-between gap-2 rounded-xl border border-border p-3 text-xs"
                >
                  <div>
                    <p className="font-semibold">
                      {card.cliente_nome} · {card.imovel}
                    </p>
                    <p className="text-muted-foreground">
                      {stageLabel(card.listId)} · {unitName.get(card.unitId) ?? "Sem unidade"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={overdue ? "font-bold text-destructive" : "font-bold"}>
                      {duration(ageMs)} no fechamento
                    </p>
                    <p className="text-muted-foreground">{duration(stageAgeMs)} na etapa</p>
                  </div>
                </div>
              ))}
              {!report.openCards.length && (
                <p className="text-xs text-muted-foreground">Nenhum card em andamento.</p>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="mb-4 text-base font-semibold">Distribuição por unidade e consultor</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                ["Unidades", report.byUnit, unitName],
                ["Consultores", report.byConsultant, consultantName],
              ].map(([label, groups, names]) => (
                <div key={label as string}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {label as string}
                  </h3>
                  {(groups as typeof report.byUnit).map((group) => (
                    <div
                      key={group.id}
                      className="border-b border-border/60 py-2 text-xs last:border-0"
                    >
                      <p className="font-semibold">
                        {(names as Map<string, string>).get(group.id) ?? "Sem cadastro"}
                      </p>
                      <p className="text-muted-foreground">
                        {group.total} cards · {group.concluded} concluídos · {group.active} em
                        andamento · {group.lost} perdidos
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
