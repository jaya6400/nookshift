"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Header } from "@/components/Header";
import { SAMPLES } from "@/lib/samples";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* ---------- Hero (fade-in) ---------- */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-7xl px-4 pb-6 pt-12 text-center sm:px-6 sm:pt-16"
        >
          <h1 className="text-4xl font-bold leading-tight text-primary dark:text-white sm:text-5xl md:text-6xl">
            Want to redefine your room, before moving a single chair?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg italic text-slate-600 dark:text-slate-300">
            NookShift is here for you. See First, Analyze the Feel, Then Change
          </p>
        </motion.section>

        {/* ---------- Middle pale-blue card ---------- */}
        <section id="catalogue" className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="card-surface grid gap-8 rounded-2xl p-6 sm:p-8 md:grid-cols-5">
            {/* Transform preview — 60% */}
            <div className="md:col-span-3">
              <h2 className="text-base font-bold text-primary dark:text-white">
                See your space transform in seconds
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Upload, describe vibe, watch grounding in real masks
              </p>
              {/*
                Phase 0: stylized placeholder. Final: replace with an
                auto-playing, muted, looping workspace-interaction video.
              */}
              <div className="mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-link/50 bg-surface2/40 dark:border-link/40 dark:bg-white/5">
                <div className="relative flex h-full w-full items-center justify-center">
                  <Image
                    src="/samples/room-1.png"
                    alt="Workspace preview"
                    fill
                    className="object-cover opacity-80 dark:opacity-60"
                    priority
                  />
                  <div className="relative flex flex-col items-center gap-2 rounded-2xl bg-white/85 px-6 py-4 text-center shadow-key backdrop-blur dark:bg-night/85">
                    <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-key">
                      <Play className="ml-0.5 size-5" fill="currentColor" />
                    </span>
                    <p className="text-sm font-bold text-primary dark:text-white">
                      Auto-play workspace loop
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      Coming with final demo assets
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inspiration Catalogue — 40% */}
            <div className="flex flex-col md:col-span-2">
              <h2 className="text-base font-bold text-primary dark:text-white">
                Inspiration Catalogue
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Real renter rooms, pick one to test
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {SAMPLES.map((s) => (
                  <Link
                    key={s.id}
                    href="/studio"
                    className="group relative aspect-square overflow-hidden rounded-xl shadow-key transition-all duration-150 hover:-translate-y-px hover:shadow-key-lg"
                    title={s.hint}
                  >
                    <Image
                      src={s.src}
                      alt={s.label}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-transparent px-2 pb-1.5 pt-4 text-[10px] font-bold leading-tight text-white">
                      {s.label}
                    </span>
                  </Link>
                ))}
              </div>

              <Link
                href="/studio"
                className="btn-key mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white"
              >
                Try Workspace
                <ArrowRight className="size-4" />
              </Link>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                Your designs will be saved here. For your comeback.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
