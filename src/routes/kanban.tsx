import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, ArrowRight, History } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FiltrosBar } from "@/components/filtros-bar";
import { MoverEtapaDialog } from "@/components/mover-etapa-dialog";
import { NovaPropostaDialog } from "@/components/nova-proposta-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dataQueries, ETAPAS, type Etapa, type Jornada } from "@/lib/data";
import { brl, dateBR, pct } from "@/lib/format";
import { aplicarFiltros, filtrosVazios } from "@/lib/metrics";

export const Route = createFileRoute("/kanban")({
  head: () => ({
    meta: [
      { title: "Jornada Comercial | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Kanban das jornadas comerciais da Adim Aluguéis: proposta, fechamento, contrato assinado e negócio perdido com histórico completo.",
      },
      { property: "og:title", content: "Jornada Comercial | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "Cada card é uma jornada comercial completa, com validação por etapa, justificativas e auditoria de movimentações.",
      },
    ],
  }),
  component: KanbanPage,
});

const etapaCor: Record<Etapa, string> = {
  proposta: "border-l-chart-2",
  fechamento: "border-l-chart-1",
  contrato_assinado: "border-l-chart-3",
  negocio_perdido: "border-l-chart-5",
};

function KanbanPage() {
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [novaAberta, setNovaAberta] = useState(false);
  const [mover, setMover] = useState<{ jornada: Jornada; destino: Etapa } | null>(null);
  const [detalhe, setDetalhe] = useState<Jornada | null>(null);

  const results = useQueries({
    queries: [
      dataQueries.jornadas(),
      dataQueries.consultores(),
      dataQueries.equipes(),
      dataQueries.canais(),
      dataQueries.ciclos(),
      dataQueries.motivos(),
    ],
  });
  const jornadas = results[0].data ?? [];
  const consultores = results[1].data ?? [];
  const equipes = results[2].data ?? [];
  const canais = results[3].data ?? [];
  const ciclos = results[4].data ?? [];
  const motivos = results[5].data ?? [];

  const nomeConsultor = new Map(consultores.map((c) => [c.id, c.nome]));
  const nomeCanal = new Map(canais.map((c) => [c.id, c.nome]));

  const filtradas = useMemo(
    () => aplicarFiltros(jornadas, filtros, consultores, ciclos),
    [jornadas, filtros, consultores, ciclos],
  );

  const historico = useQuery({
    ...dataQueries.eventos(detalhe?.id ?? ""),
    enabled: Boolean(detalhe),
  });

  return (
    <AppShell
      title="Jornada Comercial"
      subtitle="Cada card representa a jornada completa de um cliente. Nenhuma informação é excluída e toda movimentação exige as informações obrigatórias da etapa."
      actions={
        <Button onClick={() => setNovaAberta(true)}>
          <Plus className="size-4" /> Nova proposta
        </Button>
      }
    >
      <div className="panel mb-6 p-5">
        <FiltrosBar
          filtros={filtros}
          onChange={setFiltros}
          ciclos={ciclos}
          equipes={equipes}
          consultores={consultores}
          canais={canais}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {ETAPAS.map((etapa) => {
          const cards = filtradas.filter((j) => j.etapa === etapa.key);
          const soma = cards.reduce(
            (s, j) => s + (j.valor_final ?? j.valor_atualizado ?? j.valor_proposta),
            0,
          );
          return (
            <section key={etapa.key} className="panel flex flex-col p-4">
              <header className="mb-3 border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{etapa.label}</h2>
                  <Badge variant="secondary" className="font-mono">
                    {cards.length}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{etapa.hint}</p>
                <p className="mt-1 font-mono text-xs text-primary">{brl(soma)}</p>
              </header>

              <div className="flex flex-col gap-3">
                {cards.map((j) => (
                  <article
                    key={j.id}
                    className={`rounded-lg border border-border border-l-2 bg-secondary/40 p-3 ${etapaCor[j.etapa]}`}
                  >
                    <button
                      className="text-left"
                      onClick={() => setDetalhe(j)}
                      aria-label={`Ver histórico de ${j.cliente_nome}`}
                    >
                      <p className="text-sm font-medium">{j.cliente_nome}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{j.imovel}</p>
                    </button>
                    <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <dt>Consultor</dt>
                        <dd className="text-foreground">{nomeConsultor.get(j.consultor_id)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Canal</dt>
                        <dd>{nomeCanal.get(j.canal_id)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{j.valor_final ? "Locação" : "Proposta"}</dt>
                        <dd className="font-mono text-foreground">
                          {brl(j.valor_final ?? j.valor_atualizado ?? j.valor_proposta)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Intermediação</dt>
                        <dd className="font-mono">{pct(j.percentual_intermediacao, 0)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={() => setDetalhe(j)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <History className="size-3" /> Histórico
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="secondary" className="h-7 text-xs">
                            Mover <ArrowRight className="size-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ETAPAS.filter((e) => e.key !== j.etapa).map((e) => (
                            <DropdownMenuItem
                              key={e.key}
                              onClick={() => setMover({ jornada: j, destino: e.key })}
                            >
                              {e.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </article>
                ))}
                {cards.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Nenhuma jornada nesta etapa.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <NovaPropostaDialog
        open={novaAberta}
        onOpenChange={setNovaAberta}
        consultores={consultores}
        canais={canais}
        jornadas={jornadas}
      />

      {mover && (
        <MoverEtapaDialog
          jornada={mover.jornada}
          destino={mover.destino}
          motivos={motivos}
          onClose={() => setMover(null)}
        />
      )}

      <Dialog open={Boolean(detalhe)} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle>{detalhe.cliente_nome}</DialogTitle>
                <DialogDescription>
                  CPF {detalhe.cpf} • {detalhe.telefone} • jornada única do cliente
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Imóvel", detalhe.imovel],
                  ["Consultor", nomeConsultor.get(detalhe.consultor_id) ?? "—"],
                  ["Canal", nomeCanal.get(detalhe.canal_id) ?? "—"],
                  ["Etapa atual", detalhe.etapa.replace("_", " ")],
                  ["1º contato", dateBR(detalhe.data_primeiro_contato)],
                  ["Entrada no CRM", dateBR(detalhe.data_entrada_crm)],
                  ["Visita", dateBR(detalhe.data_visita)],
                  ["Proposta", dateBR(detalhe.data_proposta)],
                  ["Valor original", brl(detalhe.valor_original)],
                  ["Valor da proposta", brl(detalhe.valor_proposta)],
                  ["Valor atualizado", detalhe.valor_atualizado ? brl(detalhe.valor_atualizado) : "—"],
                  ["Valor final (VGL)", detalhe.valor_final ? brl(detalhe.valor_final) : "—"],
                  ["Intermediação", pct(detalhe.percentual_intermediacao, 0)],
                  [
                    "Receita prevista",
                    detalhe.valor_final
                      ? brl((detalhe.valor_final * detalhe.percentual_intermediacao) / 100)
                      : "—",
                  ],
                  ["Envio do contrato", dateBR(detalhe.data_envio_contrato)],
                  ["Assinatura", dateBR(detalhe.data_assinatura)],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border border-border p-3">
                    <dt className="label-caps">{k}</dt>
                    <dd className="mt-1">{v}</dd>
                  </div>
                ))}
              </dl>
              {detalhe.descricao_perda && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  Perda: {detalhe.descricao_perda}
                </p>
              )}
              <div>
                <p className="label-caps mb-2">Auditoria da jornada</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {(historico.data ?? []).map((e) => (
                    <li key={e.id} className="rounded-lg border border-border p-2.5">
                      <span className="text-foreground">{e.tipo.replace(/_/g, " ")}</span>{" "}
                      {e.etapa_anterior && e.etapa_nova
                        ? `• ${e.etapa_anterior.replace("_", " ")} → ${e.etapa_nova.replace("_", " ")}`
                        : ""}
                      <br />
                      {dateBR(e.created_at)}
                      {e.justificativa ? ` • ${e.justificativa}` : ""}
                    </li>
                  ))}
                  {(historico.data ?? []).length === 0 && <li>Sem eventos registrados.</li>}
                </ul>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
