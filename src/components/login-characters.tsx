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

    let currentX = 0;
    let currentY = 0;

    let animationFrame = 0;

    function handleMouseMove(event: MouseEvent) {
      mouseX = event.clientX;
      mouseY = event.clientY;
    }

    function animate() {
      const windowCenterX = window.innerWidth / 2;
      const windowCenterY = window.innerHeight / 2;

      const normalizedX = Math.max(
        -1,
        Math.min(1, (mouseX - windowCenterX) / windowCenterX),
      );

      const normalizedY = Math.max(
        -1,
        Math.min(1, (mouseY - windowCenterY) / windowCenterY),
      );

      currentX += (normalizedX - currentX) * 0.06;
      currentY += (normalizedY - currentY) * 0.06;

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

      const characters =
        container.querySelectorAll<HTMLElement>(".login-character");

      characters.forEach((character, index) => {
        const strength = 1 + index * 0.08;

        const moveX = currentX * 18 * strength;
        const moveY = currentY * 5;

        const stretchX = 1 + Math.abs(currentX) * 0.08 * strength;
        const stretchY = 1 - Math.abs(currentX) * 0.025;

        const rotation = currentX * 3.5 * strength;

        character.style.transform = `
          translate3d(${moveX}px, ${moveY}px, 0)
          rotate(${rotation}deg)
          scaleX(${stretchX})
          scaleY(${stretchY})
        `;
      });

      animationFrame = requestAnimationFrame(animate);
    }

    window.addEventListener("mousemove", handleMouseMove);

    animationFrame = requestAnimationFrame(animate);

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
      <div className="login-character relative z-10 h-52 w-52 origin-bottom rounded-t-full bg-orange-500">
        <div className="absolute left-14 top-16 flex gap-7">
          <Eye size={30} pupilSize={11} />
          <Eye size={30} pupilSize={11} />
        </div>
      </div>

      {/* PERSONAGEM ROXO */}
      <div className="login-character relative z-0 -ml-8 h-72 w-36 origin-bottom rounded-t-full bg-violet-600">
        <div className="absolute left-9 top-14 flex gap-4">
          <Eye size={26} pupilSize={9} />
          <Eye size={26} pupilSize={9} />
        </div>
      </div>

      {/* PERSONAGEM PRETO */}
      <div className="login-character relative z-20 -ml-6 h-64 w-32 origin-bottom rounded-t-[45%] bg-neutral-900">
        <div className="absolute left-6 top-10 flex gap-3">
          <Eye size={28} pupilSize={10} />
          <Eye size={28} pupilSize={10} />
        </div>
      </div>

      {/* PERSONAGEM AMARELO */}
      <div className="login-character relative z-30 -ml-8 h-56 w-36 origin-bottom rounded-t-full bg-yellow-400">
        <div className="absolute left-11 top-11">
          <Eye size={28} pupilSize={10} />
        </div>

        <div className="absolute left-12 top-24 h-2 w-10 rounded-full bg-black" />
      </div>

      <style>{`
        .login-character {
          transition: transform 80ms linear;
          will-change: transform;
        }

        .login-pupil {
          transition: transform 80ms linear;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
