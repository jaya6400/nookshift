"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Header } from "@/components/Header";
import { SavedEditsCarousel } from "@/components/SavedEditsCarousel";
import { SAMPLES } from "@/lib/samples";

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const promoVideoRef = useRef<HTMLVideoElement>(null);
  const [isPromoPlaying, setIsPromoPlaying] = useState(false);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0.85]);
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -10]);

  const togglePromoPlayback = async () => {
    const video = promoVideoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        setIsPromoPlaying(false);
      }
    } else {
      video.pause();
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* ---------- Hero (fade-in) ---------- */}
        <motion.section
          ref={heroRef}
          initial={{ opacity: 1, y: 20, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: false, amount: 0.2, margin: "-5% 0px -5% 0px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mx-auto flex min-h-[calc(70vh-3.5rem)] max-w-7xl flex-col justify-center px-4 pb-12 pt-12 text-center sm:px-6 sm:pt-16"
        >
          <motion.div className="relative" style={{ opacity: heroOpacity, y: heroY }}>
            <h1 className="text-4xl font-bold leading-tight text-primary dark:text-white sm:text-5xl md:text-6xl">
              Want to redefine your room, before moving a single chair?
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg italic text-slate-600 dark:text-slate-300">
              NookShift is here for you. See First, Analyze the Feel, Then Change
            </p>
          </motion.div>
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[#F1FF5E]/5 blur-2xl" initial={{ opacity: 0 }} whileInView={{ opacity: [0, 1, 0] }} viewport={{ once: false, amount: 0.2, margin: "-5% 0px -5% 0px" }} transition={{ duration: 0.2 }} />
        </motion.section>

        {/* ---------- Middle pale-blue card ---------- */}
        <motion.section
          id="catalog"
          initial={{ opacity: 1, y: 20, filter: "blur(0px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: false, amount: 0.2, margin: "-5% 0px -5% 0px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mx-auto mb-16 mt-0 max-w-7xl px-4 pt-0 sm:px-6"
        >
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[#F1FF5E]/5 blur-2xl" initial={{ opacity: 0 }} whileInView={{ opacity: [0, 1, 0] }} viewport={{ once: false, amount: 0.2, margin: "-5% 0px -5% 0px" }} transition={{ duration: 0.2 }} />
          <div className="card-surface grid gap-8 rounded-2xl p-6 sm:p-8 md:grid-cols-5">
            {/* Transform preview — 60% */}
            <motion.div className="md:col-span-3" initial={{ opacity: 0.6, y: 20, filter: "blur(2px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: false, amount: 0.2, margin: "-5% 0px -5% 0px" }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <h2 className="text-base font-bold text-primary dark:text-white">
                See your space transform in seconds
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Upload, describe vibe, watch grounding in real masks
              </p>
              <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl bg-black">
                <video
                  ref={promoVideoRef}
                  src="/promo.mp4"
                  poster="/samples/room-3.png"
                  muted
                  playsInline
                  onPlay={() => setIsPromoPlaying(true)}
                  onPause={() => setIsPromoPlaying(false)}
                  onEnded={() => setIsPromoPlaying(false)}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={togglePromoPlayback}
                  aria-label={isPromoPlaying ? "Pause promo video" : "Play promo video"}
                  className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-key transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  {isPromoPlaying ? (
                    <Pause className="size-6" fill="currentColor" />
                  ) : (
                    <Play className="ml-1 size-6" fill="currentColor" />
                  )}
                </button>
              </div>
            </motion.div>

            {/* Inspiration Catalogue — 40% */}
            <motion.div className="flex flex-col md:col-span-2" initial={{ opacity: 0.6, y: 20, filter: "blur(2px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: false, amount: 0.2, margin: "-5% 0px -5% 0px" }} transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}>
              <h2 className="text-base font-bold text-primary dark:text-white">
                Inspiration Catalogue
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Real renter rooms, pick one to test
              </p>
              <motion.div
                className="mt-4 grid grid-cols-3 gap-3"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.2, margin: "-5% 0px -5% 0px" }}
                variants={{
                  hidden: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
                  visible: { transition: { staggerChildren: 0.1 } },
                }}
              >
                {SAMPLES.map((s) => (
                  <motion.div
                    key={s.id}
                    variants={{
                      hidden: { opacity: 0.6, y: 20 },
                      visible: { opacity: 1, y: 0, scale: 1 },
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <Link
                      href={s.isRealRoom ? `/studio?sample=${s.id}` : "/studio"}
                      className="group relative block aspect-square overflow-hidden rounded-xl shadow-key transition-all duration-150 hover:-translate-y-px hover:shadow-key-lg"
                      title={s.description ?? s.hint}
                    >
                      <Image
                        src={s.src}
                        alt={s.label}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {s.isRealRoom && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold text-primary shadow-key">
                          Real Room
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-transparent px-2 pb-1.5 pt-4 text-[10px] font-bold leading-tight text-white">
                        {s.title ?? s.label}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>

              <Link
                href="/studio"
                className="btn-key mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white"
              >
                Try Workspace
                <ArrowRight className="size-4" />
              </Link>
              <p className="mt-3 text-sm text-center text-slate-500 dark:text-slate-300">
                Your designs will be saved here. For your comeback.
              </p>
            </motion.div>
          </div>
        </motion.section>
        <SavedEditsCarousel />
      </main>
    </div>
  );
}
