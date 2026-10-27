"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur dark:border-white/5 dark:bg-night/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="NookShift home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/#catalogue"
            className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-primary shadow-key transition-all duration-150 hover:-translate-y-px hover:bg-surface2 dark:bg-night2 dark:text-slate-100"
          >
            Catalogue
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
