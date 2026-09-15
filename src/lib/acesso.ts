import { currentActor, platform } from "@/fechamento/host";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Acesso = {
  userId: string | null;
  email: string;
  isGestor: boolean;
  equipesPermitidas: string[];
};

export const acessoVazio: Acesso = {
  userId: null,
  email: "",
  isGestor: false,
  equipesPermitidas: [],
};

export const acessoQuery = () => ({
  queryKey: ["acesso"],
  queryFn: async (): Promise<Acesso> => {
    const actor = currentActor();
    const scope = platform()?.commercialScope;
    return {
      userId: actor.id,
      email: actor.name,
      isGestor: scope?.companyWide ?? !platform(),
      equipesPermitidas: scope?.unitIds ?? [],
    };
  },
});
export function useAcesso(): Acesso {
  const { data } = useQuery(acessoQuery());
  return data ?? acessoVazio;
}
export function filtrarEquipes<T extends { id: string }>(equipes: T[], acesso: Acesso): T[] {
  return acesso.isGestor ? equipes : equipes.filter((e) => acesso.equipesPermitidas.includes(e.id));
}
export function filtrarConsultores<T extends { equipe_id: string | null }>(
  consultores: T[],
  acesso: Acesso,
): T[] {
  return acesso.isGestor
    ? consultores
    : consultores.filter((c) => c.equipe_id && acesso.equipesPermitidas.includes(c.equipe_id));
}
