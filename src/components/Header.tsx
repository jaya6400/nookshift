"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, HelpCircle } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { HelpModal } from "./HelpModal";

const UPVOTES_KEY = "nookshift_upvotes";
const HAS_UPVOTED_KEY = "nookshift_has_upvoted";

export function Header() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [upvotes, setUpvotes] = useState(0);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    setUpvotes(Number(localStorage.getItem(UPVOTES_KEY)) || 0);
    setHasUpvoted(localStorage.getItem(HAS_UPVOTED_KEY) === "true");
  }, []);

  const upvote = () => {
    if (hasUpvoted) {
      showToast("Thanks for supporting NookShift!");
      return;
    }
    const nextCount = upvotes + 1;
    localStorage.setItem(UPVOTES_KEY, String(nextCount));
    localStorage.setItem(HAS_UPVOTED_KEY, "true");
    setUpvotes(nextCount);
    setHasUpvoted(true);
    showToast("Thanks for your upvote!");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur dark:border-white/5 dark:bg-night/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="NookShift home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/#catalog"
            className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-primary shadow-key transition-all duration-150 hover:-translate-y-px hover:bg-surface2 dark:bg-night2 dark:text-slate-100"
          >
            Catalogue
          </Link>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-primary shadow-key transition-all duration-150 hover:-translate-y-px hover:bg-surface2 dark:bg-night2 dark:text-slate-100"
          >
            Help
          </button>
          <button
            type="button"
            onClick={upvote}
            aria-label={`Upvote NookShift, ${upvotes} votes${hasUpvoted ? ", already voted" : ""}`}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition-colors ${hasUpvoted ? "border-[#1C0770] text-[#1C0770] dark:text-white" : "border-slate-200 text-primary hover:border-primary dark:border-white/15 dark:text-white"}`}
          >
            <Heart className={`size-4 ${hasUpvoted ? "fill-current" : ""}`} />
            <span>{upvotes}</span>
          </button>
          <ThemeToggle />
        </nav>
      </div>
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
      {toast && (
        <div role="status" className="fixed right-4 top-20 z-50 rounded-xl bg-primary px-4 py-3 text-sm text-white shadow-key-lg">
          {toast}
        </div>
      )}
    </header>
  );
}
