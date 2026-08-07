import { createFileRoute } from "@tanstack/react-router";

// Rota temporária de bootstrap: só funciona enquanto não existe nenhum papel cadastrado.
export const Route = createFileRoute("/api/public/bootstrap-acessos")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("id", { count: "exact", head: true });
        if ((count ?? 0) > 0) return Response.json({ erro: "ja_configurado" }, { status: 409 });

        const { data: equipes } = await supabaseAdmin.from("equipes").select("id, nome");
        const equipe = (t: string) =>
          (equipes ?? []).find((e) => e.nome.toLowerCase().includes(t))?.id ?? null;

        const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        const senhaTemp = () =>
          Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => alfabeto[b % alfabeto.length]).join("") + "#1";

        const plano = [
          { email: "jonathan@adimimoveis.com.br", role: "gestor" as const, equipe_id: null },
          { email: "eduardo@adimimoveis.com.br", role: "gestor" as const, equipe_id: null },
          {
            email: "mayara@adimimoveis.com.br",
            role: "gerente_equipe" as const,
            equipe_id: equipe("cambori"),
          },
          {
            email: "jenifer@adimimoveis.com.br",
            role: "gerente_equipe" as const,
            equipe_id: equipe("itapema"),
          },
        ];

        const { data: existentes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
        const criados: { email: string; senha: string }[] = [];

        for (const item of plano) {
          if (item.role === "gerente_equipe" && !item.equipe_id) {
            return Response.json({ erro: `equipe_nao_encontrada:${item.email}` }, { status: 400 });
          }
          let userId = existentes?.users.find((u) => u.email === item.email)?.id ?? null;
          if (!userId) {
            const senha = senhaTemp();
            const { data: novo, error } = await supabaseAdmin.auth.admin.createUser({
              email: item.email,
              password: senha,
              email_confirm: true,
            });
            if (error || !novo.user) {
              return Response.json({ erro: error?.message ?? "falha" }, { status: 400 });
            }
            userId = novo.user.id;
            criados.push({ email: item.email, senha });
          }
          const { error: erroPapel } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: item.role, equipe_id: item.equipe_id });
          if (erroPapel) return Response.json({ erro: erroPapel.message }, { status: 400 });
        }

        return Response.json({ criados });
      },
    },
  },
});
