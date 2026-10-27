import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* Cube mark */}
      <svg viewBox="0 0 24 24" className="size-6 text-primary dark:text-surface2" fill="currentColor" aria-hidden>
        <path d="M12 1.5 21.5 6.75v10.5L12 22.5 2.5 17.25V6.75L12 1.5Z" opacity="0.18" />
        <path d="M12 1.5 21.5 6.75 12 12 2.5 6.75 12 1.5Z" />
        <path d="M12 12v10.5L2.5 17.25V6.75L12 12Z" opacity="0.55" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-primary dark:text-white">
        NookShift
      </span>
    </span>
  );
}
