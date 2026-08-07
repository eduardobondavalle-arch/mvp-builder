import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { dataQueries, registrarAuditoria } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Cadastros base da plataforma: equipes, consultores, canais de origem, motivos de perda e motivos de transferência.",
      },
      { property: "og:title", content: "Cadastros | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "Listas mestras da operação comercial. Nada é excluído: itens saem de uso pela desativação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadastrosPage,
});

type Tabela = "equipes" | "consultores" | "canais" | "motivos_perda" | "motivos_transferencia";

function CadastrosPage() {
  const qc = useQueryClient();
  const [nome, setNome] = useState<Record<string, string>>({});
  const [equipeNovoConsultor, setEquipeNovoConsultor] = useState("");

  const results = useQueries({
    queries: [
      dataQueries.equipes(),
      dataQueries.consultores(),
      dataQueries.canais(),
      dataQueries.motivos(),
      dataQueries.motivosTransferencia(),
    ],
  });
  const equipes = results[0].data ?? [];
  const consultores = results[1].data ?? [];
  const canais = results[2].data ?? [];
  const motivos = results[3].data ?? [];
  const motivosTransf = results[4].data ?? [];

  const invalidar = (tabela: Tabela) => {
    const chaves: Record<Tabela, string> = {
      equipes: "equipes",
      consultores: "consultores",
      canais: "canais",
      motivos_perda: "motivos",
      motivos_transferencia: "motivos_transferencia",
    };
    qc.invalidateQueries({ queryKey: [chaves[tabela]] });
    qc.invalidateQueries({ queryKey: ["auditoria"] });
  };

  const criar = useMutation({
    mutationFn: async ({ tabela, extra }: { tabela: Tabela; extra?: Record<string, unknown> }) => {
      const valor = (nome[tabela] ?? "").trim();
      if (!valor) throw new Error("Informe o nome.");
      const { data, error } = await supabase
        .from(tabela)
        .insert({ nome: valor, ...extra } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await registrarAuditoria([
        {
          entidade: tabela,
          entidade_id: (data as { id: string }).id,
          referencia: valor,
          acao: "criacao",
          campo: "nome",
          valor_novo: valor,
        },
      ]);
      return tabela;
    },
    onSuccess: (tabela) => {
      setNome((p) => ({ ...p, [tabela]: "" }));
      setEquipeNovoConsultor("");
      invalidar(tabela);
      toast.success("Cadastro criado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({
      tabela,
      id,
      referencia,
      patch,
      anterior,
    }: {
      tabela: Tabela;
      id: string;
      referencia: string;
      patch: Record<string, unknown>;
      anterior: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from(tabela).update(patch as never).eq("id", id);
      if (error) throw new Error(error.message);
      await registrarAuditoria(
        Object.entries(patch).map(([campo, valor]) => ({
          entidade: tabela,
          entidade_id: id,
          referencia,
          acao: "edicao",
          campo,
          valor_anterior: anterior[campo] == null ? null : String(anterior[campo]),
          valor_novo: valor == null ? null : String(valor),
        })),
      );
      return tabela;
    },
    onSuccess: (tabela) => {
      invalidar(tabela);
      toast.success("Cadastro atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const listaSimples = (
    tabela: Tabela,
    titulo: string,
    descricao: string,
    itens: { id: string; nome: string; ativo?: boolean }[],
  ) => (
    <section className="panel p-6">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{descricao}</p>
      <div className="mb-5 flex gap-2">
        <Input
          placeholder="Novo item"
          aria-label={`Novo item em ${titulo}`}
          value={nome[tabela] ?? ""}
          onChange={(e) => setNome((p) => ({ ...p, [tabela]: e.target.value }))}
        />
        <Button onClick={() => criar.mutate({ tabela })}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      <ul className="divide-y divide-border/60">
        {itens.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <Input
              className="h-9"
              defaultValue={item.nome}
              aria-label={`Nome de ${item.nome}`}
              onBlur={(e) => {
                const valor = e.target.value.trim();
                if (!valor || valor === item.nome) return;
                atualizar.mutate({
                  tabela,
                  id: item.id,
                  referencia: item.nome,
                  patch: { nome: valor },
                  anterior: { nome: item.nome },
                });
              }}
            />
            {item.ativo !== undefined && (
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={item.ativo}
                  onCheckedChange={(v) =>
                    atualizar.mutate({
                      tabela,
                      id: item.id,
                      referencia: item.nome,
                      patch: { ativo: v },
                      anterior: { ativo: item.ativo },
                    })
                  }
                />
                {item.ativo ? "Ativo" : "Inativo"}
              </label>
            )}
          </li>
        ))}
        {itens.length === 0 && <li className="py-3 text-sm text-muted-foreground">Vazio.</li>}
      </ul>
    </section>
  );

  return (
    <AppShell
      title="Cadastros"
      subtitle="Listas mestras usadas em toda a plataforma. Registros nunca são excluídos — para retirar um item de uso, desative-o; o histórico permanece íntegro."
    >
      <Tabs defaultValue="pessoas">
        <TabsList className="mb-6">
          <TabsTrigger value="pessoas">Equipes e consultores</TabsTrigger>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="motivos">Motivos</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoas" className="grid gap-6 lg:grid-cols-2">
          {listaSimples("equipes", "Equipes", "Unidades de negócio da operação.", equipes)}

          <section className="panel p-6">
            <h2 className="text-lg font-semibold">Consultores</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Consultores inativos deixam de receber metas e lançamentos diários, mas continuam nos
              indicadores históricos.
            </p>
            <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Input
                placeholder="Nome do consultor"
                aria-label="Nome do novo consultor"
                value={nome["consultores"] ?? ""}
                onChange={(e) => setNome((p) => ({ ...p, consultores: e.target.value }))}
              />
              <Select value={equipeNovoConsultor} onValueChange={setEquipeNovoConsultor}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="Equipe" />
                </SelectTrigger>
                <SelectContent>
                  {equipes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  criar.mutate({
                    tabela: "consultores",
                    extra: { equipe_id: equipeNovoConsultor || null },
                  })
                }
              >
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
            <ul className="divide-y divide-border/60">
              {consultores.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Input
                    className="h-9 flex-1"
                    defaultValue={c.nome}
                    aria-label={`Nome de ${c.nome}`}
                    onBlur={(e) => {
                      const valor = e.target.value.trim();
                      if (!valor || valor === c.nome) return;
                      atualizar.mutate({
                        tabela: "consultores",
                        id: c.id,
                        referencia: c.nome,
                        patch: { nome: valor },
                        anterior: { nome: c.nome },
                      });
                    }}
                  />
                  <Select
                    value={c.equipe_id ?? ""}
                    onValueChange={(v) =>
                      atualizar.mutate({
                        tabela: "consultores",
                        id: c.id,
                        referencia: c.nome,
                        patch: { equipe_id: v },
                        anterior: { equipe_id: c.equipe_id },
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue placeholder="Sem equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipes.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={c.ativo}
                      onCheckedChange={(v) =>
                        atualizar.mutate({
                          tabela: "consultores",
                          id: c.id,
                          referencia: c.nome,
                          patch: { ativo: v },
                          anterior: { ativo: c.ativo },
                        })
                      }
                    />
                    {c.ativo ? "Ativo" : "Inativo"}
                  </label>
                </li>
              ))}
              {consultores.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">Nenhum consultor cadastrado.</li>
              )}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="canais">
          <div className="lg:max-w-2xl">
            {listaSimples(
              "canais",
              "Canais de origem",
              "Origem do lead usada na análise de conversão por canal.",
              canais,
            )}
          </div>
        </TabsContent>

        <TabsContent value="motivos" className="grid gap-6 lg:grid-cols-2">
          <Label className="sr-only">Motivos</Label>
          {listaSimples(
            "motivos_perda",
            "Motivos de perda",
            "Obrigatórios ao mover uma jornada para Negócio Perdido.",
            motivos,
          )}
          {listaSimples(
            "motivos_transferencia",
            "Motivos de transferência",
            "Obrigatórios na transferência de jornada entre consultores.",
            motivosTransf,
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
