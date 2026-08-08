import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface NavScrollProps {
  children: React.ReactNode;
}

export function NavScroll({ children }: NavScrollProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateBounds() {
    const el = trackRef.current;
    if (!el) return;
    const left = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 1);
    setCanScrollRight(left < max - 1);
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    updateBounds();
    el.addEventListener("scroll", updateBounds, { passive: true });
    window.addEventListener("resize", updateBounds);
    return () => {
      el.removeEventListener("scroll", updateBounds);
      window.removeEventListener("resize", updateBounds);
    };
  }, []);

  useEffect(() => {
    if (!dir) {
      velocityRef.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const el = trackRef.current;
    if (!el) return;

    const targetSpeed = dir === "left" ? -420 : 420; // px/s
    let last = performance.now();

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Smooth velocity ramp-up/down
      velocityRef.current += (targetSpeed - velocityRef.current) * 0.18;

      el.scrollLeft += velocityRef.current * dt;
      updateBounds();

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dir]);

  const motionClass =
    dir === "left"
      ? "nav-motion-left"
      : dir === "right"
        ? "nav-motion-right"
        : "";

  return (
    <div className="group/nav relative flex min-w-0 flex-1">
      {/* Left hover zone */}
      <div
        className="pointer-events-auto absolute inset-y-0 left-0 z-20 w-16 cursor-w-resize lg:w-20"
        onMouseEnter={() => canScrollLeft && setDir("left")}
        onMouseLeave={() => setDir(null)}
        aria-hidden="true"
      >
        <div
          className={`nav-edge nav-edge-left ${canScrollLeft ? "opacity-100" : "opacity-0"} ${dir === "left" ? "nav-edge-active" : ""}`}
        >
          <CaretLeft weight="bold" className="size-4" />
        </div>
      </div>

      {/* Scrollable track */}
      <div
        ref={trackRef}
        className={`scroll-x-soft -mx-1 flex-1 px-1 lg:mx-0 ${motionClass}`}
      >
        {children}
      </div>

      {/* Right hover zone */}
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 z-20 w-16 cursor-e-resize lg:w-20"
        onMouseEnter={() => canScrollRight && setDir("right")}
        onMouseLeave={() => setDir(null)}
        aria-hidden="true"
      >
        <div
          className={`nav-edge nav-edge-right ${canScrollRight ? "opacity-100" : "opacity-0"} ${dir === "right" ? "nav-edge-active" : ""}`}
        >
          <CaretRight weight="bold" className="size-4" />
        </div>
      </div>
    </div>
  );
}
