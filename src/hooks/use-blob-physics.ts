import { useEffect, useRef } from "react";

export type BlobPhysicsState = {
  mouseX: number;
  mouseY: number;
  smoothX: number;
  smoothY: number;
  velocityX: number;
  velocityY: number;
  startle: number;
  idleBlend: number;
  blinkAmount: number;
};

type UseBlobPhysicsOptions = {
  disabled?: boolean;
};

export function useBlobPhysics({
  disabled = false,
}: UseBlobPhysicsOptions = {}) {
  const stateRef = useRef<BlobPhysicsState>({
    mouseX: window.innerWidth / 2,
    mouseY: window.innerHeight / 2,
    smoothX: 0,
    smoothY: 0,
    velocityX: 0,
    velocityY: 0,
    startle: 0,
    idleBlend: 0,
    blinkAmount: 0,
  });

  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (disabled) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) return;

    let lastMouseX = window.innerWidth / 2;
    let lastMouseY = window.innerHeight / 2;

    let lastMoveAt = performance.now();

    let nextBlinkAt =
      performance.now() + 1800 + Math.random() * 2600;

    let blinkEndAt = 0;

    function handleMouseMove(event: MouseEvent) {
      const state = stateRef.current;

      const velocityX = event.clientX - lastMouseX;
      const velocityY = event.clientY - lastMouseY;

      const speed = Math.hypot(
        velocityX,
        velocityY,
      );

      state.velocityX = velocityX;
      state.velocityY = velocityY;

      state.mouseX = event.clientX;
      state.mouseY = event.clientY;

      if (speed > 80) {
        state.startle = Math.min(
          1,
          state.startle + speed / 350,
        );
      }

      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      lastMoveAt = performance.now();
    }

    function handleMouseEnter() {
      stateRef.current.startle = Math.max(
        stateRef.current.startle,
        0.3,
      );
    }

    function animate(now: number) {
      const state = stateRef.current;

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const idleFor = now - lastMoveAt;

      const idleBlend = Math.min(
        1,
        Math.max(
          0,
          (idleFor - 1200) / 1800,
        ),
      );

      state.idleBlend = idleBlend;

      const idleX =
        Math.sin(now * 0.00055) *
        0.22 *
        idleBlend;

      const idleY =
        Math.sin(now * 0.00041 + 1.8) *
        0.12 *
        idleBlend;

      const targetX = Math.max(
        -1,
        Math.min(
          1,
          (state.mouseX - centerX) / centerX +
            idleX,
        ),
      );

      const targetY = Math.max(
        -1,
        Math.min(
          1,
          (state.mouseY - centerY) / centerY +
            idleY,
        ),
      );

      /*
       * SPRING-LIKE SMOOTHING
       *
       * Ainda não é uma simulação física completa,
       * mas já cria uma resposta mais elástica e natural.
       */
      state.smoothX +=
        (targetX - state.smoothX) * 0.05;

      state.smoothY +=
        (targetY - state.smoothY) * 0.05;

      state.velocityX *= 0.84;
      state.velocityY *= 0.84;

      state.startle *= 0.91;

      /*
       * PISCADAS
       */
      if (
        now >= nextBlinkAt &&
        now >= blinkEndAt
      ) {
        blinkEndAt = now + 145;

        nextBlinkAt =
          now +
          2200 +
          Math.random() * 4200;
      }

      if (now < blinkEndAt) {
        const progress =
          1 -
          (blinkEndAt - now) / 145;

        state.blinkAmount =
          Math.sin(progress * Math.PI);
      } else {
        state.blinkAmount *= 0.7;
      }

      frameRef.current =
        requestAnimationFrame(animate);
    }

    window.addEventListener(
      "mousemove",
      handleMouseMove,
    );

    window.addEventListener(
      "mouseenter",
      handleMouseEnter,
    );

    frameRef.current =
      requestAnimationFrame(animate);

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove,
      );

      window.removeEventListener(
        "mouseenter",
        handleMouseEnter,
      );

      if (frameRef.current !== null) {
        cancelAnimationFrame(
          frameRef.current,
        );
      }
    };
  }, [disabled]);

  return stateRef;
}
