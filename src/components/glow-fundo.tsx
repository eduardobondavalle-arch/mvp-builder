import { useEffect, useRef } from "react";

import { useTema } from "@/lib/tema";

/**
 * Iluminação ambiente interativa (somente modo escuro).
 * Um pequeno foco de luz laranja muito difuso segue o cursor com inércia,
 * deixando um rastro orgânico que desaparece em poucos segundos.
 * Canvas puro em requestAnimationFrame: nenhum estado React por movimento.
 */
export function GlowFundo() {
  const { tema } = useTema();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (tema !== "dark") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const semMouse = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (semMovimento || semMouse) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const redimensionar = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    redimensionar();

    // foco: posição alvo (mouse) e posição suavizada (inércia)
    let alvoX = w * 0.5;
    let alvoY = h * 0.35;
    let x = alvoX;
    let y = alvoY;
    let vx = 0;
    let vy = 0;

    type Ponto = { x: number; y: number; nascimento: number; r: number };
    const rastro: Ponto[] = [];
    const VIDA = 3000; // ms (rastro visível por ~3s)
    const RAIO_FOCO = 86; // ~72px diâmetro (com blur CSS de 18px resulta em ~80-95px visual)

    let raf = 0;
    let ultimoMovimento = performance.now();
    let visivel = true;

    const onMove = (e: PointerEvent | MouseEvent) => {
      alvoX = e.clientX;
      alvoY = e.clientY;
      ultimoMovimento = performance.now();
      if (!raf && visivel) raf = requestAnimationFrame(tick);
    };

    const desenharLuz = (px: number, py: number, raio: number, alpha: number) => {
      if (alpha <= 0.001 || raio <= 0) return;
      const g = ctx.createRadialGradient(px, py, 0, px, py, raio);
      g.addColorStop(0, `rgba(255, 145, 45, ${alpha})`);
      g.addColorStop(0.4, `rgba(234, 96, 20, ${alpha * 0.55})`);
      g.addColorStop(0.75, `rgba(215, 75, 10, ${alpha * 0.15})`);
      g.addColorStop(1, "rgba(215, 75, 10, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, raio, 0, Math.PI * 2);
      ctx.fill();
    };

    const tick = () => {
      const agora = performance.now();

      // inércia: mola crítica suave (acelera e desacelera com elegância)
      const k = 0.06;
      const damp = 0.83;
      vx = (vx + (alvoX - x) * k) * damp;
      vy = (vy + (alvoY - y) * k) * damp;
      x += vx;
      y += vy;

      const vel = Math.hypot(vx, vy);

      // amostragem fluida do rastro acompanhando a trajetória real da partícula de luz
      const ultimo = rastro[rastro.length - 1];
      const dist = ultimo ? Math.hypot(x - ultimo.x, y - ultimo.y) : Infinity;
      if (dist > 5) {
        rastro.push({
          x: x,
          y: y,
          nascimento: agora,
          r: RAIO_FOCO * 0.65,
        });
        if (rastro.length > 200) rastro.shift();
      }

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // 1. Rastro suave e perceptível que desaparece gradualmente em ~3s
      for (let i = rastro.length - 1; i >= 0; i--) {
        const p = rastro[i];
        if (!p) continue;
        const idade = (agora - p.nascimento) / VIDA;
        if (idade >= 1) {
          rastro.splice(i, 1);
          continue;
        }
        const fade = Math.pow(1 - idade, 1.4); // desaparecimento suave e progressivo
        const alphaRastro = (0.075 + Math.min(vel / 35, 1) * 0.035) * fade;
        const raioRastro = p.r * (0.85 + (1 - fade) * 0.25);
        desenharLuz(p.x, p.y, raioRastro, alphaRastro);
      }

      // 2. Foco de luz principal (ponto de luz discreto, 18-24% de brilho, com halo suave)
      const brilho = 0.18 + Math.min(vel / 40, 1) * 0.06;

      // Halo externo sutil (aprox 8-12%)
      desenharLuz(x, y, RAIO_FOCO * 1.5, brilho * 0.35);

      // Ponto principal de luz
      desenharLuz(x, y, RAIO_FOCO, brilho * 0.85);

      // Núcleo difuso central
      desenharLuz(x, y, RAIO_FOCO * 0.4, brilho * 0.45);

      ctx.globalCompositeOperation = "source-over";

      const parado = vel < 0.05 && rastro.length === 0 && agora - ultimoMovimento > 500;
      if (parado) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onVisibilidade = () => {
      visivel = !document.hidden;
      if (!visivel && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", redimensionar);
    document.addEventListener("visibilitychange", onVisibilidade);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", redimensionar);
      document.removeEventListener("visibilitychange", onVisibilidade);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tema]);

  if (tema !== "dark") return null;

  return (
    <div aria-hidden="true" className="glow-fundo">
      <div className="glow-estatico" />
      <canvas ref={canvasRef} className="glow-canvas" />
    </div>
  );
}
