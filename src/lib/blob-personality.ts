export type BlobPersonality =
  | "heavy"
  | "elastic"
  | "nervous"
  | "curious";

export type PersonalityValues = {
  moveX: number;
  moveY: number;
  stretch: number;
  rotate: number;
  reaction: number;
};

const PERSONALITIES: Record<
  BlobPersonality,
  PersonalityValues
> = {
  heavy: {
    moveX: 20,
    moveY: 6,
    stretch: 0.08,
    rotate: 5,
    reaction: 0.4,
  },

  elastic: {
    moveX: 30,
    moveY: 12,
    stretch: 0.22,
    rotate: 8,
    reaction: 0.8,
  },

  nervous: {
    moveX: 36,
    moveY: 8,
    stretch: 0.12,
    rotate: 12,
    reaction: 1.25,
  },

  curious: {
    moveX: 34,
    moveY: 9,
    stretch: 0.16,
    rotate: 9,
    reaction: 0.7,
  },
};

export function getBlobPersonality(
  personality: BlobPersonality,
) {
  return PERSONALITIES[personality];
}
