import type {
  Canal,
  Ciclo,
  Consultor,
  Equipe,
  Jornada,
  Meta,
  PreLead,
  RegistroDiario,
} from "./data";

export type Filtros = {
  cicloId: string;
  equipeId: string;
  consultorId: string;
  canalId: string;
  de: string;
  ate: string;
  /**
   * Como o card é posicionado no período:
   * - "competencia" (padrão): assinatura/perda; cards em aberto contam no recorte vigente.
   * - "proposta": somente a data da proposta, sem exceções.
   */
  baseData?: "competencia" | "proposta";
};

export const filtrosVazios: Filtros = {
  cicloId: "all",
  equipeId: "all",
  consultorId: "all",
  canalId: "all",
  de: "",
  ate: "",
  baseData: "competencia",
};


/** Intervalo efetivo do recorte: período informado ou período do ciclo. */
export function periodoEfetivo(filtros: Filtros, ciclos: Ciclo[]) {
  const ciclo = ciclos.find((c) => c.id === filtros.cicloId);
  return {
    de: filtros.de || ciclo?.data_inicio || "",
    ate: filtros.ate || ciclo?.data_fim || "",
    ciclo,
  };
}

const dentro = (data: string | null, de: string, ate: string) => {
  if (!data) return false;
  const d = data.slice(0, 10);
  if (de && d < de) return false;
  if (ate && d > ate) return false;
  return true;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

/**
 * Data que posiciona o card no período:
 * - Contrato assinado: data da assinatura (é o que compõe o valor do ciclo).
 * - Negócio perdido: data da perda.
 * - Proposta e Fechamento: ainda em aberto, contam no período vigente.
 */
export function dataDeCompetencia(j: Jornada) {
  if (j.etapa === "contrato_assinado") return j.data_assinatura ?? j.data_proposta;
  if (j.etapa === "negocio_perdido") return j.data_perda ?? j.data_proposta;
  return null;
}

const noPeriodo = (j: Jornada, de: string, ate: string) => {
  const data = dataDeCompetencia(j);
  // Cards em aberto (proposta/fechamento) entram sempre que o recorte inclui hoje.
  if (data === null) {
    const hoje = hojeISO();
    return (!de || de <= hoje) && (!ate || ate >= hoje);
  }
  return dentro(data, de, ate);
};

export function aplicarFiltros(
  jornadas: Jornada[],
  filtros: Filtros,
  consultores: Consultor[],
  ciclos: Ciclo[],
) {
  const { de, ate } = periodoEfetivo(filtros, ciclos);
  const porEquipe = new Map(consultores.map((c) => [c.id, c.equipe_id]));

  return jornadas.filter((j) => {
    if ((de || ate) && !noPeriodo(j, de, ate)) return false;
    if (filtros.consultorId !== "all" && j.consultor_id !== filtros.consultorId) return false;
    if (filtros.canalId !== "all" && j.canal_id !== filtros.canalId) return false;
    if (filtros.equipeId !== "all" && porEquipe.get(j.consultor_id) !== filtros.equipeId)
      return false;
    return true;
  });
}


export function filtrarRegistros(
  registros: RegistroDiario[],
  filtros: Filtros,
  consultores: Consultor[],
  ciclos: Ciclo[],
) {
  const { de, ate } = periodoEfetivo(filtros, ciclos);
  const porEquipe = new Map(consultores.map((c) => [c.id, c.equipe_id]));
  return registros.filter((r) => {
    if ((de || ate) && !dentro(r.data, de, ate)) return false;
    if (filtros.consultorId !== "all" && r.consultor_id !== filtros.consultorId) return false;
    if (filtros.equipeId !== "all" && porEquipe.get(r.consultor_id) !== filtros.equipeId)
      return false;
    return true;
  });
}

export function filtrarPreLeads(preLeads: PreLead[], filtros: Filtros, ciclos: Ciclo[]) {
  const { de, ate } = periodoEfetivo(filtros, ciclos);
  // Pré Lead existe apenas no nível da empresa: recortes por equipe/consultor/canal não se aplicam.
  if (filtros.equipeId !== "all" || filtros.consultorId !== "all" || filtros.canalId !== "all")
    return [];
  return preLeads.filter((p) => !(de || ate) || dentro(p.data, de, ate));
}

export function somarRegistros(registros: RegistroDiario[]) {
  return registros.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      atendimentos: acc.atendimentos + r.atendimentos,
      agendamentos: acc.agendamentos + r.agendamentos,
      visitas: acc.visitas + r.visitas,
    }),
    { leads: 0, atendimentos: 0, agendamentos: 0, visitas: 0 },
  );
}

/** Valor comercial de um card conforme a etapa alcançada. */
const valorCard = (j: Jornada) =>
  j.valor_final ?? j.valor_atualizado ?? j.valor_proposta ?? 0;

// Contagem sempre pela coluna atual do Kanban do painel de propostas.
const passouFechamento = (j: Jornada) =>
  j.etapa === "fechamento" || j.etapa === "contrato_assinado";
const passouContrato = (j: Jornada) => j.etapa === "contrato_assinado";


export function calcularIndicadores(jornadas: Jornada[]) {
  // Colunas atuais do painel de propostas.
  const emFechamento = jornadas.filter((j) => j.etapa === "fechamento");
  const assinados = jornadas.filter((j) => j.etapa === "contrato_assinado");
  const comValor = [...emFechamento, ...assinados];

  const vglTotal = comValor.reduce((s, j) => s + valorCard(j), 0);
  const vglAssinado = assinados.reduce((s, j) => s + valorCard(j), 0);
  const intermediacao = comValor.reduce(
    (s, j) => s + (valorCard(j) * j.percentual_intermediacao) / 100,
    0,
  );
  const taxaMedia = jornadas.length
    ? jornadas.reduce((s, j) => s + j.percentual_intermediacao, 0) / jornadas.length
    : 0;

  const emNegociacao = jornadas.filter(
    (j) => j.etapa === "proposta" || j.etapa === "fechamento",
  ).length;
  const perdidos = jornadas.filter((j) => j.etapa === "negocio_perdido").length;
  const reabertas = jornadas.filter((j) => Boolean(j.motivo_reabertura)).length;

  const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);
  const dias = (a: string | null, b: string | null) =>
    a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 86400000 : null;

  // Jornada do cliente: da entrada no CRM até o envio da proposta, em todas as colunas.
  const tempoJornada = jornadas
    .map((j) => dias(j.data_entrada_crm, j.data_proposta))
    .filter((v): v is number => v !== null && v >= 0);
  const tempoLais = jornadas
    .map((j) => dias(j.data_primeiro_contato, j.data_entrada_crm))
    .filter((v): v is number => v !== null && v >= 0);
  const tempoConsultor = jornadas
    .filter(passouContrato)
    .map((j) => dias(j.data_entrada_crm, j.data_assinatura))
    .filter((v): v is number => v !== null && v >= 0);

  const contratos = jornadas.filter(passouContrato).length;

  return {
    total: jornadas.length,
    propostas: jornadas.length,
    fechamentos: jornadas.filter(passouFechamento).length,
    contratos,
    vgl: vglAssinado,
    vglTotal,
    vglAssinado,
    intermediacao,
    ticketMedio: comValor.length ? vglTotal / comValor.length : 0,
    taxaMedia,
    emNegociacao,
    perdidos,
    reabertas,
    conversao: jornadas.length ? (contratos / jornadas.length) * 100 : 0,
    tempoMedioJornada: media(tempoJornada),
    tempoMedioLais: media(tempoLais),
    tempoMedioConsultor: media(tempoConsultor),
  };
}


/** Funil completo: Pré Lead e Lead→Visita vêm do registro diário; Proposta→Contrato vêm do Kanban. */
export function funilCompleto(
  jornadas: Jornada[],
  registros: RegistroDiario[],
  preLeads: PreLead[],
) {
  const op = somarRegistros(registros);
  const preLead = preLeads.reduce((s, p) => s + p.quantidade, 0);
  const ind = calcularIndicadores(jornadas);
  const etapas = [
    { etapa: "Pré Lead", valor: preLead, origem: "empresa" as const },
    { etapa: "Lead", valor: op.leads, origem: "diario" as const },
    { etapa: "Atendimento", valor: op.atendimentos, origem: "diario" as const },
    { etapa: "Agendamento", valor: op.agendamentos, origem: "diario" as const },
    { etapa: "Visita", valor: op.visitas, origem: "diario" as const },
    { etapa: "Proposta", valor: ind.propostas, origem: "kanban" as const },
    { etapa: "Fechamento", valor: ind.fechamentos, origem: "kanban" as const },
    { etapa: "Contrato", valor: ind.contratos, origem: "kanban" as const },
  ];
  return etapas.filter((e) => !(e.etapa === "Pré Lead" && preLead === 0));
}

export function conversoesPorEtapa(
  jornadas: Jornada[],
  registros: RegistroDiario[],
  preLeads: PreLead[],
) {
  const etapas = funilCompleto(jornadas, registros, preLeads);
  return etapas.slice(1).map((e, i) => {
    const anterior = etapas[i]!;
    return {
      de: anterior.etapa,
      para: e.etapa,
      conversao: anterior.valor ? (e.valor / anterior.valor) * 100 : 0,
    };
  });
}

export function conversaoLais(preLeads: PreLead[], registros: RegistroDiario[]) {
  const pre = preLeads.reduce((s, p) => s + p.quantidade, 0);
  const leads = somarRegistros(registros).leads;
  return { preLeads: pre, leads, conversao: pre ? (leads / pre) * 100 : 0 };
}

export function metaDe(metas: Meta[], cicloId: string, alvo: { equipeId?: string; consultorId?: string }) {
  const m = metas.find(
    (x) =>
      x.ciclo_id === cicloId &&
      (alvo.consultorId
        ? x.consultor_id === alvo.consultorId
        : x.consultor_id === null && x.equipe_id === alvo.equipeId),
  );
  return { meta_vgl: m?.meta_vgl ?? 0, meta_contratos: m?.meta_contratos ?? 0, id: m?.id };
}

export function rankingConsultores(
  jornadas: Jornada[],
  registros: RegistroDiario[],
  consultores: Consultor[],
  equipes: Equipe[],
  metas: Meta[],
  cicloId: string,
) {
  const equipeNome = new Map(equipes.map((e) => [e.id, e.nome]));
  return consultores
    .map((c) => {
      const minhas = jornadas.filter((j) => j.consultor_id === c.id);
      const ind = calcularIndicadores(minhas);
      const op = somarRegistros(registros.filter((r) => r.consultor_id === c.id));
      const meta = metaDe(metas, cicloId, { consultorId: c.id });
      return {
        id: c.id,
        nome: c.nome,
        ativo: c.ativo,
        equipeId: c.equipe_id,
        equipe: c.equipe_id ? (equipeNome.get(c.equipe_id) ?? "—") : "—",
        vgl: ind.vgl,
        vglTotal: ind.vglTotal,
        vglAssinado: ind.vglAssinado,
        contratos: ind.contratos,
        fechamentos: ind.fechamentos,
        propostas: minhas.length,
        conversao: ind.conversao,
        intermediacao: ind.intermediacao,

        ...op,
        metaVgl: meta.meta_vgl,
        metaContratos: meta.meta_contratos,
        pctMetaVgl: meta.meta_vgl ? (ind.vgl / meta.meta_vgl) * 100 : 0,
        pctMetaContratos: meta.meta_contratos ? (ind.contratos / meta.meta_contratos) * 100 : 0,
      };
    })
    .sort((a, b) => b.vgl - a.vgl);
}

export function rankingEquipes(
  jornadas: Jornada[],
  registros: RegistroDiario[],
  consultores: Consultor[],
  equipes: Equipe[],
  metas: Meta[],
  cicloId: string,
) {
  const porEquipe = new Map(consultores.map((c) => [c.id, c.equipe_id]));
  return equipes
    .map((e) => {
      const minhas = jornadas.filter((j) => porEquipe.get(j.consultor_id) === e.id);
      const ind = calcularIndicadores(minhas);
      const op = somarRegistros(registros.filter((r) => porEquipe.get(r.consultor_id) === e.id));
      const meta = metaDe(metas, cicloId, { equipeId: e.id });
      return {
        id: e.id,
        nome: e.nome,
        ...ind,
        ...op,
        metaVgl: meta.meta_vgl,
        metaContratos: meta.meta_contratos,
        pctMetaVgl: meta.meta_vgl ? (ind.vgl / meta.meta_vgl) * 100 : 0,
        pctMetaContratos: meta.meta_contratos ? (ind.contratos / meta.meta_contratos) * 100 : 0,
      };
    })
    .sort((a, b) => b.pctMetaVgl - a.pctMetaVgl);
}

/** Canais agrupados sob a tag "Imobiliária" para a métrica de maior conversão. */
const CANAIS_IMOBILIARIA = [
  "diretoria",
  "indicacao grupo cri",
  "instagram",
  "ligacao",
  "placa",
  "porta",
  "site",
  "vitrine",
  "vitrina",
];

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const grupoDoCanal = (nome: string) =>
  CANAIS_IMOBILIARIA.includes(semAcento(nome)) ? "Imobiliária" : nome;

/**
 * Conversão por canal com os canais da imobiliária agrupados.
 * Considera apenas cards em Proposta, Fechamento e Contrato assinado.
 */
export function conversaoPorCanalAgrupado(jornadas: Jornada[], canais: Canal[]) {
  const etapasValidas = new Set(["proposta", "fechamento", "contrato_assinado"]);
  const validas = jornadas.filter((j) => etapasValidas.has(j.etapa));
  const grupoPorCanal = new Map(canais.map((c) => [c.id, grupoDoCanal(c.nome)]));

  const mapa = new Map<string, Jornada[]>();
  for (const j of validas) {
    const grupo = grupoPorCanal.get(j.canal_id) ?? "Outros";
    mapa.set(grupo, [...(mapa.get(grupo) ?? []), j]);
  }

  return [...mapa.entries()]
    .map(([nome, itens]) => {
      const ind = calcularIndicadores(itens);
      return {
        nome,
        propostas: itens.length,
        contratos: ind.contratos,
        conversao: itens.length ? (ind.contratos / itens.length) * 100 : 0,
        vgl: ind.vglTotal,
        ticketMedio: ind.ticketMedio,
      };
    })
    .filter((c) => c.propostas > 0)
    .sort((a, b) => b.conversao - a.conversao);
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
        vgl: ind.vglTotal,

        ticketMedio: ind.ticketMedio,
      };
    })
    .filter((c) => c.propostas > 0)
    .sort((a, b) => b.conversao - a.conversao);
}

export function motivosDePerda(
  jornadas: Jornada[],
  motivos: { id: string; nome: string }[],
) {
  const perdidas = jornadas.filter((j) => j.etapa === "negocio_perdido");
  return motivos
    .map((m) => ({
      nome: m.nome,
      total: perdidas.filter((j) => j.motivo_perda_id === m.id).length,
    }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Negociações paradas: sem movimentação há mais de N dias e ainda em andamento. */
export function negociacoesParadas(jornadas: Jornada[], dias = 15) {
  const limite = Date.now() - dias * 86400000;
  return jornadas
    .filter((j) => j.etapa === "proposta" || j.etapa === "fechamento")
    .filter((j) => new Date(j.updated_at).getTime() < limite)
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
}

export function produtividadeDiaria(registros: RegistroDiario[]) {
  const mapa = new Map<string, { data: string; leads: number; atendimentos: number; agendamentos: number; visitas: number }>();
  for (const r of registros) {
    const atual =
      mapa.get(r.data) ??
      { data: r.data, leads: 0, atendimentos: 0, agendamentos: 0, visitas: 0 };
    atual.leads += r.leads;
    atual.atendimentos += r.atendimentos;
    atual.agendamentos += r.agendamentos;
    atual.visitas += r.visitas;
    mapa.set(r.data, atual);
  }
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}
