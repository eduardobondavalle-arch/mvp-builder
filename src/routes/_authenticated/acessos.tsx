import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SkeletonTabela } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcesso } from "@/lib/acesso";
import {
  atualizarAcesso,
  criarAcesso,
  listarAcessos,
  redefinirSenha,
  removerAcesso,
} from "@/lib/acessos.functions";
import { dataQueries } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/acessos")({
  head: () => ({
    meta: [
      { title: "Acessos | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Gestão de usuários da plataforma: papéis de gestor e gerente de equipe, com escopo de dados por unidade.",
      },
      { property: "og:title", content: "Acessos | Adim Aluguéis" },
      {
        property: "og:description",
        content: "Controle quem entra na plataforma e quais dados cada pessoa pode ver e editar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcessosPage,
});

type Papel = "gestor" | "gerente_equipe";

function AcessosPage() {
  const acesso = useAcesso();
  const queryClient = useQueryClient();

  const listar = useServerFn(listarAcessos);
  const criar = useServerFn(criarAcesso);
  const atualizar = useServerFn(atualizarAcesso);
  const redefinir = useServerFn(redefinirSenha);
  const remover = useServerFn(removerAcesso);

  const { data: equipes = [] } = useQuery(dataQueries.equipes());
  const usuarios = useQuery({
    queryKey: ["acessos"],
    queryFn: () => listar(),
    enabled: acesso.isGestor,
  });

  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>("gerente_equipe");
  const [equipeId, setEquipeId] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<{ email: string; senha: string } | null>(null);

  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ["acessos"] });
    queryClient.invalidateQueries({ queryKey: ["acesso"] });
  };

  const mCriar = useMutation({
    mutationFn: () =>
      criar({
        data: {
          email: email.trim().toLowerCase(),
          papel,
          equipe_id: papel === "gestor" ? null : equipeId || null,
        },
      }),
    onSuccess: (r) => {
      setSenhaGerada(r);
      setEmail("");
      recarregar();
      toast.success("Acesso criado. Compartilhe a senha provisória com a pessoa.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAtualizar = useMutation({
    mutationFn: (v: { user_id: string; papel: Papel; equipe_id: string | null }) =>
      atualizar({ data: v }),
    onSuccess: () => {
      recarregar();
      toast.success("Permissão atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mRedefinir = useMutation({
    mutationFn: (user_id: string) => redefinir({ data: { user_id } }),
    onSuccess: (r, user_id) => {
      const alvo = usuarios.data?.find((u) => u.user_id === user_id);
      setSenhaGerada({ email: alvo?.email ?? "", senha: r.senha });
      toast.success("Senha provisória gerada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mRemover = useMutation({
    mutationFn: (user_id: string) => remover({ data: { user_id } }),
    onSuccess: () => {
      recarregar();
      toast.success("Acesso removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!acesso.isGestor) {
    return (
      <AppShell
        title="Acessos"
        subtitle="Somente gestores podem gerenciar usuários e permissões da plataforma."
      >
        <div className="panel p-6 text-sm text-muted-foreground">
          Seu usuário tem acesso restrito à sua equipe. Peça a um gestor para criar ou alterar
          acessos.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Acessos"
      subtitle="Contas são criadas pela gestão. Gestores enxergam todos os dados; gerentes de equipe enxergam e editam apenas a unidade vinculada."
    >
      <section className="panel mb-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="size-4 text-primary" />
          Novo acesso
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">E-mail corporativo</Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@adimimoveis.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Permissão</Label>
            <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gestor">Gestor — acesso geral</SelectItem>
                <SelectItem value="gerente_equipe">Gerente de equipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Equipe</Label>
            <Select
              value={equipeId}
              onValueChange={setEquipeId}
              disabled={papel === "gestor"}
            >
              <SelectTrigger>
                <SelectValue placeholder={papel === "gestor" ? "Todas" : "Selecione"} />
              </SelectTrigger>
              <SelectContent>
                {equipes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={() => mCriar.mutate()}
          disabled={!email.trim() || mCriar.isPending}
        >
          {mCriar.isPending ? "Criando…" : "Criar acesso"}
        </Button>

        {senhaGerada && (
          <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
            <p className="font-medium">Senha provisória de {senhaGerada.email}</p>
            <p className="mt-1 font-mono text-base">{senhaGerada.senha}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Envie para a pessoa e peça que troque a senha depois do primeiro login, em
              &quot;Esqueci minha senha&quot;. Esta senha não será mostrada novamente.
            </p>
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-6 py-3">Usuário</th>
                <th className="label-caps px-3 py-3">Permissão</th>
                <th className="label-caps px-3 py-3">Equipe</th>
                <th className="label-caps px-3 py-3">Último acesso</th>
                <th className="label-caps px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(usuarios.data ?? []).map((u) => (
                <tr key={u.user_id} className="border-b border-border/50 last:border-0">
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-2">
                      {u.papel === "gestor" && <ShieldCheck className="size-4 text-primary" />}
                      {u.email}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      value={u.papel === "sem_papel" ? "" : u.papel}
                      onValueChange={(v) =>
                        mAtualizar.mutate({
                          user_id: u.user_id,
                          papel: v as Papel,
                          equipe_id: v === "gestor" ? null : u.equipe_id,
                        })
                      }
                    >
                      <SelectTrigger className="w-[190px]">
                        <SelectValue placeholder="Sem permissão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestor">Gestor — acesso geral</SelectItem>
                        <SelectItem value="gerente_equipe">Gerente de equipe</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      value={u.equipe_id ?? ""}
                      disabled={u.papel !== "gerente_equipe"}
                      onValueChange={(v) =>
                        mAtualizar.mutate({
                          user_id: u.user_id,
                          papel: "gerente_equipe",
                          equipe_id: v,
                        })
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue
                          placeholder={u.papel === "gestor" ? "Todas as equipes" : "Selecione"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {equipes.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {u.ultimo_acesso
                      ? new Date(u.ultimo_acesso).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "nunca entrou"}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => mRedefinir.mutate(u.user_id)}
                      >
                        <KeyRound className="size-4" />
                        Nova senha
                      </Button>
                      {u.user_id !== acesso.userId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remover o acesso de ${u.email}?`))
                              mRemover.mutate(u.user_id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!usuarios.isLoading && (usuarios.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-muted-foreground">
                    Nenhum usuário cadastrado ainda.
                  </td>
                </tr>
              )}
              {usuarios.isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-6">
                    <SkeletonTabela linhas={5} colunas={4} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
