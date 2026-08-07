import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AcessoUsuario = {
  user_id: string;
  email: string;
  papel: "gestor" | "gerente_equipe" | "sem_papel";
  equipe_id: string | null;
  ultimo_acesso: string | null;
};

async function garantirGestor(supabase: {
  from: (t: "user_roles") => {
    select: (c: string) => {
      eq: (
        col: string,
        v: string,
      ) => Promise<{ data: { role: string }[] | null; error: { message: string } | null }>;
    };
  };
}, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r) => r.role === "gestor")) {
    throw new Error("Somente gestores podem gerenciar acessos.");
  }
}

function senhaTemporaria() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("") + "#1";
}

export const listarAcessos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AcessoUsuario[]> => {
    await garantirGestor(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuarios, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: papeis, error: erroPapeis } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, equipe_id");
    if (erroPapeis) throw new Error(erroPapeis.message);

    return usuarios.users.map((u) => {
      const papel = (papeis ?? []).find((p) => p.user_id === u.id);
      return {
        user_id: u.id,
        email: u.email ?? "",
        papel: (papel?.role as AcessoUsuario["papel"]) ?? "sem_papel",
        equipe_id: papel?.equipe_id ?? null,
        ultimo_acesso: u.last_sign_in_at ?? null,
      };
    });
  });

const entradaAcesso = z.object({
  email: z.string().email(),
  papel: z.enum(["gestor", "gerente_equipe"]),
  equipe_id: z.string().uuid().nullable(),
});

export const criarAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaAcesso.parse(data))
  .handler(async ({ context, data }) => {
    await garantirGestor(context.supabase as never, context.userId);
    if (data.papel === "gerente_equipe" && !data.equipe_id) {
      throw new Error("Selecione a equipe do gerente.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const senha = senhaTemporaria();
    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
    });
    if (error || !criado.user) throw new Error(error?.message ?? "Não foi possível criar o acesso.");

    const { error: erroPapel } = await supabaseAdmin.from("user_roles").insert({
      user_id: criado.user.id,
      role: data.papel,
      equipe_id: data.papel === "gestor" ? null : data.equipe_id,
    });
    if (erroPapel) throw new Error(erroPapel.message);

    return { email: criado.user.email ?? data.email, senha };
  });

export const atualizarAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        papel: z.enum(["gestor", "gerente_equipe"]),
        equipe_id: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirGestor(context.supabase as never, context.userId);
    if (data.papel === "gerente_equipe" && !data.equipe_id) {
      throw new Error("Selecione a equipe do gerente.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.user_id,
      role: data.papel,
      equipe_id: data.papel === "gestor" ? null : data.equipe_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirGestor(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senha = senhaTemporaria();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: senha,
    });
    if (error) throw new Error(error.message);
    return { senha };
  });

export const removerAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirGestor(context.supabase as never, context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode remover o próprio acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cria os acessos iniciais da gestão. Só funciona enquanto não existe nenhum papel. */
export const bootstrapAcessos = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { count, error: erroCount } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true });
  if (erroCount) throw new Error(erroCount.message);
  if ((count ?? 0) > 0) return { criados: [], mensagem: "Acessos já configurados." };

  const { data: equipes, error: erroEquipes } = await supabaseAdmin
    .from("equipes")
    .select("id, nome");
  if (erroEquipes) throw new Error(erroEquipes.message);

  const equipe = (termo: string) =>
    (equipes ?? []).find((e) => e.nome.toLowerCase().includes(termo))?.id ?? null;

  const plano: { email: string; papel: "gestor" | "gerente_equipe"; equipe_id: string | null }[] = [
    { email: "jonathan@adimimoveis.com.br", papel: "gestor", equipe_id: null },
    { email: "eduardo@adimimoveis.com.br", papel: "gestor", equipe_id: null },
    { email: "mayara@adimimoveis.com.br", papel: "gerente_equipe", equipe_id: equipe("camboriú") ?? equipe("camboriu") },
    { email: "jenifer@adimimoveis.com.br", papel: "gerente_equipe", equipe_id: equipe("itapema") },
  ];

  const criados: { email: string; senha: string }[] = [];
  const { data: existentes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });

  for (const item of plano) {
    if (item.papel === "gerente_equipe" && !item.equipe_id) {
      throw new Error(`Equipe não encontrada para ${item.email}.`);
    }
    let userId = existentes?.users.find((u) => u.email === item.email)?.id ?? null;
    let senha = "";
    if (!userId) {
      senha = senhaTemporaria();
      const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
        email: item.email,
        password: senha,
        email_confirm: true,
      });
      if (error || !criado.user) throw new Error(error?.message ?? `Falha ao criar ${item.email}`);
      userId = criado.user.id;
    }
    const { error: erroPapel } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: item.papel, equipe_id: item.equipe_id });
    if (erroPapel) throw new Error(erroPapel.message);
    if (senha) criados.push({ email: item.email, senha });
  }

  return { criados, mensagem: "Acessos criados." };
});
