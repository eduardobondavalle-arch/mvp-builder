import { useEffect, useRef } from "react";

function Eye({
  size = 28,
  pupilSize = 10,
}: {
  size?: number;
  pupilSize?: number;
}) {
  return (
    <div
      className="login-eye relative flex items-center justify-center rounded-full bg-white"
      style={{
        width: size,
        height: size,
      }}
    >
      <div
        className="login-pupil absolute rounded-full bg-black"
        style={{
          width: pupilSize,
          height: pupilSize,
        }}
      />
    </div>
  );
}

export function LoginCharacters() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    let smoothX = 0;
    let smoothY = 0;

    let velocityX = 0;
    let lastMouseX = mouseX;

    let animationFrame = 0;

    function handleMouseMove(event: MouseEvent) {
      velocityX = event.clientX - lastMouseX;
      lastMouseX = event.clientX;

      mouseX = event.clientX;
      mouseY = event.clientY;
    }

    function animate() {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const normalizedX = Math.max(
        -1,
        Math.min(1, (mouseX - centerX) / centerX),
      );

      const normalizedY = Math.max(
        -1,
        Math.min(1, (mouseY - centerY) / centerY),
      );

      smoothX += (normalizedX - smoothX) * 0.055;
      smoothY += (normalizedY - smoothY) * 0.055;

      velocityX *= 0.88;

      /*
       * OLHOS
       */
      const eyes =
        container.querySelectorAll<HTMLElement>(".login-eye");

      eyes.forEach((eye) => {
        const pupil =
          eye.querySelector<HTMLElement>(".login-pupil");

        if (!pupil) return;

        const rect = eye.getBoundingClientRect();

        const eyeX = rect.left + rect.width / 2;
        const eyeY = rect.top + rect.height / 2;

        const dx = mouseX - eyeX;
        const dy = mouseY - eyeY;

        const angle = Math.atan2(dy, dx);

        const distance = Math.min(
          Math.sqrt(dx * dx + dy * dy) / 250,
          1,
        );

        const maxMove =
          Math.min(rect.width, rect.height) *
          0.2 *
          distance;

        const pupilX = Math.cos(angle) * maxMove;
        const pupilY = Math.sin(angle) * maxMove;

        pupil.style.transform = `
          translate3d(${pupilX}px, ${pupilY}px, 0)
        `;
      });

      /*
       * PERSONAGEM LARANJA
       *
       * Mais pesado e curioso.
       * Inclina bastante para os lados.
       */
      const orange =
        container.querySelector<HTMLElement>(
          '[data-character="orange"]',
        );

      if (orange) {
        const x = smoothX * 24;
        const y = smoothY * 7;

        const rotate = smoothX * 8;

        const horizontalStretch =
          1 + Math.abs(smoothX) * 0.12;

        const verticalSquash =
          1 - Math.abs(smoothX) * 0.05;

        const upwardStretch =
          smoothY < 0 ? Math.abs(smoothY) * 0.14 : 0;

        orange.style.transform = `
          translate3d(${x}px, ${y}px, 0)
          rotate(${rotate}deg)
          skewX(${smoothX * -3}deg)
          scaleX(${horizontalStretch})
          scaleY(${verticalSquash + upwardStretch})
        `;
      }

      /*
       * PERSONAGEM ROXO
       *
       * O mais elástico.
       * Estica bastante para cima.
       */
      const purple =
        container.querySelector<HTMLElement>(
          '[data-character="purple"]',
        );

      if (purple) {
        const x = smoothX * 31;

        const lookingUp = Math.max(0, -smoothY);

        const lookingDown = Math.max(0, smoothY);

        const y =
          smoothY * 9 -
          lookingUp * 20;

        const rotate = smoothX * 10;

        const stretchX =
          1 + Math.abs(smoothX) * 0.08;

        const stretchY =
          1 +
          lookingUp * 0.26 -
          lookingDown * 0.08;

        const skew =
          smoothX * -7;

        purple.style.transform = `
          translate3d(${x}px, ${y}px, 0)
          rotate(${rotate}deg)
          skewX(${skew}deg)
          scaleX(${stretchX})
          scaleY(${stretchY})
        `;
      }

      /*
       * PERSONAGEM PRETO
       *
       * Mais rápido e nervoso.
       * Reage também à velocidade do mouse.
       */
      const black =
        container.querySelector<HTMLElement>(
          '[data-character="black"]',
        );

      if (black) {
        const speedReaction = Math.max(
          -10,
          Math.min(10, velocityX * 0.12),
        );

        const x =
          smoothX * 34 +
          speedReaction;

        const y =
          smoothY * 10;

        const rotate =
          smoothX * 12 +
          speedReaction * 0.25;

        const stretchX =
          1 +
          Math.abs(smoothX) * 0.1 +
          Math.abs(speedReaction) * 0.003;

        const stretchY =
          1 -
          Math.abs(smoothX) * 0.04;

        black.style.transform = `
          translate3d(${x}px, ${y}px, 0)
          rotate(${rotate}deg)
          skewX(${smoothX * -5}deg)
          scaleX(${stretchX})
          scaleY(${stretchY})
        `;
      }

      /*
       * PERSONAGEM AMARELO
       *
       * Curioso.
       * Se projeta bastante para os lados
       * e levanta quando o mouse sobe.
       */
      const yellow =
        container.querySelector<HTMLElement>(
          '[data-character="yellow"]',
        );

      if (yellow) {
        const lookingUp = Math.max(0, -smoothY);

        const x =
          smoothX * 38;

        const y =
          smoothY * 7 -
          lookingUp * 12;

        const rotate =
          smoothX * 13;

        const stretchX =
          1 +
          Math.abs(smoothX) * 0.15;

        const stretchY =
          1 +
          lookingUp * 0.12 -
          Math.abs(smoothX) * 0.04;

        yellow.style.transform = `
          translate3d(${x}px, ${y}px, 0)
          rotate(${rotate}deg)
          skewX(${smoothX * -6}deg)
          scaleX(${stretchX})
          scaleY(${stretchY})
        `;
      }

      animationFrame =
        requestAnimationFrame(animate);
    }

    window.addEventListener(
      "mousemove",
      handleMouseMove,
    );

    animationFrame =
      requestAnimationFrame(animate);

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove,
      );

      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[430px] w-[540px] items-end justify-center"
    >
      {/* LARANJA */}

      <div className="relative z-10 flex h-52 w-52 items-end">
        <div
          data-character="orange"
          className="
            login-character
            relative
            h-52
            w-52
            origin-bottom
            rounded-t-full
            bg-orange-500
          "
        >
          <div className="absolute left-14 top-16 flex gap-7">
            <Eye
              size={30}
              pupilSize={11}
            />

            <Eye
              size={30}
              pupilSize={11}
            />
          </div>
        </div>
      </div>

      {/* ROXO */}

      <div className="relative z-0 -ml-8 flex h-72 w-36 items-end">
        <div
          data-character="purple"
          className="
            login-character
            relative
            h-72
            w-36
            origin-bottom
            rounded-t-full
            bg-violet-600
          "
        >
          <div className="absolute left-9 top-14 flex gap-4">
            <Eye
              size={26}
              pupilSize={9}
            />

            <Eye
              size={26}
              pupilSize={9}
            />
          </div>
        </div>
      </div>

      {/* PRETO */}

      <div className="relative z-20 -ml-6 flex h-64 w-32 items-end">
        <div
          data-character="black"
          className="
            login-character
            relative
            h-64
            w-32
            origin-bottom
            rounded-t-[45%]
            bg-neutral-900
          "
        >
          <div className="absolute left-6 top-10 flex gap-3">
            <Eye
              size={28}
              pupilSize={10}
            />

            <Eye
              size={28}
              pupilSize={10}
            />
          </div>
        </div>
      </div>

      {/* AMARELO */}

      <div className="relative z-30 -ml-8 flex h-56 w-36 items-end">
        <div
          data-character="yellow"
          className="
            login-character
            relative
            h-56
            w-36
            origin-bottom
            rounded-t-full
            bg-yellow-400
          "
        >
          <div className="absolute left-11 top-11">
            <Eye
              size={28}
              pupilSize={10}
            />
          </div>

          <div
            className="
              absolute
              left-12
              top-24
              h-2
              w-10
              rounded-full
              bg-black
            "
          />
        </div>
      </div>

      <style>{`
        .login-character {
          will-change: transform;
          transition: none;
          transform-origin: center bottom;
        }

        .login-pupil {
          will-change: transform;
        }
      `}</style>
    </div>
  );
}