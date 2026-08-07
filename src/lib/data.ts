import { supabase } from "@/integrations/supabase/client";
import { getUsuario } from "@/lib/usuario";

export type Etapa = "proposta" | "fechamento" | "contrato_assinado" | "negocio_perdido";

export const ETAPAS: { key: Etapa; label: string; hint: string }[] = [
  { key: "proposta", label: "Proposta", hint: "Cliente formalizou proposta" },
  { key: "fechamento", label: "Fechamento", hint: "Enviado para formalização" },
  { key: "contrato_assinado", label: "Contrato Assinado", hint: "Compõe o VGL" },
  { key: "negocio_perdido", label: "Negócio Perdido", hint: "Reabrível a qualquer momento" },
];

export const etapaLabel = (e: string) => ETAPAS.find((x) => x.key === e)?.label ?? e;

export type Jornada = {
  id: string;
  cliente_nome: string;
  cpf: string;
  telefone: string;
  consultor_id: string;
  canal_id: string;
  data_primeiro_contato: string;
  data_entrada_crm: string;
  data_visita: string;
  data_proposta: string;
  imovel: string;
  valor_original: number;
  valor_proposta: number;
  percentual_intermediacao: number;
  etapa: Etapa;
  data_fechamento: string | null;
  valor_atualizado: number | null;
  data_envio_contrato: string | null;
  data_assinatura: string | null;
  valor_final: number | null;
  motivo_perda_id: string | null;
  descricao_perda: string | null;
  data_perda: string | null;
  atingiu_fechamento: boolean;
  atingiu_contrato: boolean;
  motivo_reabertura: string | null;
  justificativa_nova_jornada: string | null;
  created_at: string;
  updated_at: string;
};

export type Consultor = { id: string; nome: string; equipe_id: string | null; ativo: boolean };
export type Equipe = { id: string; nome: string };
export type Canal = { id: string; nome: string; ativo: boolean };
export type MotivoPerda = { id: string; nome: string; ativo: boolean };
export type MotivoTransferencia = { id: string; nome: string; ativo: boolean };
export type Ciclo = {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  meta_vgl: number;
  meta_contratos: number;
};
export type Meta = {
  id: string;
  ciclo_id: string;
  equipe_id: string | null;
  consultor_id: string | null;
  meta_vgl: number;
  meta_contratos: number;
};
export type Evento = {
  id: string;
  jornada_id: string;
  tipo: string;
  etapa_anterior: string | null;
  etapa_nova: string | null;
  justificativa: string | null;
  detalhes: Record<string, unknown>;
  created_at: string;
};
export type RegistroDiario = {
  id: string;
  data: string;
  consultor_id: string;
  leads: number;
  atendimentos: number;
  agendamentos: number;
  visitas: number;
  created_at: string;
  updated_at: string;
};
export type PreLead = { id: string; data: string; quantidade: number };
export type Auditoria = {
  id: string;
  entidade: string;
  entidade_id: string | null;
  referencia: string | null;
  acao: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  justificativa: string | null;
  usuario: string;
  created_at: string;
};

async function unwrap<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const dataQueries = {
  jornadas: () => ({
    queryKey: ["jornadas"],
    queryFn: () =>
      unwrap<Jornada[]>(
        supabase.from("jornadas").select("*").order("created_at", { ascending: false }),
      ),
  }),
  consultores: () => ({
    queryKey: ["consultores"],
    queryFn: () => unwrap<Consultor[]>(supabase.from("consultores").select("*").order("nome")),
  }),
  equipes: () => ({
    queryKey: ["equipes"],
    queryFn: () => unwrap<Equipe[]>(supabase.from("equipes").select("*").order("nome")),
  }),
  canais: () => ({
    queryKey: ["canais"],
    queryFn: () => unwrap<Canal[]>(supabase.from("canais").select("*").order("nome")),
  }),
  motivos: () => ({
    queryKey: ["motivos"],
    queryFn: () => unwrap<MotivoPerda[]>(supabase.from("motivos_perda").select("*").order("nome")),
  }),
  motivosTransferencia: () => ({
    queryKey: ["motivos_transferencia"],
    queryFn: () =>
      unwrap<MotivoTransferencia[]>(
        supabase.from("motivos_transferencia").select("*").order("nome"),
      ),
  }),
  ciclos: () => ({
    queryKey: ["ciclos"],
    queryFn: () =>
      unwrap<Ciclo[]>(
        supabase.from("ciclos").select("*").order("data_inicio", { ascending: false }),
      ),
  }),
  metas: () => ({
    queryKey: ["metas"],
    queryFn: () => unwrap<Meta[]>(supabase.from("metas").select("*")),
  }),
  registros: () => ({
    queryKey: ["registros_diarios"],
    queryFn: () =>
      unwrap<RegistroDiario[]>(
        supabase.from("registros_diarios").select("*").order("data", { ascending: false }),
      ),
  }),
  preLeads: () => ({
    queryKey: ["pre_leads"],
    queryFn: () =>
      unwrap<PreLead[]>(
        supabase.from("pre_leads_diarios").select("*").order("data", { ascending: false }),
      ),
  }),
  eventos: (jornadaId: string) => ({
    queryKey: ["eventos", jornadaId],
    queryFn: () =>
      unwrap<Evento[]>(
        supabase
          .from("jornada_eventos")
          .select("*")
          .eq("jornada_id", jornadaId)
          .order("created_at", { ascending: false }),
      ),
  }),
  auditoria: () => ({
    queryKey: ["auditoria"],
    queryFn: () =>
      unwrap<Auditoria[]>(
        supabase
          .from("auditoria")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ),
  }),
};

export async function registrarEvento(input: {
  jornada_id: string;
  tipo: string;
  etapa_anterior?: string | null;
  etapa_nova?: string | null;
  justificativa?: string | null;
  detalhes?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("jornada_eventos").insert({
    jornada_id: input.jornada_id,
    tipo: input.tipo,
    etapa_anterior: input.etapa_anterior ?? null,
    etapa_nova: input.etapa_nova ?? null,
    justificativa: input.justificativa ?? null,
    detalhes: {
      ...(input.detalhes ?? {}),
      usuario: getUsuario(),
    } as never,
  });
  if (error) throw new Error(error.message);
}

export async function registrarAuditoria(
  entradas: {
    entidade: string;
    entidade_id?: string | null;
    referencia?: string | null;
    acao: string;
    campo?: string | null;
    valor_anterior?: string | null;
    valor_novo?: string | null;
    justificativa?: string | null;
  }[],
) {
  if (!entradas.length) return;
  const { data: sessao } = await supabase.auth.getUser();
  const usuario = sessao.user?.email ?? getUsuario();

  const { error } = await supabase.from("auditoria").insert(
    entradas.map((e) => ({
      entidade: e.entidade,
      entidade_id: e.entidade_id ?? null,
      referencia: e.referencia ?? null,
      acao: e.acao,
      campo: e.campo ?? null,
      valor_anterior: e.valor_anterior ?? null,
      valor_novo: e.valor_novo ?? null,
      justificativa: e.justificativa ?? null,
      usuario,
    })),
  );
  if (error) throw new Error(error.message);
}

/** Compara dois objetos e gera entradas de auditoria campo a campo. */
export function diffAuditoria<T extends Record<string, unknown>>(
  antes: T,
  depois: Partial<T>,
  base: { entidade: string; entidade_id?: string | null; referencia?: string | null; acao: string; justificativa?: string | null },
) {
  return Object.entries(depois)
    .filter(([campo, valor]) => String(antes[campo] ?? "") !== String(valor ?? ""))
    .map(([campo, valor]) => ({
      ...base,
      campo,
      valor_anterior: antes[campo] == null ? null : String(antes[campo]),
      valor_novo: valor == null ? null : String(valor),
    }));
}

/** Metas usam índices únicos parciais: gravamos com update por id ou insert. */
export async function salvarMetas(
  linhas: {
    ciclo_id: string;
    equipe_id: string | null;
    consultor_id: string | null;
    meta_vgl: number;
    meta_contratos: number;
  }[],
  existentes: Meta[],
) {
  for (const linha of linhas) {
    const atual = existentes.find((m) =>
      linha.consultor_id
        ? m.ciclo_id === linha.ciclo_id && m.consultor_id === linha.consultor_id
        : m.ciclo_id === linha.ciclo_id &&
          m.consultor_id === null &&
          m.equipe_id === linha.equipe_id,
    );
    const { error } = atual
      ? await supabase
          .from("metas")
          .update({
            meta_vgl: linha.meta_vgl,
            meta_contratos: linha.meta_contratos,
            equipe_id: linha.equipe_id,
          } as never)
          .eq("id", atual.id)
      : await supabase.from("metas").insert(linha as never);
    if (error) throw new Error(error.message);
  }
}
