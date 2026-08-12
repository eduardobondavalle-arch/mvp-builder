import { BlobPhysicsState } from "@/hooks/use-blob-physics";
import { getBlobPersonality } from "./blob-personality";

type AnimateBlobOptions = {
  personality: "heavy" | "elastic" | "nervous" | "curious";
  physics: BlobPhysicsState;
};

export function animateBlob({
  personality,
  physics,
}: AnimateBlobOptions) {
  const config = getBlobPersonality(personality);

  const lookingUp = Math.max(0, -physics.smoothY);
  const lookingDown = Math.max(0, physics.smoothY);

  return {
    translateX:
      physics.smoothX * config.moveX +
      physics.velocityX * 0.04 * config.reaction,

    translateY:
      physics.smoothY * config.moveY -
      lookingUp * config.reaction * 8,

    rotation:
      physics.smoothX * config.rotate,

    stretchX:
      1 +
      Math.abs(physics.smoothX) *
        config.stretch,

    stretchY:
      1 +
      lookingUp *
        config.stretch *
        1.4 -
      lookingDown *
        config.stretch *
        0.35,

    startled:
      physics.startle,

    blink:
      physics.blinkAmount,
  };
}
