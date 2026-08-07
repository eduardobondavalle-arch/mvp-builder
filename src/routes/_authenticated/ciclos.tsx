import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Wand2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SkeletonPanel } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { filtrarConsultores, filtrarEquipes, useAcesso } from "@/lib/acesso";
import { dataQueries, registrarAuditoria, salvarMetas } from "@/lib/data";
import { brl, dateBR, pct } from "@/lib/format";
import { calcularIndicadores, metaDe } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/ciclos")({
  head: () => ({
    meta: [
      { title: "Ciclos e Metas | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Gestão de ciclos comerciais da Adim Aluguéis com distribuição automática de metas de VGL e contratos entre equipes e consultores.",
      },
      { property: "og:title", content: "Ciclos e Metas | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "Defina o ciclo, distribua metas automaticamente e ajuste individualmente cada consultor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CiclosPage,
});

type NovoCiclo = {
  nome: string;
  data_inicio: string;
  data_fim: string;
  meta_vgl: string;
  meta_contratos: string;
};
const cicloVazio: NovoCiclo = {
  nome: "",
  data_inicio: "",
  data_fim: "",
  meta_vgl: "",
  meta_contratos: "",
};

function CiclosPage() {
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState(cicloVazio);
  const [cicloId, setCicloId] = useState("");
  const [rascunho, setRascunho] = useState<Record<string, { vgl: string; contratos: string }>>({});

  const acesso = useAcesso();
  const results = useQueries({
    queries: [
      dataQueries.ciclos(),
      dataQueries.equipes(),
      dataQueries.consultores(),
      dataQueries.metas(),
      dataQueries.jornadas(),
    ],
  });
  const ciclos = results[0].data ?? [];
  const equipes = filtrarEquipes(results[1].data ?? [], acesso);
  const consultores = filtrarConsultores(
    (results[2].data ?? []).filter((c) => c.ativo),
    acesso,
  );
  const metas = results[3].data ?? [];
  const jornadas = results[4].data ?? [];
  const carregando = results.some((r) => r.isLoading);

  const cicloAtual = ciclos.find((c) => c.id === cicloId) ?? ciclos[0];
  const idAtual = cicloAtual?.id ?? "";

  const doCiclo = useMemo(() => {
    if (!cicloAtual) return [];
    return jornadas.filter((j) => {
      const d = j.data_proposta.slice(0, 10);
      return d >= cicloAtual.data_inicio && d <= cicloAtual.data_fim;
    });
  }, [jornadas, cicloAtual]);

  const valorMeta = (chave: string, atual: { meta_vgl: number; meta_contratos: number }) => ({
    vgl: rascunho[chave]?.vgl ?? String(atual.meta_vgl),
    contratos: rascunho[chave]?.contratos ?? String(atual.meta_contratos),
  });

  const criarCiclo = useMutation({
    mutationFn: async () => {
      if (!form.nome || !form.data_inicio || !form.data_fim)
        throw new Error("Informe nome e período do ciclo.");
      if (form.data_fim < form.data_inicio)
        throw new Error("A data final do ciclo deve ser posterior à inicial.");
      const { data, error } = await supabase
        .from("ciclos")
        .insert({
          nome: form.nome,
          data_inicio: form.data_inicio,
          data_fim: form.data_fim,
          meta_vgl: Number(form.meta_vgl || 0),
          meta_contratos: Number(form.meta_contratos || 0),
          status: "aberto",
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await registrarAuditoria([
        {
          entidade: "ciclo",
          entidade_id: (data as { id: string }).id,
          referencia: form.nome,
          acao: "criacao",
          campo: "meta_vgl",
          valor_novo: form.meta_vgl || "0",
        },
      ]);
      return (data as { id: string }).id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["ciclos"] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      setCicloId(id);
      setForm(cicloVazio);
      setNovo(false);
      toast.success("Ciclo criado. Distribua as metas para equipes e consultores.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const distribuir = useMutation({
    mutationFn: async () => {
      if (!cicloAtual) throw new Error("Selecione um ciclo.");
      if (!equipes.length || !consultores.length)
        throw new Error("Cadastre equipes e consultores antes de distribuir metas.");

      const porEquipeVgl = cicloAtual.meta_vgl / equipes.length;
      const porEquipeContratos = cicloAtual.meta_contratos / equipes.length;

      const linhas = [
        ...equipes.map((e) => ({
          ciclo_id: cicloAtual.id,
          equipe_id: e.id,
          consultor_id: null,
          meta_vgl: Math.round(porEquipeVgl),
          meta_contratos: Math.round(porEquipeContratos),
        })),
        ...consultores.map((c) => {
          const time = consultores.filter((x) => x.equipe_id === c.equipe_id).length || 1;
          return {
            ciclo_id: cicloAtual.id,
            equipe_id: c.equipe_id,
            consultor_id: c.id,
            meta_vgl: Math.round(porEquipeVgl / time),
            meta_contratos: Math.round(porEquipeContratos / time),
          };
        }),
      ];

      await salvarMetas(linhas, metas);

      await registrarAuditoria([
        {
          entidade: "metas",
          entidade_id: cicloAtual.id,
          referencia: cicloAtual.nome,
          acao: "distribuicao_automatica",
          campo: "meta_vgl",
          valor_novo: String(cicloAtual.meta_vgl),
          justificativa: "Distribuição igualitária entre equipes e consultores ativos.",
        },
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      setRascunho({});
      toast.success("Metas distribuídas. Ajustes individuais podem ser feitos abaixo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarAjustes = useMutation({
    mutationFn: async () => {
      if (!cicloAtual) throw new Error("Selecione um ciclo.");
      const entradas = Object.entries(rascunho);
      if (!entradas.length) throw new Error("Nenhum ajuste pendente.");

      const linhas = entradas.map(([chave, v]) => {
        const [tipo, id] = chave.split(":") as ["equipe" | "consultor", string];
        const consultor = consultores.find((c) => c.id === id);
        return {
          ciclo_id: cicloAtual.id,
          equipe_id: tipo === "equipe" ? id : (consultor?.equipe_id ?? null),
          consultor_id: tipo === "consultor" ? id : null,
          meta_vgl: Number(v.vgl || 0),
          meta_contratos: Number(v.contratos || 0),
        };
      });

      await salvarMetas(linhas, metas);

      await registrarAuditoria(
        entradas.map(([chave, v]) => {
          const [tipo, id] = chave.split(":") as ["equipe" | "consultor", string];
          const nome =
            tipo === "equipe"
              ? equipes.find((e) => e.id === id)?.nome
              : consultores.find((c) => c.id === id)?.nome;
          const anterior = metaDe(
            metas,
            cicloAtual.id,
            tipo === "equipe" ? { equipeId: id } : { consultorId: id },
          );
          return {
            entidade: `meta_${tipo}`,
            entidade_id: id,
            referencia: `${nome ?? id} • ${cicloAtual.nome}`,
            acao: "ajuste_manual",
            campo: "meta_vgl",
            valor_anterior: String(anterior.meta_vgl),
            valor_novo: v.vgl || "0",
          };
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      setRascunho({});
      toast.success("Metas ajustadas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarStatus = useMutation({
    mutationFn: async () => {
      if (!cicloAtual) throw new Error("Selecione um ciclo.");
      const novoStatus = cicloAtual.status === "aberto" ? "encerrado" : "aberto";
      const { error } = await supabase
        .from("ciclos")
        .update({ status: novoStatus } as never)
        .eq("id", cicloAtual.id);
      if (error) throw new Error(error.message);
      await registrarAuditoria([
        {
          entidade: "ciclo",
          entidade_id: cicloAtual.id,
          referencia: cicloAtual.nome,
          acao: "alteracao_status",
          campo: "status",
          valor_anterior: cicloAtual.status,
          valor_novo: novoStatus,
        },
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ciclos"] });
      qc.invalidateQueries({ queryKey: ["auditoria"] });
      toast.success("Status do ciclo atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const somaEquipes = equipes.reduce(
    (s, e) => s + metaDe(metas, idAtual, { equipeId: e.id }).meta_vgl,
    0,
  );

  return (
    <AppShell
      title="Ciclos e Metas"
      subtitle="Cada ciclo define o período de apuração e a meta global. A meta é distribuída automaticamente entre equipes e consultores e pode ser ajustada individualmente — todo ajuste é auditado."
      actions={
        <div className="flex gap-2">
          {cicloAtual && (
            <Button variant="secondary" onClick={() => alternarStatus.mutate()}>
              {cicloAtual.status === "aberto" ? "Encerrar ciclo" : "Reabrir ciclo"}
            </Button>
          )}
          <Button onClick={() => setNovo(true)}>
            <Plus className="size-4" /> Novo ciclo
          </Button>
        </div>
      }
    >
      <div className="panel mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Ciclo</Label>
          <Select value={idAtual} onValueChange={setCicloId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um ciclo" />
            </SelectTrigger>
            <SelectContent>
              {ciclos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} • {c.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="label-caps">Período</p>
          <p className="mt-1 text-sm">
            {cicloAtual
              ? `${dateBR(cicloAtual.data_inicio)} a ${dateBR(cicloAtual.data_fim)}`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Meta global {brl(cicloAtual?.meta_vgl ?? 0)} • {cicloAtual?.meta_contratos ?? 0}{" "}
            contratos
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="secondary" onClick={() => distribuir.mutate()} disabled={!cicloAtual}>
            <Wand2 className="size-4" /> Distribuir metas
          </Button>
          <Button
            onClick={() => salvarAjustes.mutate()}
            disabled={!Object.keys(rascunho).length}
          >
            <Save className="size-4" /> Salvar ajustes
          </Button>
        </div>
      </div>

      {somaEquipes > 0 && cicloAtual && somaEquipes !== cicloAtual.meta_vgl && (
        <p className="panel mb-6 p-4 text-sm text-chart-5">
          A soma das metas das equipes ({brl(somaEquipes)}) difere da meta global do ciclo (
          {brl(cicloAtual.meta_vgl)}).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Metas por equipe</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Ajuste manual sobrepõe a distribuição automática.
          </p>
          <div className="space-y-5">
            {equipes.map((e) => {
              const atual = metaDe(metas, idAtual, { equipeId: e.id });
              const v = valorMeta(`equipe:${e.id}`, atual);
              const ids = new Set(
                consultores.filter((c) => c.equipe_id === e.id).map((c) => c.id),
              );
              const ind = calcularIndicadores(doCiclo.filter((j) => ids.has(j.consultor_id)));
              return (
                <div key={e.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">{e.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {brl(ind.vgl)} realizado
                    </p>
                  </div>
                  <Progress
                    value={Math.min(100, atual.meta_vgl ? (ind.vgl / atual.meta_vgl) * 100 : 0)}
                    className="mt-2 h-2"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="label-caps">Meta VGL</Label>
                      <Input
                        type="number"
                        value={v.vgl}
                        onChange={(ev) =>
                          setRascunho((p) => ({
                            ...p,
                            [`equipe:${e.id}`]: { ...v, vgl: ev.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="label-caps">Meta contratos</Label>
                      <Input
                        type="number"
                        value={v.contratos}
                        onChange={(ev) =>
                          setRascunho((p) => ({
                            ...p,
                            [`equipe:${e.id}`]: { ...v, contratos: ev.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {equipes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada.</p>
            )}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Metas por consultor</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Somente consultores ativos recebem meta individual.
          </p>
          <div className="space-y-4">
            {consultores.map((c) => {
              const atual = metaDe(metas, idAtual, { consultorId: c.id });
              const v = valorMeta(`consultor:${c.id}`, atual);
              const ind = calcularIndicadores(doCiclo.filter((j) => j.consultor_id === c.id));
              return (
                <div key={c.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">{c.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {brl(ind.vgl)} •{" "}
                      {pct(atual.meta_vgl ? (ind.vgl / atual.meta_vgl) * 100 : 0, 0)} da meta
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      aria-label={`Meta de VGL de ${c.nome}`}
                      value={v.vgl}
                      onChange={(ev) =>
                        setRascunho((p) => ({
                          ...p,
                          [`consultor:${c.id}`]: { ...v, vgl: ev.target.value },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      aria-label={`Meta de contratos de ${c.nome}`}
                      value={v.contratos}
                      onChange={(ev) =>
                        setRascunho((p) => ({
                          ...p,
                          [`consultor:${c.id}`]: { ...v, contratos: ev.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
            {consultores.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum consultor ativo.</p>
            )}
          </div>
        </section>
      </div>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo ciclo comercial</DialogTitle>
            <DialogDescription>
              Defina o período de apuração e a meta global da empresa para o ciclo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome">Nome do ciclo</Label>
              <Input
                id="nome"
                placeholder="Ciclo 2026/01"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ini">Início</Label>
              <Input
                id="ini"
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fim">Fim</Label>
              <Input
                id="fim"
                type="date"
                value={form.data_fim}
                onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mv">Meta de VGL (R$)</Label>
              <Input
                id="mv"
                type="number"
                value={form.meta_vgl}
                onChange={(e) => setForm({ ...form, meta_vgl: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mc">Meta de contratos</Label>
              <Input
                id="mc"
                type="number"
                value={form.meta_contratos}
                onChange={(e) => setForm({ ...form, meta_contratos: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovo(false)}>
              Cancelar
            </Button>
            <Button onClick={() => criarCiclo.mutate()} disabled={criarCiclo.isPending}>
              Criar ciclo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
