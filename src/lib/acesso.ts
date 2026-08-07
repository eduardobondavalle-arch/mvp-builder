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
    const { data: sessao } = await supabase.auth.getUser();
    const user = sessao.user;
    if (!user) return acessoVazio;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role, equipe_id")
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    const papeis = data ?? [];
    return {
      userId: user.id,
      email: user.email ?? "",
      isGestor: papeis.some((p) => p.role === "gestor"),
      equipesPermitidas: papeis
        .map((p) => p.equipe_id)
        .filter((id): id is string => Boolean(id)),
    };
  },
});

export function useAcesso(): Acesso {
  const { data } = useQuery(acessoQuery());
  return data ?? acessoVazio;
}

export function filtrarEquipes<T extends { id: string }>(equipes: T[], acesso: Acesso): T[] {
  if (acesso.isGestor) return equipes;
  return equipes.filter((e) => acesso.equipesPermitidas.includes(e.id));
}

export function filtrarConsultores<T extends { equipe_id: string | null }>(
  consultores: T[],
  acesso: Acesso,
): T[] {
  if (acesso.isGestor) return consultores;
  return consultores.filter(
    (c) => c.equipe_id && acesso.equipesPermitidas.includes(c.equipe_id),
  );
}
