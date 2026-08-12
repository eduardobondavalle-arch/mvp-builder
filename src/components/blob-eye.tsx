type BlobEyeProps = {
  size?: number;
  pupilSize?: number;
  className?: string;
};

export function BlobEye({
  size = 28,
  pupilSize = 10,
  className = "",
}: BlobEyeProps) {
  return (
    <div
      className={`blob-eye relative flex items-center justify-center rounded-full bg-white ${className}`}
      style={{
        width: size,
        height: size,
        transformOrigin: "center",
        willChange: "transform",
      }}
    >
      <div
        className="blob-pupil absolute rounded-full bg-black"
        style={{
          width: pupilSize,
          height: pupilSize,
          willChange: "transform",
        }}
      />
    </div>
  );
}
