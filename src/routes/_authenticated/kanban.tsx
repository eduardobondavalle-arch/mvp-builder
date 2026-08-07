import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, ArrowRight, History, Pencil, UserRoundCog } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EditarJornadaDialog } from "@/components/editar-jornada-dialog";
import { FiltrosBar } from "@/components/filtros-bar";
import { MoverEtapaDialog } from "@/components/mover-etapa-dialog";
import { NovaPropostaDialog } from "@/components/nova-proposta-dialog";
import { TransferirConsultorDialog } from "@/components/transferir-consultor-dialog";
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
import { filtrarConsultores, filtrarEquipes, useAcesso } from "@/lib/acesso";
import { dataQueries, ETAPAS, etapaLabel, type Etapa, type Jornada } from "@/lib/data";
import { brl, dateBR, pct } from "@/lib/format";
import { aplicarFiltros, filtrosVazios } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/kanban")({
  head: () => ({
    meta: [
      { title: "Jornada Comercial | Adim Aluguéis" },
      {
        name: "description",
        content:
          "Kanban das jornadas comerciais da Adim Aluguéis: proposta, fechamento, contrato assinado e negócio perdido com transferências e histórico completo.",
      },
      { property: "og:title", content: "Jornada Comercial | Adim Aluguéis" },
      {
        property: "og:description",
        content:
          "Cada card é uma jornada comercial completa, com validação por etapa, justificativas, transferência de consultor e auditoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [transferir, setTransferir] = useState<Jornada | null>(null);
  const [editar, setEditar] = useState<Jornada | null>(null);
  const [detalhe, setDetalhe] = useState<Jornada | null>(null);

  const acesso = useAcesso();
  const results = useQueries({
    queries: [
      dataQueries.jornadas(),
      dataQueries.consultores(),
      dataQueries.equipes(),
      dataQueries.canais(),
      dataQueries.ciclos(),
      dataQueries.motivos(),
      dataQueries.motivosTransferencia(),
    ],
  });
  const jornadas = results[0].data ?? [];
  const consultores = filtrarConsultores(results[1].data ?? [], acesso);
  const equipes = filtrarEquipes(results[2].data ?? [], acesso);
  const canais = results[3].data ?? [];
  const ciclos = results[4].data ?? [];
  const motivos = results[5].data ?? [];
  const motivosTransf = results[6].data ?? [];

  const nomeConsultor = new Map(consultores.map((c) => [c.id, c.nome]));
  const nomeCanal = new Map(canais.map((c) => [c.id, c.nome]));
  const nomeMotivo = new Map(motivos.map((m) => [m.id, m.nome]));

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
      subtitle="Cada card representa a jornada completa de um cliente — pessoa, não proposta. Nenhuma informação é excluída, cada movimentação exige as informações obrigatórias da etapa e correções ficam registradas na auditoria."
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
                      <div className="flex justify-between gap-2">
                        <dt>Consultor</dt>
                        <dd className="text-right text-foreground">
                          {nomeConsultor.get(j.consultor_id)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Canal</dt>
                        <dd className="text-right">{nomeCanal.get(j.canal_id)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{j.valor_final ? "Locação" : "Proposta"}</dt>
                        <dd className="font-mono text-foreground">
                          {brl(j.valor_final ?? j.valor_atualizado ?? j.valor_proposta)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Intermediação</dt>
                        <dd className="font-mono">{pct(j.percentual_intermediacao, 0)}</dd>
                      </div>
                      {j.etapa === "negocio_perdido" && j.motivo_perda_id && (
                        <div className="flex justify-between gap-2">
                          <dt>Motivo</dt>
                          <dd className="text-right">{nomeMotivo.get(j.motivo_perda_id)}</dd>
                        </div>
                      )}
                    </dl>
                    {(j.atingiu_contrato || j.motivo_reabertura) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {j.atingiu_contrato && j.etapa !== "contrato_assinado" && (
                          <Badge variant="outline" className="text-[10px]">
                            já contratou
                          </Badge>
                        )}
                        {j.motivo_reabertura && (
                          <Badge variant="outline" className="text-[10px]">
                            reaberta
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDetalhe(j)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Histórico de ${j.cliente_nome}`}
                        >
                          <History className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setEditar(j)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Corrigir jornada de ${j.cliente_nome}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setTransferir(j)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Transferir jornada de ${j.cliente_nome}`}
                        >
                          <UserRoundCog className="size-3.5" />
                        </button>
                      </div>
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

      {transferir && (
        <TransferirConsultorDialog
          jornada={transferir}
          consultores={consultores}
          motivos={motivosTransf}
          onClose={() => setTransferir(null)}
        />
      )}

      {editar && (
        <EditarJornadaDialog jornada={editar} canais={canais} onClose={() => setEditar(null)} />
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
                {(
                  [
                    ["Imóvel", detalhe.imovel],
                    ["Consultor", nomeConsultor.get(detalhe.consultor_id) ?? "—"],
                    ["Canal", nomeCanal.get(detalhe.canal_id) ?? "—"],
                    ["Etapa atual", etapaLabel(detalhe.etapa)],
                    ["1º contato", dateBR(detalhe.data_primeiro_contato)],
                    ["Entrada no CRM", dateBR(detalhe.data_entrada_crm)],
                    ["Visita", dateBR(detalhe.data_visita)],
                    ["Proposta", dateBR(detalhe.data_proposta)],
                    ["Fechamento", dateBR(detalhe.data_fechamento)],
                    ["Envio do contrato", dateBR(detalhe.data_envio_contrato)],
                    ["Assinatura", dateBR(detalhe.data_assinatura)],
                    ["Data da perda", dateBR(detalhe.data_perda)],
                    ["Valor original", brl(detalhe.valor_original)],
                    ["Valor da proposta", brl(detalhe.valor_proposta)],
                    ["Valor atualizado", brl(detalhe.valor_atualizado)],
                    ["Valor final (VGL)", brl(detalhe.valor_final)],
                    ["Intermediação", pct(detalhe.percentual_intermediacao)],
                    [
                      "Motivo da perda",
                      detalhe.motivo_perda_id
                        ? (nomeMotivo.get(detalhe.motivo_perda_id) ?? "—")
                        : "—",
                    ],
                  ] as [string, string][]
                ).map(([label, valor]) => (
                  <div key={label}>
                    <dt className="label-caps">{label}</dt>
                    <dd className="mt-0.5">{valor}</dd>
                  </div>
                ))}
              </dl>

              {(detalhe.descricao_perda ||
                detalhe.motivo_reabertura ||
                detalhe.justificativa_nova_jornada) && (
                <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
                  {detalhe.descricao_perda && (
                    <p>
                      <span className="label-caps block">Descrição da perda</span>
                      {detalhe.descricao_perda}
                    </p>
                  )}
                  {detalhe.motivo_reabertura && (
                    <p>
                      <span className="label-caps block">Motivo da reabertura</span>
                      {detalhe.motivo_reabertura}
                    </p>
                  )}
                  {detalhe.justificativa_nova_jornada && (
                    <p>
                      <span className="label-caps block">Justificativa da nova jornada</span>
                      {detalhe.justificativa_nova_jornada}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-border p-4">
                <p className="label-caps mb-2">Histórico da jornada</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {(historico.data ?? []).map((e) => (
                    <li key={e.id}>
                      <span className="font-mono text-foreground">
                        {new Date(e.created_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>{" "}
                      • {e.tipo.replace(/_/g, " ")}
                      {e.etapa_anterior && e.etapa_nova
                        ? ` • ${etapaLabel(e.etapa_anterior)} → ${etapaLabel(e.etapa_nova)}`
                        : e.etapa_nova
                          ? ` → ${etapaLabel(e.etapa_nova)}`
                          : ""}
                      {e.justificativa && <p className="mt-0.5">{e.justificativa}</p>}
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
