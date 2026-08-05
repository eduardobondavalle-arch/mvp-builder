import { pct } from "@/lib/format";

type Etapa = { etapa: string; valor: number; origem: "empresa" | "diario" | "kanban" };

const MIN_LARGURA = 22;

export function FunilVisual({ etapas }: { etapas: Etapa[] }) {
  if (etapas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no recorte selecionado.</p>;
  }

  const topo = Math.max(...etapas.map((e) => e.valor), 1);
  const larguras = etapas.map((e) => MIN_LARGURA + (100 - MIN_LARGURA) * Math.min(1, e.valor / topo));

  return (
    <div className="space-y-1">
      {etapas.map((e, i) => {
        const larguraAtual = larguras[i]!;
        const larguraProxima = larguras[i + 1] ?? Math.max(MIN_LARGURA, larguraAtual * 0.82);
        const recuoTopo = (100 - larguraAtual) / 2;
        const recuoBase = (100 - larguraProxima) / 2;
        const anterior = etapas[i - 1];
        const conversao = anterior && anterior.valor ? (e.valor / anterior.valor) * 100 : null;

        return (
          <div key={e.etapa} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[7rem_1fr_auto]">
            <span className="label-caps hidden sm:block">{e.etapa}</span>
            <div
              className="relative flex h-14 items-center justify-center"
              style={{
                clipPath: `polygon(${recuoTopo}% 0%, ${100 - recuoTopo}% 0%, ${100 - recuoBase}% 100%, ${recuoBase}% 100%)`,
                background: `color-mix(in oklab, var(--chart-${(i % 5) + 1}) 82%, transparent)`,
              }}
            >
              <span className="text-sm font-semibold text-background sm:hidden">
                {e.etapa} · {e.valor.toLocaleString("pt-BR")}
              </span>
              <span className="hidden font-mono text-sm font-semibold text-background sm:block">
                {e.valor.toLocaleString("pt-BR")}
              </span>
            </div>
            <span className="w-16 text-right font-mono text-xs text-muted-foreground">
              {conversao === null ? "—" : pct(conversao, 1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
