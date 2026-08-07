import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dataQueries } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Trilha de auditoria completa da plataforma: quem alterou, quando, qual campo, valor anterior e valor novo.",
      },
      { property: "og:title", content: "Auditoria | Adim Aluguéis" },
      {
        property: "og:description",
        content: "Rastreabilidade total das alterações na operação comercial da Adim Aluguéis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditoriaPage,
});

const carimbo = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function AuditoriaPage() {
  const [busca, setBusca] = useState("");
  const [entidade, setEntidade] = useState("all");
  const { data, isLoading } = useQuery(dataQueries.auditoria());
  const registros = data ?? [];

  const entidades = useMemo(
    () => [...new Set(registros.map((r) => r.entidade))].sort(),
    [registros],
  );

  const filtrados = registros.filter((r) => {
    if (entidade !== "all" && r.entidade !== entidade) return false;
    if (!busca.trim()) return true;
    const alvo = `${r.referencia ?? ""} ${r.usuario} ${r.acao} ${r.campo ?? ""}`.toLowerCase();
    return alvo.includes(busca.trim().toLowerCase());
  });

  return (
    <AppShell
      title="Auditoria"
      subtitle="Todo lançamento, correção e movimentação registra usuário, data, hora, campo alterado, valor anterior e valor novo. Nenhum registro da plataforma é excluído."
    >
      <div className="panel mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="busca">Buscar</Label>
          <Input
            id="busca"
            placeholder="Cliente, consultor, usuário, campo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Entidade</Label>
          <Select value={entidade} onValueChange={setEntidade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              {entidades.map((e) => (
                <SelectItem key={e} value={e}>
                  {e.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-6 py-3">Data e hora</th>
                <th className="label-caps px-3 py-3">Usuário</th>
                <th className="label-caps px-3 py-3">Entidade</th>
                <th className="label-caps px-3 py-3">Referência</th>
                <th className="label-caps px-3 py-3">Ação</th>
                <th className="label-caps px-3 py-3">Campo</th>
                <th className="label-caps px-6 py-3">Alteração</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id} className="border-b border-border/50 align-top last:border-0">
                  <td className="px-6 py-3 font-mono text-xs whitespace-nowrap">
                    {carimbo(r.created_at)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.usuario}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.entidade.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3">{r.referencia ?? "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.acao.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.campo ?? "—"}</td>
                  <td className="px-6 py-3 text-xs">
                    <span className="text-muted-foreground line-through">
                      {r.valor_anterior ?? "vazio"}
                    </span>
                    {" → "}
                    <span className="font-medium">{r.valor_novo ?? "vazio"}</span>
                    {r.justificativa && (
                      <p className="mt-1 text-muted-foreground">{r.justificativa}</p>
                    )}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-sm text-muted-foreground">
                    {isLoading ? "Carregando trilha de auditoria…" : "Nenhum registro encontrado."}
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
