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

    let targetX = 0;
    let targetY = 0;

    let velocityX = 0;
    let velocityY = 0;

    let lastMouseX = mouseX;
    let lastMouseY = mouseY;

    let animationFrame = 0;

    function handleMouseMove(event: MouseEvent) {
      velocityX = event.clientX - lastMouseX;
      velocityY = event.clientY - lastMouseY;

      lastMouseX = event.clientX;
      lastMouseY = event.clientY;

      mouseX = event.clientX;
      mouseY = event.clientY;
    }

    function animate() {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      targetX = Math.max(
        -1,
        Math.min(1, (mouseX - centerX) / centerX),
      );

      targetY = Math.max(
        -1,
        Math.min(1, (mouseY - centerY) / centerY),
      );

      /*
       * Inércia.
       *
       * Valores menores deixam o movimento mais "mole".
       */
      smoothX += (targetX - smoothX) * 0.045;
      smoothY += (targetY - smoothY) * 0.045;

      velocityX *= 0.86;
      velocityY *= 0.86;

      /*
       * ==================================================
       * OLHOS
       * ==================================================
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
          Math.sqrt(dx * dx + dy * dy) / 260,
          1,
        );

        const maxMove =
          Math.min(rect.width, rect.height) *
          0.21 *
          distance;

        const pupilX = Math.cos(angle) * maxMove;
        const pupilY = Math.sin(angle) * maxMove;

        pupil.style.transform = `
          translate3d(
            ${pupilX}px,
            ${pupilY}px,
            0
          )
        `;
      });

      /*
       * Valores auxiliares.
       */

      const lookingUp = Math.max(0, -smoothY);
      const lookingDown = Math.max(0, smoothY);

      /*
       * ==================================================
       * LARANJA
       * ==================================================
       *
       * Largo, pesado e mais lento.
       */

      const orangePath =
        container.querySelector<SVGPathElement>(
          '[data-body="orange"]',
        );

      const orangeFace =
        container.querySelector<SVGForeignObjectElement>(
          '[data-face="orange"]',
        );

      if (orangePath) {
        const headX = smoothX * 22;

        const topY =
          30 -
          lookingUp * 28 +
          lookingDown * 12;

        const leftShoulderX =
          18 + smoothX * 7;

        const rightShoulderX =
          190 + smoothX * 7;

        orangePath.setAttribute(
          "d",
          `
            M 15 208

            L ${leftShoulderX} 112

            C
              ${leftShoulderX} ${70 - lookingUp * 8},
              ${55 + headX} ${topY},
              ${104 + headX} ${topY}

            C
              ${155 + headX} ${topY},
              ${rightShoulderX} ${70 - lookingUp * 8},
              ${rightShoulderX} 112

            L 193 208

            Z
          `,
        );
      }

      if (orangeFace) {
        orangeFace.setAttribute(
          "x",
          String(58 + smoothX * 20),
        );

        orangeFace.setAttribute(
          "y",
          String(
            62 -
              lookingUp * 20 +
              lookingDown * 8,
          ),
        );
      }

      /*
       * ==================================================
       * ROXO
       * ==================================================
       *
       * O personagem mais elástico.
       */

      const purplePath =
        container.querySelector<SVGPathElement>(
          '[data-body="purple"]',
        );

      const purpleFace =
        container.querySelector<SVGForeignObjectElement>(
          '[data-face="purple"]',
        );

      if (purplePath) {
        const headX = smoothX * 30;

        const top =
          20 -
          lookingUp * 52 +
          lookingDown * 14;

        const leftNeck =
          29 + smoothX * 5;

        const rightNeck =
          131 + smoothX * 5;

        purplePath.setAttribute(
          "d",
          `
            M 28 288

            L ${leftNeck} 116

            C
              ${leftNeck} ${62 - lookingUp * 14},
              ${48 + headX} ${top},
              ${80 + headX} ${top}

            C
              ${112 + headX} ${top},
              ${rightNeck} ${62 - lookingUp * 14},
              ${rightNeck} 116

            L 132 288

            Z
          `,
        );
      }

      if (purpleFace) {
        purpleFace.setAttribute(
          "x",
          String(46 + smoothX * 28),
        );

        purpleFace.setAttribute(
          "y",
          String(
            48 -
              lookingUp * 44 +
              lookingDown * 10,
          ),
        );
      }

      /*
       * ==================================================
       * PRETO
       * ==================================================
       *
       * Mais agitado. Reage à velocidade do mouse.
       */

      const blackPath =
        container.querySelector<SVGPathElement>(
          '[data-body="black"]',
        );

      const blackFace =
        container.querySelector<SVGForeignObjectElement>(
          '[data-face="black"]',
        );

      if (blackPath) {
        const speedX = Math.max(
          -10,
          Math.min(10, velocityX * 0.14),
        );

        const headX =
          smoothX * 34 + speedX;

        const top =
          16 -
          lookingUp * 34 +
          lookingDown * 9;

        blackPath.setAttribute(
          "d",
          `
            M 20 256

            L ${22 + smoothX * 5} 92

            C
              ${23 + smoothX * 5} 48,
              ${39 + headX} ${top},
              ${64 + headX} ${top}

            C
              ${91 + headX} ${top},
              ${107 + smoothX * 5} 48,
              ${108 + smoothX * 5} 92

            L 108 256

            Z
          `,
        );
      }

      if (blackFace) {
        const speedFace = Math.max(
          -8,
          Math.min(8, velocityX * 0.1),
        );

        blackFace.setAttribute(
          "x",
          String(
            28 +
              smoothX * 31 +
              speedFace,
          ),
        );

        blackFace.setAttribute(
          "y",
          String(
            39 -
              lookingUp * 27 +
              lookingDown * 7,
          ),
        );
      }

      /*
       * ==================================================
       * AMARELO
       * ==================================================
       *
       * Curioso, puxa o rosto bastante para o cursor.
       */

      const yellowPath =
        container.querySelector<SVGPathElement>(
          '[data-body="yellow"]',
        );

      const yellowFace =
        container.querySelector<SVGForeignObjectElement>(
          '[data-face="yellow"]',
        );

      const yellowMouth =
        container.querySelector<SVGRectElement>(
          '[data-mouth="yellow"]',
        );

      if (yellowPath) {
        const headX = smoothX * 38;

        const top =
          24 -
          lookingUp * 31 +
          lookingDown * 11;

        yellowPath.setAttribute(
          "d",
          `
            M 18 224

            L ${20 + smoothX * 5} 92

            C
              ${22 + smoothX * 5} 49,
              ${44 + headX} ${top},
              ${72 + headX} ${top}

            C
              ${104 + headX} ${top},
              ${123 + smoothX * 5} 49,
              ${124 + smoothX * 5} 92

            L 126 224

            Z
          `,
        );
      }

      if (yellowFace) {
        yellowFace.setAttribute(
          "x",
          String(46 + smoothX * 35),
        );

        yellowFace.setAttribute(
          "y",
          String(
            45 -
              lookingUp * 26 +
              lookingDown * 8,
          ),
        );
      }

      if (yellowMouth) {
        yellowMouth.setAttribute(
          "x",
          String(49 + smoothX * 29),
        );

        yellowMouth.setAttribute(
          "y",
          String(
            101 -
              lookingUp * 20 +
              lookingDown * 5,
          ),
        );
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
      className="relative flex h-[450px] w-[580px] items-end justify-center"
    >
      {/* ============================================
          LARANJA
      ============================================ */}

      <div className="relative z-10 flex h-[208px] w-[208px] items-end">
        <svg
          className="h-[208px] w-[208px] overflow-visible"
          viewBox="0 0 208 208"
        >
          <path
            data-body="orange"
            d="
              M 15 208
              L 18 112
              C 18 70, 55 30, 104 30
              C 155 30, 190 70, 190 112
              L 193 208
              Z
            "
            fill="#f97316"
          />

          <foreignObject
            data-face="orange"
            x="58"
            y="62"
            width="100"
            height="50"
            className="pointer-events-none overflow-visible"
          >
            <div className="flex gap-7">
              <Eye size={30} pupilSize={11} />
              <Eye size={30} pupilSize={11} />
            </div>
          </foreignObject>
        </svg>
      </div>

      {/* ============================================
          ROXO
      ============================================ */}

      <div className="relative z-0 -ml-8 flex h-72 w-40 items-end">
        <svg
          className="h-72 w-40 overflow-visible"
          viewBox="0 0 160 288"
        >
          <path
            data-body="purple"
            d="
              M 28 288
              L 29 116
              C 29 62, 48 20, 80 20
              C 112 20, 131 62, 131 116
              L 132 288
              Z
            "
            fill="#7c3aed"
          />

          <foreignObject
            data-face="purple"
            x="46"
            y="48"
            width="82"
            height="48"
            className="pointer-events-none overflow-visible"
          >
            <div className="flex gap-4">
              <Eye size={26} pupilSize={9} />
              <Eye size={26} pupilSize={9} />
            </div>
          </foreignObject>
        </svg>
      </div>

      {/* ============================================
          PRETO
      ============================================ */}

      <div className="relative z-20 -ml-6 flex h-64 w-32 items-end">
        <svg
          className="h-64 w-32 overflow-visible"
          viewBox="0 0 128 256"
        >
          <path
            data-body="black"
            d="
              M 20 256
              L 22 92
              C 23 48, 39 16, 64 16
              C 91 16, 107 48, 108 92
              L 108 256
              Z
            "
            className="fill-neutral-900 dark:fill-neutral-950"
          />

          <foreignObject
            data-face="black"
            x="28"
            y="39"
            width="82"
            height="50"
            className="pointer-events-none overflow-visible"
          >
            <div className="flex gap-3">
              <Eye size={28} pupilSize={10} />
              <Eye size={28} pupilSize={10} />
            </div>
          </foreignObject>
        </svg>
      </div>

      {/* ============================================
          AMARELO
      ============================================ */}

      <div className="relative z-30 -ml-8 flex h-56 w-36 items-end">
        <svg
          className="h-56 w-36 overflow-visible"
          viewBox="0 0 144 224"
        >
          <path
            data-body="yellow"
            d="
              M 18 224
              L 20 92
              C 22 49, 44 24, 72 24
              C 104 24, 123 49, 124 92
              L 126 224
              Z
            "
            fill="#facc15"
          />

          <foreignObject
            data-face="yellow"
            x="46"
            y="45"
            width="55"
            height="45"
            className="pointer-events-none overflow-visible"
          >
            <div>
              <Eye size={28} pupilSize={10} />
            </div>
          </foreignObject>

          <rect
            data-mouth="yellow"
            x="49"
            y="101"
            width="40"
            height="8"
            rx="4"
            fill="black"
          />
        </svg>
      </div>

      <style>{`
        .login-pupil {
          will-change: transform;
        }

        [data-body] {
          will-change: d;
        }
      `}</style>
    </div>
  );
}