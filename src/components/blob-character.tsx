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
}: BlobCharacterProps) {
  const centerX = width / 2;
  const bodyTop = Math.max(16, height * 0.08);
  const shoulderY = height * 0.42;
  const sideInset = Math.max(14, width * 0.14);

  const eyeGap = eyeCount === 2 ? 12 : 0;
  const eyesWidth =
    eyeCount === 2
      ? eyeSize * 2 + eyeGap
      : eyeSize;

  const faceX = centerX - eyesWidth / 2;
  const faceY = Math.max(32, height * 0.17);

  return (
    <div
      className={`relative flex items-end ${className}`}
      style={{
        width,
        height,
      }}
      data-personality={personality}
    >
      <svg
        className="h-full w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        <path
          data-body={bodyId}
          data-personality={personality}
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

        <foreignObject
          data-face={faceId}
          x={faceX}
          y={faceY}
          width={eyesWidth + 10}
          height={eyeSize + 12}
          className="pointer-events-none overflow-visible"
        >
          <div
            className="flex items-center"
            style={{
              gap: eyeCount === 2 ? eyeGap : 0,
            }}
          >
            <BlobEye
              size={eyeSize}
              pupilSize={pupilSize}
            />

            {eyeCount === 2 && (
              <BlobEye
                size={eyeSize}
                pupilSize={pupilSize}
              />
            )}
          </div>
        </foreignObject>

        {mouth && (
          <rect
            data-mouth={mouthId}
            x={centerX - 20}
            y={faceY + eyeSize + 30}
            width="40"
            height="8"
            rx="4"
            fill="black"
          />
        )}
      </svg>
    </div>
  );
}
