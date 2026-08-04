import { supabase } from "@/integrations/supabase/client";

export type Etapa = "proposta" | "fechamento" | "contrato_assinado" | "negocio_perdido";

export const ETAPAS: { key: Etapa; label: string; hint: string }[] = [
  { key: "proposta", label: "Proposta", hint: "Cliente formalizou proposta" },
  { key: "fechamento", label: "Fechamento", hint: "Enviado para formalização" },
  { key: "contrato_assinado", label: "Contrato Assinado", hint: "Compõe o VGL" },
  { key: "negocio_perdido", label: "Negócio Perdido", hint: "Reabrível a qualquer momento" },
];

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
  justificativa_nova_jornada: string | null;
  created_at: string;
};

export type Consultor = { id: string; nome: string; equipe_id: string | null; ativo: boolean };
export type Equipe = { id: string; nome: string };
export type Canal = { id: string; nome: string };
export type MotivoPerda = { id: string; nome: string };
export type Ciclo = {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: string;
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
  ciclos: () => ({
    queryKey: ["ciclos"],
    queryFn: () =>
      unwrap<Ciclo[]>(
        supabase.from("ciclos").select("*").order("data_inicio", { ascending: false }),
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
    detalhes: (input.detalhes ?? {}) as never,
  });
  if (error) throw new Error(error.message);
}
