import { useEffect, useRef } from "react";

import { BlobCharacter } from "@/components/blob-character";
import { useBlobPhysics } from "@/hooks/use-blob-physics";
import { animateBlob } from "@/lib/blob-animation";

export function LoginCharacters() {
  const stageRef = useRef<HTMLDivElement>(null);

  const orangeRef = useRef<HTMLDivElement>(null);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);

  const physics = useBlobPhysics();

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    let frame = 0;

    function applyCharacterAnimation(
      element: HTMLDivElement | null,
      personality:
        | "heavy"
        | "elastic"
        | "nervous"
        | "curious",
    ) {
      if (!element) return;

      const animation = animateBlob({
        personality,
        physics: physics.current,
      });

      element.style.transform = `
        translate3d(
          ${animation.translateX}px,
          ${animation.translateY}px,
          0
        )
        rotate(${animation.rotation}deg)
        scaleX(${animation.stretchX})
        scaleY(${animation.stretchY})
      `;
    }

    function animateEyes() {
      const state = physics.current;

      const eyes =
        stage.querySelectorAll<HTMLElement>(
          ".blob-eye",
        );

      eyes.forEach((eye, index) => {
        const pupil =
          eye.querySelector<HTMLElement>(
            ".blob-pupil",
          );

        if (!pupil) return;

        const rect =
          eye.getBoundingClientRect();

        const eyeX =
          rect.left + rect.width / 2;

        const eyeY =
          rect.top + rect.height / 2;

        const dx =
          state.mouseX - eyeX;

        const dy =
          state.mouseY - eyeY;

        const angle =
          Math.atan2(dy, dx);

        const distance = Math.min(
          Math.hypot(dx, dy) / 260,
          1,
        );

        const maxMove =
          Math.min(
            rect.width,
            rect.height,
          ) *
          0.21 *
          distance;

        const x =
          Math.cos(angle) * maxMove;

        const y =
          Math.sin(angle) * maxMove;

        pupil.style.transform = `
          translate3d(
            ${x}px,
            ${y}px,
            0
          )
        `;

        /*
         * Pequena diferença entre os olhos
         * para a piscada não parecer
         * perfeitamente robótica.
         */
        const delay =
          (index % 2) * 0.08;

        const blink = Math.max(
          0,
          state.blinkAmount - delay,
        );

        /*
         * Quando toma susto,
         * os olhos abrem um pouco mais.
         */
        const startledOpen =
          1 + state.startle * 0.16;

        const scaleY = Math.max(
          0.12,
          (1 - blink * 0.9) *
            startledOpen,
        );

        eye.style.transform = `
          scaleY(${scaleY})
        `;
      });
    }

    function animate() {
      applyCharacterAnimation(
        orangeRef.current,
        "heavy",
      );

      applyCharacterAnimation(
        purpleRef.current,
        "elastic",
      );

      applyCharacterAnimation(
        blackRef.current,
        "nervous",
      );

      applyCharacterAnimation(
        yellowRef.current,
        "curious",
      );

      animateEyes();

      frame =
        requestAnimationFrame(
          animate,
        );
    }

    frame =
      requestAnimationFrame(
        animate,
      );

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [physics]);

  return (
    <div
      ref={stageRef}
      className="
        relative
        flex
        h-[450px]
        w-[580px]
        items-end
        justify-center
      "
    >
      {/* LARANJA */}
      <div
        ref={orangeRef}
        className="
          relative
          z-10
          flex
          origin-bottom
          items-end
          will-change-transform
        "
      >
        <BlobCharacter
          bodyId="orange"
          faceId="orange"
          personality="heavy"
          color="#f97316"
          width={208}
          height={208}
          eyeCount={2}
          eyeSize={30}
          pupilSize={11}
        />
      </div>

      {/* ROXO */}
      <div
        ref={purpleRef}
        className="
          relative
          z-0
          -ml-8
          flex
          origin-bottom
          items-end
          will-change-transform
        "
      >
        <BlobCharacter
          bodyId="purple"
          faceId="purple"
          personality="elastic"
          color="#7c3aed"
          width={160}
          height={288}
          eyeCount={2}
          eyeSize={26}
          pupilSize={9}
        />
      </div>

      {/* PRETO */}
      <div
        ref={blackRef}
        className="
          relative
          z-20
          -ml-6
          flex
          origin-bottom
          items-end
          will-change-transform
        "
      >
        <BlobCharacter
          bodyId="black"
          faceId="black"
          personality="nervous"
          color="#171717"
          width={128}
          height={256}
          eyeCount={2}
          eyeSize={28}
          pupilSize={10}
        />
      </div>

      {/* AMARELO */}
      <div
        ref={yellowRef}
        className="
          relative
          z-30
          -ml-8
          flex
          origin-bottom
          items-end
          will-change-transform
        "
      >
        <BlobCharacter
          bodyId="yellow"
          faceId="yellow"
          mouthId="yellow"
          personality="curious"
          color="#facc15"
          width={144}
          height={224}
          eyeCount={1}
          eyeSize={28}
          pupilSize={10}
          mouth
        />
      </div>
    </div>
  );
}