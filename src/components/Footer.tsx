"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Slim, true footer — global, rendered once from layout.tsx.
 * Hidden on /studio so the workspace stays chrome-free.
 */
export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/studio")) return null;

  return (
    <footer className="mt-16 flex h-14 items-center justify-center border-t border-[#DBEAFE] bg-[#EFF6FF] px-4 py-4 dark:border-white/10 dark:bg-night2">
      <p className="text-[13px] text-slate-500 dark:text-slate-300">
        Built by Jaya Dubey (Indian Dev)
        <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
        <Link
          href="https://linkedin.com/in/jaya-dubey"
          target="_blank"
          rel="noreferrer"
          className="font-bold text-link hover:underline"
        >
          linkedin.com/in/jaya-dubey
        </Link>
      </p>
    </footer>
  );
}
