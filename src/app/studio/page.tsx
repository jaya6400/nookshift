"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ImagePlus, Lightbulb, Loader2, Minus, Sparkles, Wand2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NameModal } from "@/components/name-modal";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { BottomNav } from "@/components/bottom-nav";
import { FloorPlan } from "@/components/floor-plan";
import { Sidebar } from "@/components/Sidebar";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SAMPLES } from "@/lib/samples";
import type { Operation, Plan, SamResults } from "@/lib/meta";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "result";
type Step = "spark" | "image";

type PlanResponse = {
  plan: Plan;
  samResults: SamResults | null;
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
  const [editingPlan, setEditingPlan] = useState(false);
  const [highlightSamples, setHighlightSamples] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nookshift_user");
      if (saved) {
        setName(saved);
        setDraftName(saved);
      }
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

  const showSamples = () => {
    setHighlightSamples(true);
    window.setTimeout(() => setHighlightSamples(false), 2000);
    if (window.matchMedia("(min-width: 768px)").matches) {
      if (collapsed) setCollapsed(false);
      window.setTimeout(() => {
        document.getElementById("sample-spaces")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, collapsed ? 200 : 0);
    } else {
      setGalleryOpen(true);
    }
  };

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
        samResults: null,
        proposalUrl: null,
        mock: true,
        error: "Network error — showing mock plan.",
      };
    }
    setResult(data);
    setDraftName(name ?? "");
    setEditingPlan(false);
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
    setDraftName(trimmed);
    setSettingsOpen(false);
  };

  const updateOperation = (index: number, patch: Partial<Operation>) => {
    setResult((current) => current ? {
      ...current,
      plan: { ...current.plan, operations: current.plan.operations.map((operation, i) => i === index ? { ...operation, ...patch } : operation) },
    } : current);
  };

  const removeOperation = (index: number) => {
    setResult((current) => current ? {
      ...current,
      plan: { ...current.plan, operations: current.plan.operations.filter((_, i) => i !== index) },
    } : current);
  };

  const logout = () => {
    try { localStorage.removeItem("nookshift_user"); } catch {}
    setName(null);
    setDraftName("");
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
        onSaved={(savedName) => {
          setName(savedName);
          setDraftName(savedName);
          setModalOpen(false);
        }}
      />

      {/* ---------- 20 / 60 / 20 workspace ---------- */}
      <div className="mx-auto flex max-w-[1600px] gap-4 p-4">
        <Sidebar
          name={displayName}
          initial={initial}
          collapsed={collapsed}
          canEditPlan={phase === "result" && Boolean(plan)}
          highlightSamples={highlightSamples}
          draftName={draftName}
          onDraftNameChange={setDraftName}
          onSaveName={() => saveName(draftName)}
          onLogout={logout}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onEditPlan={() => {
            setEditingPlan(true);
            document.getElementById("plan-checklist")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onPickSample={pickSample}
          onShowSamples={showSamples}
        />

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
          <Dropzone
            image={image}
            samResults={result?.samResults ?? null}
            dragging={dragging}
            fileInputRef={fileRef}
            onFile={onFile}
            onDraggingChange={setDragging}
            onShowSamples={showSamples}
            onReplace={() => { setImage(null); setPhase("idle"); setResult(null); }}
          />

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

          <div className="mt-4 flex justify-center">
            {/* Glowing-outline magic button — framer-motion pulse */}
            <Button
              variant="magic"
              size="pill"
              onClick={runMagic}
              disabled={!image || phase === "loading"}
              className="magic-glow"
            >
              {phase === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Talk to See the Magic
            </Button>
          </div>
          {phase === "loading" && <p className="mt-2 flex justify-center gap-1.5 text-xs text-slate-400" role="status"><Loader2 className="size-3.5 animate-spin" />{step === "spark" ? "Understanding goal... (Spark)" : "Rendering preview... (Image)"}</p>}

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
              <div id="plan-checklist">
                <p className="text-sm font-bold text-primary dark:text-white">
                  Plan — {plan.goal}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Detected objects: {result?.samResults?.boxes.length ?? 0}{result?.samResults?.mock ? " (preview data; live SAM not connected)" : ""}</p>
                  <Button variant="ghost" size="sm" onClick={() => setEditingPlan((value) => !value)}>{editingPlan ? "Done editing" : "Edit plan"}</Button>
                </div>
                {plan.constraints.length > 0 && (
                  <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">
                    {plan.constraints.join(" · ")}
                  </p>
                )}
                <ul className="mt-2 space-y-1.5">
                  {plan.operations.map((op, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm dark:bg-night"
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
                      {editingPlan ? <>
                        <select aria-label={`Operation ${i + 1} action`} value={op.action} onChange={(event) => updateOperation(i, { action: event.target.value as Operation["action"] })} className="rounded border border-slate-200 bg-white px-1 py-1 text-xs dark:border-white/10 dark:bg-night2">
                          {["keep", "remove", "recolor", "reposition"].map((action) => <option key={action} value={action}>{action}</option>)}
                        </select>
                        <Input aria-label={`Operation ${i + 1} target`} value={op.target} onChange={(event) => updateOperation(i, { target: event.target.value })} className="h-8 min-w-24 flex-1 text-xs" />
                        <Input aria-label={`Operation ${i + 1} value`} value={op.value ?? ""} onChange={(event) => updateOperation(i, { value: event.target.value || undefined })} placeholder="Value (optional)" className="h-8 min-w-24 flex-1 text-xs" />
                        <button aria-label={`Remove operation ${i + 1}`} onClick={() => removeOperation(i)} className="rounded p-1 text-slate-500 hover:bg-white dark:hover:bg-night2"><Minus className="size-4" /></button>
                      </> : <>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-ring dark:text-link">{op.action}</span>
                        <span className="text-slate-700 dark:text-slate-200">{op.target}{op.value ? ` → ${op.value}` : ""}</span>
                      </>}
                    </li>
                  ))}
                </ul>
                {result?.samResults?.boxes.length ? <ul className="mt-2 flex flex-wrap gap-2" aria-label="Detected objects">
                  {result.samResults.boxes.map((box, index) => <li key={`${box.label}-${index}`} className="rounded-full bg-surface px-2.5 py-1 text-xs text-primary dark:bg-night">● {box.label}</li>)}
                </ul> : null}
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
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your name is stored only in this browser.</DialogDescription>
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); saveName(draftName); }}>
            <label htmlFor="mobile-settings-name" className="text-sm font-bold text-primary dark:text-white">Profile name</label>
            <Input id="mobile-settings-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Enter your name" />
            <Button type="submit" className="w-full">Save</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={logout}>Clear local profile</Button>
          </form>
        </Dialog>

    </div>
  );
}
