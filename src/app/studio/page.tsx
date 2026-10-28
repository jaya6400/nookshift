"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CircleHelp, ImagePlus, Loader2, Mic, Minus, Save, UserRound, Wand2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NameModal } from "@/components/name-modal";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { BottomNav } from "@/components/bottom-nav";
import { FloorPlan } from "@/components/floor-plan";
import { Sidebar } from "@/components/Sidebar";
import { HelpModal } from "@/components/HelpModal";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SAMPLES } from "@/lib/samples";
import type { Operation, Plan, SamResults } from "@/lib/meta";
import { saveEdit } from "@/lib/saved-edits";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "result";
type Step = "spark" | "image";

type PlanResponse = {
  plan: Plan;
  samResults: SamResults | null;
  proposalUrl: string | null;
  error?: string;
};

type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
  resultIndex: number;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingPlan, setEditingPlan] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseRef = useRef("");
  const speechActiveRef = useRef(false);

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

  useEffect(() => () => recognitionRef.current?.stop(), []);

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
    setGalleryOpen(true);
  };

  const toggleListening = () => {
    if (speechActiveRef.current) {
      recognitionRef.current?.stop();
      return;
    }
    const speechApi = window as SpeechWindow;
    const Recognition = speechApi.SpeechRecognition ?? speechApi.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage("Voice input is not supported in this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    speechBaseRef.current = idea.trim();
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }
      const base = speechBaseRef.current;
      setIdea(`${base}${base && transcript ? " " : ""}${transcript}`);
    };
    recognition.onerror = () => {
      speechActiveRef.current = false;
      setListening(false);
      setSpeechMessage("Voice input could not start. Check microphone permission.");
    };
    recognition.onend = () => {
      speechActiveRef.current = false;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setSpeechMessage("");
    speechActiveRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      speechActiveRef.current = false;
      setListening(false);
      setSpeechMessage("Voice input could not start. Check microphone permission.");
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
        error: "Couldn't reach the planning service. A starter plan is shown.",
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
    setProfileOpen(false);
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

  const regenerateEditedPlan = async () => {
    if (!image || !result || phase === "loading") return;
    const updatedOperations = result.plan.operations;
    const editedPrompt = idea.trim() || result.plan.goal;
    setStep("image");
    setSavedMessage("");
    try {
      const imageBase64 = await toCompressedDataUrl(image);
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          text: editedPrompt,
          operations: updatedOperations,
          isEdit: true,
        }),
      });
      const data = (await response.json()) as PlanResponse;
      if (!response.ok) throw new Error(data.error ?? "Edit regeneration failed");
      setResult(data);
      setEditingPlan(false);
    } catch {
      setSavedMessage("Could not regenerate this edit. Your operation changes are preserved.");
    } finally {
      setStep(null);
    }
  };

  const logout = () => {
    try { localStorage.removeItem("nookshift_user"); } catch {}
    setName(null);
    setDraftName("");
    setSettingsOpen(false);
    setProfileOpen(false);
  };

  const persistEdit = () => {
    if (!image || !plan) return;
    try {
      saveEdit({
        originalUrl: image,
        proposalUrl: result?.proposalUrl ?? image,
        plan,
        timestamp: new Date().toISOString(),
      });
      window.dispatchEvent(new Event("nookshift:saved-edits"));
      setSavedMessage("Edit saved.");
    } catch {
      setSavedMessage("Could not save this edit. Browser storage may be full.");
    }
  };

  const displayName = name ?? "there";
  const initial = displayName.slice(0, 1).toUpperCase();
  const plan = result?.plan ?? null;
  const proposalSrc = result?.proposalUrl ?? image ?? "";

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Top bar */}
      <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-100 bg-white/80 px-4 backdrop-blur dark:border-white/5 dark:bg-night/80">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary dark:text-slate-200"
        >
          <ArrowLeft className="size-4" />
          <Logo />
        </Link>
        <ThemeToggle />
      </motion.header>

      <NameModal
        open={modalOpen}
        onSaved={(savedName) => {
          setName(savedName);
          setDraftName(savedName);
          setModalOpen(false);
        }}
      />
      <ProfileEditModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        draftName={draftName}
        onDraftNameChange={setDraftName}
        onSave={() => saveName(draftName)}
        onLogout={logout}
      />
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />

      {/* ---------- 20 / 60 / 20 workspace ---------- */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        className="mx-auto flex max-w-[1600px] gap-4 p-4"
      >
        <Sidebar
          name={displayName}
          initial={initial}
          collapsed={collapsed}
          canEditPlan={phase === "result" && Boolean(plan)}
          onEditProfile={() => {
            setDraftName(name ?? "");
            setProfileOpen(true);
          }}
          onShowHelp={() => setHelpOpen(true)}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onEditPlan={() => {
            setEditingPlan(true);
            document.getElementById("plan-checklist")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onShowSamples={showSamples}
        />

        {/* ===== Center canvas ===== */}
        <motion.section variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.45 }} className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-key dark:border-white/5 dark:bg-night2 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-primary dark:text-white">
              Workspace Canvas
            </h2>
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
          
          </label>
          <div className="relative mt-2">
            <Input
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (speechActiveRef.current) recognitionRef.current?.stop();
                else runMagic();
              }}
              placeholder={listening ? "Press Enter or mic again to stop" : "Type your idea or speak ..."}
              className="rounded-full pr-11"
            />
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              className={cn("absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-primary hover:bg-surface dark:text-surface2", listening && "animate-pulse text-red-600")}
            >
              <Mic className="size-4" />
            </button>
          </div>
          {(listening || speechMessage) && <p className={cn("mt-2 text-center text-xs", listening ? "text-red-600" : "text-slate-500")} role="status">{listening ? "Listening..." : speechMessage}</p>}

          <div className="mt-4 flex justify-center">
            {/* Glowing-outline magic button — framer-motion pulse */}
            <Button
              variant="magic"
              size="pill"
              onClick={runMagic}
              disabled={!image || phase === "loading"}
              className="magic-glow w-56"
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 animate-pulse space-y-3" aria-label="Analyzing">
              <div className="h-4 w-2/5 rounded bg-surface2 dark:bg-white/10" />
              <div className="h-4 w-3/5 rounded bg-surface2 dark:bg-white/10" />
              <div className="h-28 w-full rounded-2xl bg-surface2/60 dark:bg-white/5" />
            </motion.div>
          )}

          {/* Live result: banner + Spark checklist + real before/after */}
          {phase === "result" && image && plan && (
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.5 }} className="mt-6 space-y-4">
              {(!result?.proposalUrl || result?.error) && (
                <p className="rounded-xl bg-surface2/60 px-3 py-2 text-xs font-bold text-primary dark:bg-white/5 dark:text-surface2">
                  {result?.error ??
                    "Proposal unavailable; showing the original photo."}
                </p>
              )}
              <div id="plan-checklist">
                <p className="text-sm font-bold text-primary dark:text-white">
                  Plan — {plan.goal}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{result?.samResults?.connected ? `SAM connected · ${result.samResults.boxes.length} objects detected` : `Objects from plan: ${result?.samResults?.boxes.length ?? 0}`}</p>
                  <Button variant="ghost" size="sm" disabled={step === "image"} onClick={() => editingPlan ? regenerateEditedPlan() : setEditingPlan(true)}>{step === "image" ? "Re-generating..." : editingPlan ? "Done editing" : "Edit plan"}</Button>
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
                  {result.samResults.boxes.map((box, index) => <li key={`${box.label}-${index}`} className="rounded-full bg-surface px-2.5 py-1 text-xs text-primary dark:bg-night">{box.label}</li>)}
                </ul> : null}
              </div>
              <BeforeAfterSlider before={image} after={proposalSrc} afterLabel="Generated proposal" />
              <div className="flex flex-col items-center gap-2">
                <Button variant="default" size="pill" onClick={persistEdit} className="magic-glow w-56 bg-primary text-white">
                  <Save className="size-3.5" />
                  Save Edit
                </Button>
                {savedMessage && <span className="text-center text-xs text-slate-500" role="status">{savedMessage}</span>}
              </div>
            </motion.div>
          )}
        </motion.section>

        {/* ===== Right panel (desktop) — Quick Tips only, no profile ===== */}
        <motion.aside variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.45, delay: 0.1 }} className="hidden w-[20%] min-w-60 flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-key dark:border-white/5 dark:bg-night2 lg:flex">
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
        </motion.aside>
      </motion.div>

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
          Drag from your gallery.
        </p>
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Manage your profile or get help.</DialogDescription>
        <div className="mt-4 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setSettingsOpen(false);
              setDraftName(name ?? "");
              setProfileOpen(true);
            }}
          >
            <UserRound className="size-4" />
            Profile
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setSettingsOpen(false);
              setHelpOpen(true);
            }}
          >
            <CircleHelp className="size-4" />
            Help
          </Button>
        </div>
      </Dialog>

    </div>
  );
}
