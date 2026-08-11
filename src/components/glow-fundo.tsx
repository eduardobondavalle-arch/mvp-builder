import { useEffect, useRef } from "react";

import { useTema } from "@/lib/tema";

/**
 * Camada de iluminação ambiente (somente modo escuro).
 * Dois glows laranja muito difusos que acompanham o cursor com inércia.
 * Puramente visual: fixa, atrás de tudo e sem capturar ponteiro.
 */
export function GlowFundo() {
  const { tema } = useTema();
  const camadaA = useRef<HTMLDivElement>(null);
  const camadaB = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("GLOW effect", tema);
    if (tema !== "dark") return;

    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const semMouse = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (semMovimento || semMouse) return;

    // alvo e posição atual em fração da viewport (0..1)
    let alvoX = 0.5;
    let alvoY = 0.35;
    let aX = 0.5;
    let aY = 0.35;
    let bX = 0.5;
    let bY = 0.35;
    let raf = 0;
    let ativo = false;

    const onMove = (e: PointerEvent | MouseEvent) => {
      alvoX = e.clientX / window.innerWidth;
      alvoY = e.clientY / window.innerHeight;
      if (!ativo) {
        ativo = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      if (!(window as any).__g) { (window as any).__g = 1; console.log("GLOW tick"); }
      // interpolação suave: camada A mais responsiva, B lenta e maior
      aX += (alvoX - aX) * 0.035;
      aY += (alvoY - aY) * 0.035;
      bX += (alvoX - bX) * 0.012;
      bY += (alvoY - bY) * 0.012;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // parallax: deslocamento parcial, o glow não fica exatamente sob o cursor
      const ax = (aX - 0.5) * w * 0.55;
      const ay = (aY - 0.5) * h * 0.5;
      const bx = (bX - 0.5) * w * 0.32;
      const by = (bY - 0.5) * h * 0.28;

      camadaA.current?.style.setProperty("transform", `translate3d(${ax}px, ${ay}px, 0)`);
      camadaB.current?.style.setProperty("transform", `translate3d(${bx}px, ${by}px, 0)`);

      const parado =
        Math.abs(alvoX - aX) < 0.0005 &&
        Math.abs(alvoY - aY) < 0.0005 &&
        Math.abs(alvoX - bX) < 0.0005 &&
        Math.abs(alvoY - bY) < 0.0005;

      if (parado) {
        ativo = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [tema]);

  if (tema !== "dark") return null;

  return (
    <div aria-hidden="true" className="glow-fundo">
      <div ref={camadaB} className="glow-camada glow-camada-b" />
      <div ref={camadaA} className="glow-camada glow-camada-a" />
    </div>
  );
}
