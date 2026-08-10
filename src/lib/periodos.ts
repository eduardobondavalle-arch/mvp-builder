import type { Ciclo } from "./data";
import { filtrosVazios, type Filtros } from "./metrics";

export type Periodo = "ciclo_atual" | "semana" | "trimestre" | "semestre" | "personalizado";

export const periodos: { key: Periodo; label: string }[] = [
  { key: "ciclo_atual", label: "Ciclo atual" },
  { key: "semana", label: "Semana" },
  { key: "trimestre", label: "Trimestre (últimos 3 ciclos completos)" },
  { key: "semestre", label: "Semestre (últimos 6 ciclos completos)" },
  { key: "personalizado", label: "Período personalizado" },
];

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export const somaDias = (base: string, dias: number) =>
  iso(new Date(new Date(`${base}T12:00:00`).getTime() + dias * 86400000));

/** Segunda-feira da semana da data informada. */
export const inicioSemana = (base: string) => {
  const d = new Date(`${base}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return somaDias(base, -dow);
};

/** Ciclo atual: o que contém hoje; senão o mais recente já iniciado. */
export function cicloAtualDe(ciclos: Ciclo[], hoje: string) {
  return (
    ciclos.find((c) => c.data_inicio <= hoje && c.data_fim >= hoje) ??
    ciclos.find((c) => c.data_inicio <= hoje) ??
    ciclos[0]
  );
}

/** Ciclos encerrados, do mais recente para o mais antigo. */
export function ciclosCompletosDe(ciclos: Ciclo[], hoje: string) {
  return ciclos
    .filter((c) => c.data_fim < hoje)
    .sort((a, b) => (a.data_inicio < b.data_inicio ? 1 : -1));
}

export function intervaloDoPeriodo(
  periodo: Periodo,
  ciclos: Ciclo[],
  hoje: string,
  personalizado: { de: string; ate: string },
) {
  const ciclo = cicloAtualDe(ciclos, hoje);
  const completos = ciclosCompletosDe(ciclos, hoje);
  const ultimos = (qtd: number) => {
    const sel = completos.slice(0, qtd);
    if (sel.length === 0) return { de: "", ate: "" };
    return { de: sel[sel.length - 1]!.data_inicio, ate: sel[0]!.data_fim };
  };

  if (periodo === "ciclo_atual")
    return { de: ciclo?.data_inicio ?? "", ate: ciclo?.data_fim ?? "" };
  if (periodo === "semana") {
    const segunda = inicioSemana(hoje);
    const inicioCiclo = ciclo?.data_inicio ?? "";
    return { de: inicioCiclo && inicioCiclo > segunda ? inicioCiclo : segunda, ate: hoje };
  }
  if (periodo === "trimestre") return ultimos(3);
  if (periodo === "semestre") return ultimos(6);
  return { de: personalizado.de, ate: personalizado.ate };
}

/** Semana e período personalizado consideram apenas a data da proposta. */
export const baseDataDoPeriodo = (periodo: Periodo) =>
  periodo === "semana" || periodo === "personalizado"
    ? ("proposta" as const)
    : ("competencia" as const);

export function filtrosDoPeriodo(
  periodo: Periodo,
  ciclos: Ciclo[],
  hoje: string,
  personalizado: { de: string; ate: string },
  escopo: { equipeId?: string; consultorId?: string; canalId?: string } = {},
): Filtros {
  const intervalo = intervaloDoPeriodo(periodo, ciclos, hoje, personalizado);
  return {
    ...filtrosVazios,
    cicloId: "all",
    equipeId: escopo.equipeId ?? "all",
    consultorId: escopo.consultorId ?? "all",
    canalId: escopo.canalId ?? "all",
    de: intervalo.de,
    ate: intervalo.ate,
    baseData: baseDataDoPeriodo(periodo),
  };
}
