"use client";

import { usePathname } from "next/navigation";

/**
 * Slim, true footer — global, rendered once from layout.tsx.
 * Hidden on /studio so the workspace stays chrome-free.
 */
export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/studio")) return null;

  return (
    <footer className="mt-8 flex items-center justify-center border-t border-[#DBEAFE] bg-white px-4 py-6 dark:border-white/10 dark:bg-night">
      <p className="text-sm text-muted-foreground text-slate-500 dark:text-slate-300">
        Built by{" "}
        <a
          href="https://www.linkedin.com/in/jaya6400"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[#1C0770]"
        >
          Indie Dev
        </a>
      </p>
    </footer>
  );
}
