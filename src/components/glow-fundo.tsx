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

    // Tempo de vida do rastro.
    // O rastro desaparece gradualmente em aproximadamente 2,8 segundos.
    const VIDA_RASTRO = 2800;

    // Tamanho do foco principal.
    // Mantemos pequeno para evitar o efeito de uma grande mancha laranja.
    const RAIO_FOCO = 58;

    // Distância mínima percorrida antes de criar outro ponto.
    // Quanto menor, mais contínuo será o rastro.
    const DISTANCIA_RASTRO = 3;

    // Limite de pontos armazenados.
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
    // MOVIMENTO DO MOUSE
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

      // Núcleo laranja mais luminoso
      gradiente.addColorStop(0, `rgba(255, 145, 45, ${alpha})`);

      // Transição suave
      gradiente.addColorStop(0.25, `rgba(255, 120, 30, ${alpha * 0.75})`);

      // Corpo do glow
      gradiente.addColorStop(0.55, `rgba(235, 90, 20, ${alpha * 0.38})`);

      // Halo externo
      gradiente.addColorStop(0.8, `rgba(215, 75, 10, ${alpha * 0.12})`);

      // Transparência total nas bordas
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
      // INÉRCIA DO FOCO
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

          // Rastro ligeiramente maior que antes,
          // mas ainda menor que o foco principal.
          raio: RAIO_FOCO * 0.62,
        });

        // Evita crescimento excessivo do array.
        if (rastro.length > MAX_PONTOS) {
          rastro.shift();
        }
      }

      // ----------------------------------------------------------
      // LIMPA O FRAME
      // ----------------------------------------------------------

      ctx.clearRect(0, 0, w, h);

      // Soma as luzes umas às outras.
      // Isso cria uma aparência mais luminosa e natural.
      ctx.globalCompositeOperation = "lighter";

      // ----------------------------------------------------------
      // DESENHA O RASTRO
      // ----------------------------------------------------------

      for (let i = rastro.length - 1; i >= 0; i--) {
        const ponto = rastro[i];

        if (!ponto) continue;

        const idade = agora - ponto.nascimento;

        const progresso = idade / VIDA_RASTRO;

        // Remove pontos que já passaram do tempo de vida.
        if (progresso >= 1) {
          rastro.splice(i, 1);
          continue;
        }

        // --------------------------------------------------------
        // FADE DO RASTRO
        // --------------------------------------------------------

        /*
         * O valor 1.05 deixa o rastro desaparecer
         * um pouco mais lentamente.
         *
         * Isso faz com que ele continue perceptível
         * durante boa parte dos 2,8 segundos.
         */
        const fade = Math.pow(1 - progresso, 1.05);

        // --------------------------------------------------------
        // INTENSIDADE BASEADA NA VELOCIDADE
        // --------------------------------------------------------

        const intensidadeMovimento = Math.min(velocidade / 25, 1);

        /*
         * Rastro mais visível.

         * Antes:
         * aproximadamente 12% → 20%

         * Agora:
         * aproximadamente 16% → 27%

         * A intensidade aumenta um pouco quando
         * o mouse se movimenta mais rapidamente.
         */
        const alphaRastro = (0.16 + intensidadeMovimento * 0.11) * fade;

        // --------------------------------------------------------
        // TAMANHO DO RASTRO
        // --------------------------------------------------------

        /*
         * O rastro diminui suavemente conforme envelhece.
         */
        const raioRastro = ponto.raio * (0.7 + fade * 0.3);

        desenharLuz(ponto.x, ponto.y, raioRastro, alphaRastro);
      }

      // ----------------------------------------------------------
      // FOCO PRINCIPAL
      // ----------------------------------------------------------

      /*
       * O foco continua pequeno.

       * A diferença é que agora ele possui
       * um pouco mais de luminosidade.
       */
      const brilhoFoco = 0.23 + Math.min(velocidade / 35, 1) * 0.08;

      // ----------------------------------------------------------
      // HALO EXTERNO
      // ----------------------------------------------------------

      desenharLuz(x, y, RAIO_FOCO * 1.35, brilhoFoco * 0.3);

      // ----------------------------------------------------------
      // CORPO PRINCIPAL
      // ----------------------------------------------------------

      desenharLuz(x, y, RAIO_FOCO, brilhoFoco * 0.8);

      // ----------------------------------------------------------
      // NÚCLEO
      // ----------------------------------------------------------

      desenharLuz(x, y, RAIO_FOCO * 0.38, brilhoFoco * 0.45);

      ctx.globalCompositeOperation = "source-over";

      // ----------------------------------------------------------
      // CONTROLE DO REQUESTANIMATIONFRAME
      // ----------------------------------------------------------

      const semVelocidade = velocidade < 0.03;

      const semRastro = rastro.length === 0;

      const passouTempo = agora - ultimoMovimento > 500;

      /*
       * Quando o mouse para, o RAF continua enquanto
       * houver rastro na tela.

       * Dessa maneira o rastro consegue desaparecer
       * naturalmente durante os ~2,8 segundos.
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

    window.addEventListener("pointermove", onMove, {
      passive: true,
    });

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

  // Só renderiza o efeito no modo escuro.
  if (tema !== "dark") return null;

  return (
    <div aria-hidden="true" className="glow-fundo">
      <div className="glow-estatico" />

      <canvas ref={canvasRef} className="glow-canvas" />
    </div>
  );
}
