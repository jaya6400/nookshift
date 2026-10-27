"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CloudUpload,
  ImagePlus,
  Images,
  Lightbulb,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PencilRuler,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NameModal } from "@/components/name-modal";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { BottomNav } from "@/components/bottom-nav";
import { FloorPlan } from "@/components/floor-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SAMPLES } from "@/lib/samples";
import type { Plan } from "@/lib/meta";
import { cn } from "@/lib/utils";

const MotionButton = motion(Button);

type Phase = "idle" | "loading" | "result";
type Step = "spark" | "image";

type PlanResponse = {
  plan: Plan;
  proposalUrl: string | null;
  mock: boolean;
  error?: string;
};

/** Compress any image source to 1024px webp data URL (<2MB). */
async function toCompressedDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const blob = await (await fetch(src)).blob();
  const url = URL.createObjectURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const max = 1024;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  let out = canvas.toDataURL("image/webp", 0.85);
  let q = 0.85;
  while (out.length > 2_000_000 && q > 0.3) {
    q -= 0.15;
    out = canvas.toDataURL("image/webp", q);
  }
  return out;
}

export default function StudioPage() {
  const [name, setName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<Step | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [dragging, setDragging] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nookshift_user");
      if (saved) setName(saved);
      else setModalOpen(true);
    } catch {
      setModalOpen(true);
    }
  }, []);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      setImage(await toCompressedDataUrl(URL.createObjectURL(file)));
      setPhase("idle");
      setResult(null);
    } catch {
      /* ignore */
    }
  }, []);

  const pickSample = useCallback(async (src: string) => {
    setGalleryOpen(false);
    setPhase("idle");
    setResult(null);
    setImage(await toCompressedDataUrl(src));
  }, []);

  const runMagic = async () => {
    if (!image || phase === "loading") return;
    const text = idea.trim() || "Make this room calmer, brighter and work-friendly";
    setPhase("loading");
    setResult(null);
    setStep("spark");
    let data: PlanResponse;
    try {
      const imageBase64 = await toCompressedDataUrl(image);
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, text }),
      });
      data = (await res.json()) as PlanResponse;
      // Let the second loading step read before revealing the result.
      setStep("image");
      await new Promise((r) => setTimeout(r, 800));
    } catch {
      data = {
        plan: {
          goal: text,
          constraints: [],
          operations: [
            { action: "remove", target: "clutter" },
            { action: "recolor", target: "walls", value: "warm white" },
            { action: "reposition", target: "desk", value: "near the window" },
          ],
        },
        proposalUrl: null,
        mock: true,
        error: "Network error — showing mock plan.",
      };
    }
    setResult(data);
    setStep(null);
    setPhase("result");
  };

  const saveName = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem("nookshift_user", trimmed);
    } catch {}
    setName(trimmed);
    setSettingsOpen(false);
  };

  const displayName = name ?? "there";
  const initial = displayName.slice(0, 1).toUpperCase();
  const plan = result?.plan ?? null;
  const proposalSrc = result?.proposalUrl ?? image ?? "";

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-100 bg-white/80 px-4 backdrop-blur dark:border-white/5 dark:bg-night/80">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary dark:text-slate-200"
        >
          <ArrowLeft className="size-4" />
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <NameModal
        open={modalOpen}
        onSaved={(n) => {
          setName(n);
          setModalOpen(false);
        }}
      />

      {/* ---------- 20 / 60 / 20 workspace ---------- */}
      <div className="mx-auto flex max-w-[1600px] gap-4 p-4">
        {/* ===== Left sidebar (desktop) — profile lives ONLY here, bottom-left ===== */}
        <aside
          className={cn(
            "relative hidden flex-col rounded-2xl border border-slate-100 bg-white p-4 pb-24 shadow-key transition-all duration-200 dark:border-white/5 dark:bg-night2 md:flex",
            collapsed ? "w-16 items-center" : "w-[20%] min-w-52"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            {!collapsed && (
              <div>
                <h2 className="text-base font-bold text-primary dark:text-white">
                  Your Space
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Hello, {displayName}
                </p>
              </div>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="rounded-lg p-1.5 text-primary transition-colors hover:bg-surface dark:text-slate-200 dark:hover:bg-night"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>

          {!collapsed && (
            <div className="mt-5 flex flex-1 flex-col gap-3">
              <Button variant="outline" onClick={() => setGalleryOpen(true)}>
                <Images className="size-4" />
                Get Sample Images
              </Button>
              <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
                <PencilRuler className="size-4" />
                Edit Space
              </Button>

              <div className="mt-auto space-y-2 border-t border-slate-100 pt-4 dark:border-white/5">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-surface dark:text-slate-100 dark:hover:bg-night"
                >
                  <SlidersHorizontal className="size-4" />
                  Settings
                </button>
                <div className="px-2 py-1.5">
                  <p className="flex items-center gap-2 text-sm font-bold text-primary dark:text-slate-100">
                    <UserRound className="size-4" />
                    Profile
                  </p>
                  <Input
                    className="mt-2 h-9 text-xs"
                    defaultValue={name ?? ""}
                    placeholder="Enter your name before workspace"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        saveName((e.target as HTMLInputElement).value);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Single profile badge — bottom-left of sidebar only */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
            <span className="relative flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-ring text-sm font-bold text-white shadow-key">
              {initial}
              {/* Lime accent: 2px status dot */}
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-white dark:ring-night2" />
            </span>
            {!collapsed && (
              <div>
                <p className="text-sm font-bold leading-tight text-primary dark:text-white">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Workspace architect
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* ===== Center canvas ===== */}
        <section className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-key dark:border-white/5 dark:bg-night2 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-primary dark:text-white">
              Workspace Canvas
            </h2>
            <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-primary dark:bg-night dark:text-surface2">
              60%
            </span>
          </div>

          {/* Dropzone / preview — scales up while dragging */}
          <div
            className={cn(
              "card-surface mt-4 flex min-h-64 items-center justify-center rounded-2xl p-4 transition-transform duration-200",
              dragging && "scale-[1.02]"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
          >
            {image ? (
              <div className="relative w-full max-w-lg overflow-hidden rounded-xl shadow-key">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Your space" className="block w-full" />
                <button
                  onClick={() => {
                    setImage(null);
                    setPhase("idle");
                    setResult(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full max-w-lg flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-link/50 bg-surface2/30 px-6 py-10 text-center transition-colors hover:border-link dark:bg-white/5"
              >
                <CloudUpload className="size-8 text-link" />
                <span className="text-sm font-bold text-primary dark:text-white">
                  Drop your space image or video
                </span>
                <span className="text-sm text-link">
                  Not have? Get one from Samples -&gt;
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {/* Idea input */}
          <label
            htmlFor="idea"
            className="mt-6 block text-sm font-bold text-primary dark:text-white"
          >
            Type your idea or speak
          </label>
          <div className="relative mt-2">
            <Input
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runMagic()}
              placeholder="Type your idea or speak --"
              className="rounded-full pr-11"
            />
            <Lightbulb className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-primary dark:text-surface2" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Glowing-outline magic button — framer-motion pulse */}
            <MotionButton
              variant="magic"
              size="pill"
              onClick={runMagic}
              disabled={!image || phase === "loading"}
              whileHover={{ y: -1 }}
              whileTap={{ y: 1 }}
              animate={{
                boxShadow: [
                  "0 0 0 rgba(241,255,94,0)",
                  "0 0 20px rgba(241,255,94,0.8)",
                  "0 0 0 rgba(241,255,94,0)",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {phase === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Talk to See the Magic
            </MotionButton>
            <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {phase === "loading" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {step === "spark"
                    ? "Understanding goal… (Spark)"
                    : "Rendering preview… (Image)"}
                </>
              ) : (
                "Glowing outline indicates studio magic."
              )}
            </p>
          </div>

          {/* Loading skeleton with live step label */}
          {phase === "loading" && (
            <div className="mt-6 animate-pulse space-y-3" aria-label="Analyzing">
              <div className="h-4 w-2/5 rounded bg-surface2 dark:bg-white/10" />
              <div className="h-4 w-3/5 rounded bg-surface2 dark:bg-white/10" />
              <div className="h-28 w-full rounded-2xl bg-surface2/60 dark:bg-white/5" />
            </div>
          )}

          {/* Live result: banner + Spark checklist + real before/after */}
          {phase === "result" && image && plan && (
            <div className="mt-6 animate-fade-up space-y-4">
              {(result?.mock || !result?.proposalUrl || result?.error) && (
                <p className="rounded-xl bg-surface2/60 px-3 py-2 text-xs font-bold text-primary dark:bg-white/5 dark:text-surface2">
                  {result?.error ??
                    "Live image unavailable — showing stylized preview. Not to scale."}
                </p>
              )}
              <div>
                <p className="text-sm font-bold text-primary dark:text-white">
                  Plan — {plan.goal}
                </p>
                {plan.constraints.length > 0 && (
                  <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">
                    {plan.constraints.join(" · ")}
                  </p>
                )}
                <ul className="mt-2 space-y-1.5">
                  {plan.operations.map((op, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm dark:bg-night"
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border",
                          op.action === "remove"
                            ? "border-red-300 text-red-500"
                            : "border-emerald-300 text-emerald-600"
                        )}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ring dark:text-link">
                        {op.action}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {op.target}
                        {op.value ? ` → ${op.value}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <BeforeAfterSlider before={image} after={proposalSrc} />
              <Button variant="soft" size="sm" onClick={() => setPhase("idle")}>
                <Sparkles className="size-3.5" />
                Refine idea
              </Button>
            </div>
          )}
        </section>

        {/* ===== Right panel (desktop) — Quick Tips only, no profile ===== */}
        <aside className="hidden w-[20%] min-w-60 flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-key dark:border-white/5 dark:bg-night2 lg:flex">
          <div>
            <h2 className="text-base font-bold text-primary dark:text-white">
              Quick Tips
            </h2>
            <div className="mt-2 rounded-xl bg-surface p-3 dark:bg-night">
              <FloorPlan className="w-full" />
              {image ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-300">
                  <li>• Desk works best near the window.</li>
                  <li>• Declutter surfaces before shooting.</li>
                  <li>• Keep what you love — edit the rest.</li>
                </ul>
              ) : (
                <p className="mt-2 text-xs italic text-slate-400 dark:text-slate-500">
                  Pick a sample or drop a photo — tips will follow your space.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ---------- Mobile bottom nav ---------- */}
      <BottomNav
        onGallery={() => setGalleryOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* ---------- Sample gallery dialog ---------- */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogTitle>Sample Spaces</DialogTitle>
        <DialogDescription>
          Pick a room to load it into your canvas.
        </DialogDescription>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => pickSample(s.src)}
              className="group relative aspect-square overflow-hidden rounded-xl shadow-key transition-all duration-150 hover:-translate-y-px hover:shadow-key-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt={s.label}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/85 to-transparent px-2 pb-1.5 pt-5 text-left text-[10px] font-bold leading-tight text-white">
                {s.label}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <ImagePlus className="size-3.5" />
          Or drag &amp; drop your own photo onto the canvas.
        </p>
      </Dialog>

      {/* ---------- Settings dialog ---------- */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>
          Your name shows up across the workspace. No account, no sign-in.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveName(draftName);
          }}
        >
          <label
            htmlFor="settings-name"
            className="text-sm font-bold text-primary dark:text-white"
          >
            Name
          </label>
          <Input
            id="settings-name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Enter your name before workspace"
          />
          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
