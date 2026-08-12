import { useEffect, useRef } from "react";

import { BlobCharacter } from "@/components/blob-character";
import { useBlobPhysics } from "@/hooks/use-blob-physics";
import { animateBlob } from "@/lib/blob-animation";
import { useBlobState } from "@/hooks/use-blob-state";

type ActiveField =
  | "none"
  | "email"
  | "password";

type LoginCharactersProps = {
  activeField: ActiveField;
};

export function LoginCharacters({
  activeField,
}: LoginCharactersProps) {
  const stageRef =
    useRef<HTMLDivElement>(null);

  const orangeRef =
    useRef<HTMLDivElement>(null);

  const purpleRef =
    useRef<HTMLDivElement>(null);

  const blackRef =
    useRef<HTMLDivElement>(null);

  const yellowRef =
    useRef<HTMLDivElement>(null);

  const physics = useBlobPhysics();
  const blobState = useBlobState(activeField);


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
      index: number,
    ) {
      if (!element) return;

      const state = physics.current;

      const animation = animateBlob({
        personality,
        physics: state,
      });

      let extraX = 0;
      let extraY = 0;
      let extraRotate = 0;
      let extraScaleX = 1;
      let extraScaleY = 1;

      /*
       * E-MAIL
       *
       * Eles ficam atentos ao formulário,
       * mas sem perder completamente
       * o movimento natural.
       */
      if (blobState === "tracking") {
        extraX = 8 + index * 2;
        extraY = -2;

        if (index === 0) {
          extraRotate = 2;
        }

        if (index === 1) {
          extraRotate = 1;
          extraScaleY = 1.03;
        }

        if (index === 2) {
          extraRotate = 3;
        }

        if (index === 3) {
          extraRotate = 4;
          extraScaleX = 1.04;
        }
      }

      /*
       * SENHA
       *
       * Primeiro reação de susto leve,
       * depois eles se afastam do campo.
       */
      if (blobState === "respect") {
        const startle =
          Math.max(
            0.2,
            state.startle,
          );

        if (index === 0) {
          extraX = -12;
          extraY = -5;
          extraRotate = -8;
          extraScaleY =
            1 + startle * 0.06;
        }

        if (index === 1) {
          extraX = -18;
          extraY = -8;
          extraRotate = -11;
          extraScaleY =
            1 + startle * 0.08;
        }

        if (index === 2) {
          extraX = -10;
          extraY = -4;
          extraRotate = -7;
          extraScaleY =
            1 + startle * 0.05;
        }

        /*
         * O amarelo é o curioso.
         *
         * Ele finge que também virou,
         * mas fica menos afastado.
         */
        if (index === 3) {
          extraX = -3;
          extraY = -2;
          extraRotate = -4;
          extraScaleX = 1.03;
          extraScaleY = 1.02;
        }
      }

      element.style.transform = `
        translate3d(
          ${
            animation.translateX +
            extraX
          }px,
          ${
            animation.translateY +
            extraY
          }px,
          0
        )
        rotate(
          ${
            animation.rotation +
            extraRotate
          }deg
        )
        scaleX(
          ${
            animation.stretchX *
            extraScaleX
          }
        )
        scaleY(
          ${
            animation.stretchY *
            extraScaleY
          }
        )
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
          rect.left +
          rect.width / 2;

        const eyeY =
          rect.top +
          rect.height / 2;

        let targetX =
          state.mouseX;

        let targetY =
          state.mouseY;

        /*
         * E-MAIL
         *
         * Todos olham para a região
         * do campo de e-mail.
         */
        if (blobState === "tracking") {
          targetX =
            window.innerWidth *
            0.72;

          targetY =
            window.innerHeight *
            0.43;
        }

        /*
         * SENHA
         */
       if (blobState === "respect") {
          /*
           * Laranja
           *
           * Olha totalmente para longe.
           */
          if (
            index === 0 ||
            index === 1
          ) {
            targetX = -500;

            targetY =
              window.innerHeight *
              0.32;
          }

          /*
           * Roxo
           *
           * Também desvia bastante,
           * mas olhando um pouco para cima.
           */
          else if (
            index === 2 ||
            index === 3
          ) {
            targetX = -400;

            targetY = -120;
          }

          /*
           * Preto
           *
           * Olha para cima e para longe.
           */
          else if (
            index === 4 ||
            index === 5
          ) {
            targetX =
              window.innerWidth *
              0.22;

            targetY = -350;
          }

          /*
           * AMARELO
           *
           * Ele é o fofoqueiro.
           *
           * Em vez de olhar totalmente
           * para longe, tenta espiar
           * discretamente o campo.
           */
          else {
            targetX =
              window.innerWidth *
              0.64;

            targetY =
              window.innerHeight *
              0.56;
          }
        }

        const dx =
          targetX - eyeX;

        const dy =
          targetY - eyeY;

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
          Math.cos(angle) *
          maxMove;

        const y =
          Math.sin(angle) *
          maxMove;

        pupil.style.transform = `
          translate3d(
            ${x}px,
            ${y}px,
            0
          )
        `;

        /*
         * PISCADA NORMAL
         */
        const delay =
          (index % 2) * 0.08;

        const blink = Math.max(
          0,
          state.blinkAmount -
            delay,
        );

        let scaleY = Math.max(
          0.12,
          1 - blink * 0.9,
        );

        /*
         * SENHA
         *
         * Aumentamos um pouco
         * os olhos no susto.
         */
       if (blobState === "respect") {
          /*
           * Personagens que desviam
           * ficam com o olho levemente
           * mais aberto.
           */
          if (index <= 5) {
            scaleY *= 1.06;
          }

          /*
           * O amarelo semi-cerra
           * o olho para parecer
           * que está espiando.
           */
          if (index === 6) {
            scaleY *= 0.62;
          }
        }

        scaleY *=
          1 +
          state.startle *
            0.08;

        eye.style.transform = `
          scaleY(${scaleY})
        `;
      });
    }

    function animate() {
      applyCharacterAnimation(
        orangeRef.current,
        "heavy",
        0,
      );

      applyCharacterAnimation(
        purpleRef.current,
        "elastic",
        1,
      );

      applyCharacterAnimation(
        blackRef.current,
        "nervous",
        2,
      );

      applyCharacterAnimation(
        yellowRef.current,
        "curious",
        3,
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
 }, [physics, blobState]);

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
      {/* ================================
          LARANJA
      ================================= */}

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
          mouth
          mouthId="orange"
         expression={
  blobState === "startled"
    ? "surprised"
    : blobState === "respect"
      ? "neutral"
      : "curious"
}
        />
      </div>

      {/* ================================
          ROXO
      ================================= */}

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
          mouth
          mouthId="purple"
         expression={
  blobState === "startled"
    ? "surprised"
    : blobState === "respect"
      ? "neutral"
      : "curious"
}

        />
      </div>

      {/* ================================
          PRETO
      ================================= */}

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
          mouth
          mouthId="black"
         expression={
  blobState === "startled"
    ? "surprised"
    : blobState === "respect"
      ? "neutral"
      : "curious"
}
        />
      </div>

      {/* ================================
          AMARELO
      ================================= */}

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
          expression={
  blobState === "peek"
    ? "peek"
    : blobState === "startled"
      ? "surprised"
      : "curious"
}
        />
      </div>
    </div>
  );
}