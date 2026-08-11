import { useEffect, useRef } from "react";

import { useTema } from "@/lib/tema";

/**
 * Iluminação ambiente interativa - somente modo escuro.
 *
 * Pequeno foco de luz laranja acompanha o cursor com inércia
 * e deixa um rastro luminoso suave que desaparece gradualmente.
 *
 * Canvas puro + requestAnimationFrame.
 * Nenhum estado React é atualizado durante o movimento.
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

    // ============================================================
    // POSIÇÃO E INÉRCIA
    // ============================================================

    let alvoX = w * 0.5;
    let alvoY = h * 0.35;

    let x = alvoX;
    let y = alvoY;

    let vx = 0;
    let vy = 0;

    // ============================================================
    // CONFIGURAÇÕES DO EFEITO
    // ============================================================

    // Vida do rastro.
    // 2800ms = aproximadamente 2,8 segundos.
    const VIDA_RASTRO = 2800;

    // Ponto principal menor que a versão anterior.
    const RAIO_FOCO = 58;

    // Distância mínima para criar um novo ponto do rastro.
    // Quanto menor, mais contínuo será o rastro.
    const DISTANCIA_RASTRO = 3;

    // Quantidade máxima de pontos armazenados.
    const MAX_PONTOS = 240;

    // ============================================================
    // RASTRO
    // ============================================================

    type Ponto = {
      x: number;
      y: number;
      nascimento: number;
      raio: number;
    };

    const rastro: Ponto[] = [];

    let raf = 0;
    let ultimoMovimento = performance.now();
    let visivel = true;

    // ============================================================
    // MOUSE
    // ============================================================

    const onMove = (e: PointerEvent) => {
      alvoX = e.clientX;
      alvoY = e.clientY;

      ultimoMovimento = performance.now();

      if (!raf && visivel) {
        raf = requestAnimationFrame(tick);
      }
    };

    // ============================================================
    // DESENHO DA LUZ
    // ============================================================

    const desenharLuz = (px: number, py: number, raio: number, alpha: number) => {
      if (alpha <= 0.001 || raio <= 0) return;

      const gradiente = ctx.createRadialGradient(px, py, 0, px, py, raio);

      gradiente.addColorStop(0, `rgba(255, 145, 45, ${alpha})`);

      gradiente.addColorStop(0.25, `rgba(255, 120, 30, ${alpha * 0.75})`);

      gradiente.addColorStop(0.55, `rgba(235, 90, 20, ${alpha * 0.38})`);

      gradiente.addColorStop(0.8, `rgba(215, 75, 10, ${alpha * 0.12})`);

      gradiente.addColorStop(1, "rgba(215, 75, 10, 0)");

      ctx.fillStyle = gradiente;

      ctx.beginPath();
      ctx.arc(px, py, raio, 0, Math.PI * 2);
      ctx.fill();
    };

    // ============================================================
    // ANIMAÇÃO
    // ============================================================

    const tick = () => {
      const agora = performance.now();

      // ----------------------------------------------------------
      // INÉRCIA
      // ----------------------------------------------------------

      const k = 0.065;
      const damp = 0.82;

      vx = (vx + (alvoX - x) * k) * damp;
      vy = (vy + (alvoY - y) * k) * damp;

      x += vx;
      y += vy;

      const velocidade = Math.hypot(vx, vy);

      // ----------------------------------------------------------
      // CRIAÇÃO DO RASTRO
      // ----------------------------------------------------------

      const ultimo = rastro[rastro.length - 1];

      const distanciaDesdeUltimo = ultimo ? Math.hypot(x - ultimo.x, y - ultimo.y) : Infinity;

      if (distanciaDesdeUltimo >= DISTANCIA_RASTRO) {
        rastro.push({
          x,
          y,
          nascimento: agora,

          // O rastro é menor que o foco principal.
          raio: RAIO_FOCO * 0.55,
        });

        // Limita memória do canvas.
        if (rastro.length > MAX_PONTOS) {
          rastro.shift();
        }
      }

      // ----------------------------------------------------------
      // LIMPA O FRAME
      // ----------------------------------------------------------

      ctx.clearRect(0, 0, w, h);

      // Adiciona as luzes umas às outras,
      // criando uma aparência mais luminosa.
      ctx.globalCompositeOperation = "lighter";

      // ----------------------------------------------------------
      // RASTRO
      // ----------------------------------------------------------

      for (let i = rastro.length - 1; i >= 0; i--) {
        const ponto = rastro[i];

        if (!ponto) continue;

        const idade = agora - ponto.nascimento;
        const progresso = idade / VIDA_RASTRO;

        // Remove pontos antigos.
        if (progresso >= 1) {
          rastro.splice(i, 1);
          continue;
        }

        // --------------------------------------------------------
        // FADE DO RASTRO
        // --------------------------------------------------------

        // Mantém o rastro perceptível no começo,
        // depois desaparece progressivamente.
        const fade = Math.pow(1 - progresso, 1.15);

        // Aumenta a intensidade conforme a velocidade.
        const intensidadeMovimento = Math.min(velocidade / 25, 1);

        /*
         * ANTES:
         * ~7% a 11%
         *
         * AGORA:
         * ~12% a 20%
         *
         * Isso torna o rastro claramente perceptível
         * sem transformar o fundo em uma mancha laranja.
         */
        const alphaRastro = (0.12 + intensidadeMovimento * 0.08) * fade;

        // O rastro fica levemente menor conforme envelhece.
        const raioRastro = ponto.raio * (0.7 + fade * 0.3);

        desenharLuz(ponto.x, ponto.y, raioRastro, alphaRastro);
      }

      // ----------------------------------------------------------
      // FOCO PRINCIPAL
      // ----------------------------------------------------------

      /*
       * O foco foi reduzido.

       * A intenção é:
       * - foco pequeno;
       * - rastro mais importante;
       * - nada de uma grande mancha laranja.
       */

      const brilhoFoco = 0.2 + Math.min(velocidade / 35, 1) * 0.07;

      // Halo externo
      desenharLuz(x, y, RAIO_FOCO * 1.35, brilhoFoco * 0.3);

      // Corpo principal
      desenharLuz(x, y, RAIO_FOCO, brilhoFoco * 0.8);

      // Núcleo
      desenharLuz(x, y, RAIO_FOCO * 0.38, brilhoFoco * 0.45);

      ctx.globalCompositeOperation = "source-over";

      // ----------------------------------------------------------
      // CONTROLE DA ANIMAÇÃO
      // ----------------------------------------------------------

      const semVelocidade = velocidade < 0.03;

      const semRastro = rastro.length === 0;

      const passouTempo = agora - ultimoMovimento > 500;

      /*
       * Mesmo quando o mouse para,
       * o RAF continua enquanto existir rastro.
       *
       * Isso é importante para permitir que o rastro
       * desapareça naturalmente durante os ~3 segundos.
       */
      if (semVelocidade && semRastro && passouTempo) {
        raf = 0;
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    // ============================================================
    // VISIBILIDADE DA ABA
    // ============================================================

    const onVisibilidade = () => {
      visivel = !document.hidden;

      if (!visivel && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      if (visivel && !raf) {
        raf = requestAnimationFrame(tick);
      }
    };

    // ============================================================
    // EVENTOS
    // ============================================================

    window.addEventListener("pointermove", onMove, { passive: true });

    window.addEventListener("resize", redimensionar);

    document.addEventListener("visibilitychange", onVisibilidade);

    // Inicia a animação.
    raf = requestAnimationFrame(tick);

    // ============================================================
    // CLEANUP
    // ============================================================

    return () => {
      window.removeEventListener("pointermove", onMove);

      window.removeEventListener("resize", redimensionar);

      document.removeEventListener("visibilitychange", onVisibilidade);

      if (raf) {
        cancelAnimationFrame(raf);
      }
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
