import type { Canal, Ciclo, Consultor, Equipe, Jornada } from "./data";

export type Filtros = {
  cicloId: string;
  equipeId: string;
  consultorId: string;
  canalId: string;
};

export const filtrosVazios: Filtros = {
  cicloId: "all",
  equipeId: "all",
  consultorId: "all",
  canalId: "all",
};

export function aplicarFiltros(
  jornadas: Jornada[],
  filtros: Filtros,
  consultores: Consultor[],
  ciclos: Ciclo[],
) {
  const ciclo = ciclos.find((c) => c.id === filtros.cicloId);
  const porEquipe = new Map(consultores.map((c) => [c.id, c.equipe_id]));

  return jornadas.filter((j) => {
    if (ciclo) {
      const ref = j.data_proposta.slice(0, 10);
      if (ref < ciclo.data_inicio || ref > ciclo.data_fim) return false;
    }
    if (filtros.consultorId !== "all" && j.consultor_id !== filtros.consultorId) return false;
    if (filtros.canalId !== "all" && j.canal_id !== filtros.canalId) return false;
    if (filtros.equipeId !== "all" && porEquipe.get(j.consultor_id) !== filtros.equipeId)
      return false;
    return true;
  });
}

export function calcularIndicadores(jornadas: Jornada[]) {
  const contratos = jornadas.filter((j) => j.etapa === "contrato_assinado");
  const vgl = contratos.reduce((s, j) => s + (j.valor_final ?? 0), 0);
  const intermediacao = contratos.reduce(
    (s, j) => s + ((j.valor_final ?? 0) * j.percentual_intermediacao) / 100,
    0,
  );
  const taxaMedia = contratos.length
    ? contratos.reduce((s, j) => s + j.percentual_intermediacao, 0) / contratos.length
    : 0;
  const emNegociacao = jornadas.filter(
    (j) => j.etapa === "proposta" || j.etapa === "fechamento",
  ).length;
  const perdidos = jornadas.filter((j) => j.etapa === "negocio_perdido").length;
  const temposJornada = contratos
    .filter((j) => j.data_assinatura)
    .map(
      (j) =>
        (new Date(j.data_assinatura!).getTime() - new Date(j.data_primeiro_contato).getTime()) /
        86400000,
    );

  return {
    total: jornadas.length,
    contratos: contratos.length,
    vgl,
    intermediacao,
    ticketMedio: contratos.length ? vgl / contratos.length : 0,
    taxaMedia,
    emNegociacao,
    perdidos,
    conversao: jornadas.length ? (contratos.length / jornadas.length) * 100 : 0,
    tempoMedioJornada: temposJornada.length
      ? temposJornada.reduce((s, v) => s + v, 0) / temposJornada.length
      : 0,
  };
}

export function funil(jornadas: Jornada[]) {
  const contrato = jornadas.filter((j) => j.etapa === "contrato_assinado").length;
  const fechamento = jornadas.filter(
    (j) => j.data_fechamento !== null || j.etapa === "contrato_assinado",
  ).length;
  return [
    { etapa: "Visita", valor: jornadas.filter((j) => j.data_visita).length },
    { etapa: "Proposta", valor: jornadas.length },
    { etapa: "Fechamento", valor: fechamento },
    { etapa: "Contrato", valor: contrato },
  ];
}

export function rankingConsultores(
  jornadas: Jornada[],
  consultores: Consultor[],
  equipes: Equipe[],
) {
  const equipeNome = new Map(equipes.map((e) => [e.id, e.nome]));
  return consultores
    .map((c) => {
      const minhas = jornadas.filter((j) => j.consultor_id === c.id);
      const ind = calcularIndicadores(minhas);
      return {
        id: c.id,
        nome: c.nome,
        equipe: c.equipe_id ? (equipeNome.get(c.equipe_id) ?? "—") : "—",
        vgl: ind.vgl,
        contratos: ind.contratos,
        propostas: minhas.length,
        conversao: ind.conversao,
      };
    })
    .sort((a, b) => b.vgl - a.vgl);
}

export function rankingEquipes(jornadas: Jornada[], consultores: Consultor[], equipes: Equipe[]) {
  const porEquipe = new Map(consultores.map((c) => [c.id, c.equipe_id]));
  return equipes
    .map((e) => {
      const minhas = jornadas.filter((j) => porEquipe.get(j.consultor_id) === e.id);
      const ind = calcularIndicadores(minhas);
      return { id: e.id, nome: e.nome, ...ind };
    })
    .sort((a, b) => b.vgl - a.vgl);
}

export function conversaoPorCanal(jornadas: Jornada[], canais: Canal[]) {
  return canais
    .map((c) => {
      const minhas = jornadas.filter((j) => j.canal_id === c.id);
      const ind = calcularIndicadores(minhas);
      return {
        nome: c.nome,
        propostas: minhas.length,
        contratos: ind.contratos,
        conversao: ind.conversao,
        vgl: ind.vgl,
      };
    })
    .filter((c) => c.propostas > 0)
    .sort((a, b) => b.conversao - a.conversao);
}
