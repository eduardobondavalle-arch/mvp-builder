import { BlobEye } from "@/components/blob-eye";

export type BlobPersonality =
  | "heavy"
  | "elastic"
  | "nervous"
  | "curious";

type BlobCharacterProps = {
  color: string;
  width: number;
  height: number;
  personality: BlobPersonality;

  eyeCount?: 1 | 2;
  eyeSize?: number;
  pupilSize?: number;

  mouth?: boolean;

  className?: string;

  bodyId: string;
  faceId: string;
  mouthId?: string;

  expression?: "neutral" | "curious" | "surprised" | "peek";
};

export function BlobCharacter({
  color,
  width,
  height,
  personality,

  eyeCount = 2,
  eyeSize = 28,
  pupilSize = 10,

  mouth = false,

  className = "",

  bodyId,
  faceId,
  mouthId,

  expression = "neutral",
}: BlobCharacterProps) {
  const centerX = width / 2;

  const bodyTop = Math.max(
    16,
    height * 0.08,
  );

  const shoulderY =
    height * 0.42;

  const sideInset = Math.max(
    14,
    width * 0.14,
  );

  const eyeGap =
    eyeCount === 2
      ? 12
      : 0;

  const eyesWidth =
    eyeCount === 2
      ? eyeSize * 2 +
        eyeGap
      : eyeSize;

  const faceX =
    centerX -
    eyesWidth / 2;

  const faceY =
    Math.max(
      32,
      height * 0.17,
    );

  /*
   * EXPRESSÕES
   */
  const surprised =
    expression ===
    "surprised";

  const curious =
    expression ===
      "curious" ||
    expression ===
      "peek";

  const peeking =
    expression ===
    "peek";

  const eyebrowY =
    faceY - 12;

  return (
    <div
      className={`relative flex items-end ${className}`}
      style={{
        width,
        height,
      }}
      data-personality={
        personality
      }
    >
      <svg
        className="h-full w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* CORPO */}

        <path
          data-body={bodyId}
          data-personality={
            personality
          }
          d={`
            M ${sideInset} ${height}

            L ${sideInset} ${shoulderY}

            C
              ${sideInset} ${height * 0.22},
              ${centerX - width * 0.18} ${bodyTop},
              ${centerX} ${bodyTop}

            C
              ${centerX + width * 0.18} ${bodyTop},
              ${width - sideInset} ${height * 0.22},
              ${width - sideInset} ${shoulderY}

            L ${width - sideInset} ${height}

            Z
          `}
          fill={color}
        />

        {/* SOBRANCELHAS */}

        {eyeCount === 2 && (
          <>
            <path
              d={`
                M ${
                  faceX +
                  2
                } ${
                  eyebrowY +
                  (surprised
                    ? -4
                    : 0)
                }

                Q ${
                  faceX +
                  eyeSize /
                    2
                } ${
                  eyebrowY -
                  (curious
                    ? 5
                    : 2)
                }

                ${
                  faceX +
                  eyeSize -
                  2
                } ${
                  eyebrowY +
                  (curious
                    ? 2
                    : 0)
                }
              `}
              fill="none"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            <path
              d={`
                M ${
                  faceX +
                  eyeSize +
                  eyeGap +
                  2
                } ${
                  eyebrowY +
                  (surprised
                    ? -4
                    : 0)
                }

                Q ${
                  faceX +
                  eyeSize +
                  eyeGap +
                  eyeSize /
                    2
                } ${
                  eyebrowY -
                  (curious
                    ? 2
                    : 2)
                }

                ${
                  faceX +
                  eyeSize *
                    2 +
                  eyeGap -
                  2
                } ${
                  eyebrowY +
                  (curious
                    ? -3
                    : 0)
                }
              `}
              fill="none"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        )}

        {eyeCount === 1 && (
          <path
            d={`
              M ${
                faceX - 3
              } ${
                eyebrowY +
                (surprised
                  ? -4
                  : 0)
              }

              Q ${
                faceX +
                eyeSize /
                  2
              } ${
                eyebrowY -
                (curious
                  ? 7
                  : 2)
              }

              ${
                faceX +
                eyeSize +
                3
              } ${
                eyebrowY +
                (peeking
                  ? -2
                  : 0)
              }
            `}
            fill="none"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}

        {/* OLHOS */}

        <foreignObject
          data-face={faceId}
          x={faceX}
          y={faceY}
          width={
            eyesWidth + 10
          }
          height={
            eyeSize + 12
          }
          className="pointer-events-none overflow-visible"
        >
          <div
            className="flex items-center"
            style={{
              gap:
                eyeCount === 2
                  ? eyeGap
                  : 0,
            }}
          >
            <BlobEye
              size={eyeSize}
              pupilSize={
                surprised
                  ? pupilSize -
                    1
                  : pupilSize
              }
            />

            {eyeCount ===
              2 && (
              <BlobEye
                size={
                  peeking
                    ? eyeSize *
                      0.9
                    : eyeSize
                }
                pupilSize={
                  surprised
                    ? pupilSize -
                      1
                    : pupilSize
                }
              />
            )}
          </div>
        </foreignObject>

        {/* BOCA */}

        {mouth && (
          <>
            {surprised ? (
              <ellipse
                data-mouth={
                  mouthId
                }
                cx={centerX}
                cy={
                  faceY +
                  eyeSize +
                  36
                }
                rx="8"
                ry="11"
                fill="black"
              />
            ) : peeking ? (
              <path
                data-mouth={
                  mouthId
                }
                d={`
                  M ${
                    centerX -
                    14
                  } ${
                    faceY +
                    eyeSize +
                    35
                  }

                  Q ${
                    centerX
                  } ${
                    faceY +
                    eyeSize +
                    29
                  }

                  ${
                    centerX +
                    16
                  } ${
                    faceY +
                    eyeSize +
                    35
                  }
                `}
                fill="none"
                stroke="black"
                strokeWidth="6"
                strokeLinecap="round"
              />
            ) : curious ? (
              <path
                data-mouth={
                  mouthId
                }
                d={`
                  M ${
                    centerX -
                    15
                  } ${
                    faceY +
                    eyeSize +
                    34
                  }

                  Q ${
                    centerX
                  } ${
                    faceY +
                    eyeSize +
                    43
                  }

                  ${
                    centerX +
                    15
                  } ${
                    faceY +
                    eyeSize +
                    34
                  }
                `}
                fill="none"
                stroke="black"
                strokeWidth="6"
                strokeLinecap="round"
              />
            ) : (
              <rect
                data-mouth={
                  mouthId
                }
                x={
                  centerX -
                  20
                }
                y={
                  faceY +
                  eyeSize +
                  30
                }
                width="40"
                height="8"
                rx="4"
                fill="black"
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
}