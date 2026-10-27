"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("nookshift_theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <div className="flex items-center gap-2 text-sm font-bold text-primary dark:text-slate-200">
      <span className={cn(!dark && "text-link")}>Light</span>
      <button
        role="switch"
        aria-checked={dark}
        aria-label="Toggle dark mode"
        onClick={toggle}
        className={cn(
          "relative h-6 w-11 rounded-full shadow-key transition-colors duration-200",
          dark ? "bg-primary" : "bg-surface2"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200",
            dark ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
      <span className={cn(dark && "text-link")}>Dark</span>
    </div>
  );
}
