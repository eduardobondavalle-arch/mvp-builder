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

    let animationFrame = 0;

    function atualizarOlhos() {
      const eyes = container.querySelectorAll<HTMLElement>(".login-eye");

      eyes.forEach((eye) => {
        const pupil = eye.querySelector<HTMLElement>(".login-pupil");

        if (!pupil) return;

        const rect = eye.getBoundingClientRect();

        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;

        const deltaX = mouseX - eyeCenterX;
        const deltaY = mouseY - eyeCenterY;

        const angle = Math.atan2(deltaY, deltaX);

        const maxDistance = Math.min(rect.width, rect.height) * 0.18;

        const x = Math.cos(angle) * maxDistance;
        const y = Math.sin(angle) * maxDistance;

        pupil.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });

      animationFrame = requestAnimationFrame(atualizarOlhos);
    }

    function handleMouseMove(event: MouseEvent) {
      mouseX = event.clientX;
      mouseY = event.clientY;
    }

    window.addEventListener("mousemove", handleMouseMove);

    animationFrame = requestAnimationFrame(atualizarOlhos);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[420px] w-[520px] items-end justify-center"
    >
      {/* PERSONAGEM LARANJA */}
      <div className="relative z-10 h-52 w-52 rounded-t-full bg-orange-500 animate-[loginFloat_5s_ease-in-out_infinite]">
        <div className="absolute left-14 top-16 flex gap-7">
          <Eye size={30} pupilSize={11} />
          <Eye size={30} pupilSize={11} />
        </div>
      </div>

      {/* PERSONAGEM ROXO */}
      <div className="relative z-0 -ml-8 h-72 w-36 rounded-t-full bg-violet-600 animate-[loginFloat_4.4s_ease-in-out_infinite]">
        <div className="absolute left-9 top-14 flex gap-4">
          <Eye size={26} pupilSize={9} />
          <Eye size={26} pupilSize={9} />
        </div>
      </div>

      {/* PERSONAGEM PRETO */}
      <div className="relative z-20 -ml-6 h-64 w-32 rounded-t-[45%] bg-neutral-900 animate-[loginFloat_4.8s_ease-in-out_infinite]">
        <div className="absolute left-6 top-10 flex gap-3">
          <Eye size={28} pupilSize={10} />
          <Eye size={28} pupilSize={10} />
        </div>
      </div>

      {/* PERSONAGEM AMARELO */}
      <div className="relative z-30 -ml-8 h-56 w-36 rounded-t-full bg-yellow-400 animate-[loginFloat_5.4s_ease-in-out_infinite]">
        <div className="absolute left-11 top-11">
          <Eye size={28} pupilSize={10} />
        </div>

        <div className="absolute left-12 top-24 h-2 w-10 rounded-full bg-black" />
      </div>

      <style>{`
        @keyframes loginFloat {
          0%,
          100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-7px);
          }
        }

        .login-pupil {
          transition: transform 80ms linear;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[loginFloat"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
