"use client";

import Link from "next/link";
import { Home, Images, Settings } from "lucide-react";

export function BottomNav({
  onGallery,
  onSettings,
}: {
  onGallery: () => void;
  onSettings: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-100 bg-white/90 py-2 backdrop-blur dark:border-white/5 dark:bg-night/90 md:hidden">
      <Link
        href="/"
        className="flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-bold text-primary dark:text-slate-200"
      >
        <Home className="size-5" />
        Home
      </Link>
      <button
        onClick={onGallery}
        className="flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-bold text-primary dark:text-slate-200"
      >
        <Images className="size-5" />
        Gallery
      </button>
      <button
        onClick={onSettings}
        className="flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-bold text-primary dark:text-slate-200"
      >
        <Settings className="size-5" />
        Settings
      </button>
    </nav>
  );
}
