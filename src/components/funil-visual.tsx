import { pct } from "@/lib/format";

type Etapa = { etapa: string; valor: number; origem: "empresa" | "diario" | "kanban" };

type FunilSize = "sm" | "md" | "lg";

const CONFIG: Record<FunilSize, { min: number; labelCol: string; valueCol: string; height: string; text: string }> = {
  sm: { min: 28, labelCol: "5.5rem", valueCol: "3.5rem", height: "h-10", text: "text-xs" },
  md: { min: 32, labelCol: "8rem", valueCol: "5rem", height: "h-14", text: "text-sm" },
  lg: { min: 44, labelCol: "10rem", valueCol: "6rem", height: "h-20", text: "text-lg" },
};

export function FunilVisual({ etapas, size = "md" }: { etapas: Etapa[]; size?: FunilSize }) {
  if (etapas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no recorte selecionado.</p>;
  }

  const cfg = CONFIG[size];
  const topo = Math.max(...etapas.map((e) => e.valor), 1);
  const larguras = etapas.map((e) => cfg.min + (100 - cfg.min) * Math.min(1, e.valor / topo));

  return (
    <div className="stagger-rows w-full space-y-1">
      {etapas.map((e, i) => {
        const larguraAtual = larguras[i]!;
        const larguraProxima = larguras[i + 1] ?? Math.max(cfg.min, larguraAtual * 0.82);
        const recuoTopo = (100 - larguraAtual) / 2;
        const recuoBase = (100 - larguraProxima) / 2;
        const anterior = etapas[i - 1];
        const conversao = anterior && anterior.valor ? (e.valor / anterior.valor) * 100 : null;

        return (
          <div
            key={e.etapa}
            className="grid items-center gap-2 sm:gap-3"
            style={{
              gridTemplateColumns: `${cfg.labelCol} 1fr ${cfg.valueCol}`,
            }}
          >
            <span className="label-caps truncate">{e.etapa}</span>
            <div className={`relative flex ${cfg.height} items-center justify-center overflow-visible`}>
              <div
                className="absolute inset-0 transition-[filter] duration-200 hover:brightness-105"
                style={{
                  clipPath: `polygon(${recuoTopo}% 0%, ${100 - recuoTopo}% 0%, ${100 - recuoBase}% 100%, ${recuoBase}% 100%)`,
                  background: `color-mix(in oklab, var(--chart-${(i % 5) + 1}) 82%, transparent)`,
                }}
              />
              <span className={`relative z-10 whitespace-nowrap font-mono font-semibold text-background ${cfg.text}`}>
                {e.valor.toLocaleString("pt-BR")}
              </span>
            </div>
            <span className="text-right font-mono text-xs text-muted-foreground">
              {conversao === null ? "—" : pct(conversao, 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
