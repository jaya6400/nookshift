"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  before: string;
  after: string;
  afterLabel?: string;
  className?: string;
};

/**
 * Drag anywhere on the image to compare before / after.
 * `after` is clipped to the right of the handle; `before` stays underneath.
 */
export function BeforeAfterSlider({
  before,
  after,
  afterLabel = "Generated proposal (mock — not to scale)",
  className,
}: Props) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(98, Math.max(2, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    update(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) update(e.clientX);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "group relative w-full touch-none select-none overflow-hidden rounded-2xl shadow-key",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(2, p - 4));
        if (e.key === "ArrowRight") setPos((p) => Math.min(98, p + 4));
      }}
    >
      {/* After (base layer, stylized to suggest the edit) */}
      <img
        src={after}
        alt="After proposal"
        className="block w-full"
        style={{ filter: "saturate(1.35) brightness(1.07) hue-rotate(-8deg)" }}
        draggable={false}
      />
      {/* Before (clipped overlay) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
          src={before}
          alt="Before"
          className="block h-full w-full object-cover"
          draggable={false}
        />
      </div>

      {/* Handle */}
      <div
        className="pointer-events-none absolute inset-y-0"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow" />
        <div className="absolute top-1/2 -ml-3.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-key-lg ring-2 ring-accent">
          ⇔
        </div>
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary/85 px-2.5 py-1 text-[11px] font-bold text-white">
        {afterLabel}
      </span>
    </div>
  );
}
