"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SAMPLES } from "@/lib/samples";
import type { Operation, Plan, PerViewResult, SamResults } from "@/lib/meta";
import { saveEdit } from "@/lib/saved-edits";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "result";
type Step = "spark" | "image" | "refine";

type ViewStatus = "idle" | "loading" | "success" | "error";
type StudioView = { id: string; image: string; label: string; status: ViewStatus; result?: PerViewResult; plan?: Plan };
type BatchResponse = { plan: Plan; results: PerViewResult[]; error?: string };

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

/** Compress an image source to WebP under 800 KB at a 1024px longest edge. */
async function toCompressedDataUrl(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  const url = URL.createObjectURL(blob);
  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
    if (src.startsWith("blob:")) URL.revokeObjectURL(src);
  }
  const max = 1024;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const maxBytes = 800 * 1024;
  for (let quality = 0.86; quality >= 0.2; quality -= 0.08) {
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (compressed && compressed.size < maxBytes) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });
    }
  }
  throw new Error("Image could not be compressed below 800 KB.");
}

export default function StudioPage() {
  const [name, setName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [images, setImages] = useState<StudioView[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [idea, setIdea] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<Step | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dragging, setDragging] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingPlan, setEditingPlan] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [refineInstructionsByView, setRefineInstructionsByView] = useState<Record<string, string[]>>({});
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const prefersReducedMotion = useReducedMotion();
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

  const onFiles = useCallback(async (files: File[]) => {
    const remaining = Math.max(0, 3 - images.length);
    const accepted = files.slice(0, remaining);
    setUploadError("");
    const convertedResults = await Promise.all(accepted.map(async (file) => {
      try {
        return {
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          image: await toCompressedDataUrl(URL.createObjectURL(file)),
          label: file.name,
          status: "idle" as const,
        };
      } catch {
        return null;
      }
    }));
    const converted = convertedResults.filter((view): view is NonNullable<typeof view> => view !== null);
    if (converted.length !== accepted.length) setUploadError("Some images could not be compressed below 800 KB and were not added.");
    setImages((current) => {
      const combined = [...current, ...converted];
      const wideIndex = combined.findIndex((view) => view.label.toLowerCase().includes("full-mandir-hall-room"));
      if (wideIndex > 0) combined.unshift(...combined.splice(wideIndex, 1));
      return combined.map((view) => ({ ...view, status: "idle" as const, result: undefined }));
    });
    setPhase("idle");
    setPlan(null);
    setGenerationError("");
  }, [images.length]);

  const pickSample = useCallback(async (sample: (typeof SAMPLES)[number]) => {
    setGalleryOpen(false);
    setPhase("idle");
    setPlan(null);
    setGenerationError("");
    setUploadError("");
    const sampleImages = sample.isRealRoom && sample.images?.length ? sample.images : [sample.src];
    const converted = await Promise.all(sampleImages.slice(0, 3).map(async (src, index) => ({
      id: `${sample.id}-${index}`,
      image: await toCompressedDataUrl(src),
      label: src.split("/").at(-1) ?? `View ${index + 1}`,
      status: "idle" as const,
    })));
    setImages(converted);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const sampleId = new URLSearchParams(window.location.search).get("sample");
    const sample = SAMPLES.find((entry) => entry.id === sampleId && entry.isRealRoom);
    if (sample) void pickSample(sample);
  }, [pickSample]);

  const activeView = images[activeIndex] ?? null;
  const activeResult = activeView?.result ?? null;
  const activePlan = activeView?.plan ?? plan;
  const refineInstructions = activeView ? refineInstructionsByView[activeView.id] ?? [] : [];
  const proposalSrc = activeResult?.proposalUrl ?? activeView?.image ?? "";

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
    if (!images.length || phase === "loading") return;
    const text = idea.trim() || "Make this room calmer, brighter and work-friendly";
    setPhase("loading");
    setGenerationError("");
    setStep("spark");
    setImages((current) => current.map((view) => ({ ...view, status: "loading", result: undefined })));
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: images.map((view) => view.image), text }),
      });
      const data = (await res.json()) as BatchResponse;
      if (!res.ok) throw new Error(data.error ?? "Planning request failed.");
      setPlan(data.plan);
      setImages((current) => current.map((view, index) => {
        const viewResult = data.results.find((item) => item.index === index);
        return { ...view, status: viewResult?.proposalUrl ? "success" : "error", result: viewResult ?? { index, proposalUrl: null, samResults: null, error: "No result returned for this view." } };
      }));
      setStep("image");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't reach the planning service.";
      setGenerationError(message);
      setImages((current) => current.map((view, index) => ({
        ...view,
        status: "error",
        result: { index, proposalUrl: null, samResults: null, error: message },
      })));
    }
    setDraftName(name ?? "");
    setEditingPlan(false);
    setStep(null);
    setPhase("result");
  };

  const retryView = async (index: number) => {
    const view = images[index];
    if (!view || !plan || view.status === "loading") return;
    const text = idea.trim() || plan.goal;
    setGenerationError("");
    setImages((current) => current.map((item, viewIndex) => viewIndex === index ? { ...item, status: "loading" } : item));
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [view.image], text, existingPlan: plan, index }),
      });
      const data = (await response.json()) as BatchResponse;
      if (!response.ok) throw new Error(data.error ?? "Retry failed.");
      const result = data.results[0];
      setImages((current) => current.map((item, viewIndex) => viewIndex === index ? {
        ...item,
        status: result?.proposalUrl ? "success" : "error",
        result: result ?? { index, proposalUrl: null, samResults: null, error: "No result returned for this view." },
      } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry failed.";
      setImages((current) => current.map((item, viewIndex) => viewIndex === index ? {
        ...item,
        status: "error",
        result: { index, proposalUrl: null, samResults: item.result?.samResults ?? null, error: message },
      } : item));
    }
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
    const currentPlan = activeView?.plan ?? plan;
    const nextPlan = currentPlan ? { ...currentPlan, operations: currentPlan.operations.map((operation, i) => i === index ? { ...operation, ...patch } : operation) } : null;
    if (!nextPlan) return;
    if (activeView?.plan) setImages((current) => current.map((view, viewIndex) => viewIndex === activeIndex ? { ...view, plan: nextPlan } : view));
    else setPlan(nextPlan);
  };

  const removeOperation = (index: number) => {
    const currentPlan = activeView?.plan ?? plan;
    const nextPlan = currentPlan ? { ...currentPlan, operations: currentPlan.operations.filter((_, i) => i !== index) } : null;
    if (!nextPlan) return;
    if (activeView?.plan) setImages((current) => current.map((view, viewIndex) => viewIndex === activeIndex ? { ...view, plan: nextPlan } : view));
    else setPlan(nextPlan);
  };

  const addRefineInstruction = () => {
    const instruction = refineInput.trim();
    if (!instruction || !activeView) return;
    setRefineInstructionsByView((current) => ({
      ...current,
      [activeView.id]: [...(current[activeView.id] ?? []), instruction],
    }));
    setRefineInput("");
  };

  const operationFromRefineInstruction = (instruction: string): Operation => {
    const swapMatch = /swap\s+(?:the\s+)?(?:location of\s+)?(?:the\s+)?(.+?)\s+(?:with|and)\s+(?:the\s+)?(.+?)[.!?]?$/i.exec(instruction);
    if (swapMatch) {
      return { action: "swap", target: `${swapMatch[1].trim()} and ${swapMatch[2].trim()}`, value: "swap positions", isRefine: true };
    }
    const removeMatch = /(?:remove|delete|take out|get rid of)\s+(?:the\s+)?(.+?)(?:\s+that was added)?[.!?]?$/i.exec(instruction);
    if (removeMatch) {
      return { action: "remove", target: removeMatch[1].trim(), value: instruction, isRefine: true };
    }
    const repositionMatch = /(?:move|shift|reposition)\s+(?:the\s+)?(.+?)\s+(?:to\s+)?(.+?)[.!?]?$/i.exec(instruction);
    if (repositionMatch) {
      return { action: "reposition", target: repositionMatch[1].trim(), value: repositionMatch[2].trim(), isRefine: true };
    }
    const recolorMatch = /(?:paint|recolor|colour|color)\s+(?:the\s+)?(.+?)\s+(?:to\s+)?(.+?)[.!?]?$/i.exec(instruction);
    if (recolorMatch) {
      return { action: "recolor", target: recolorMatch[1].trim(), value: recolorMatch[2].trim(), isRefine: true };
    }
    return { action: "keep", target: instruction, isRefine: true };
  };

  const regenerateEditedPlan = async () => {
    if (!activeView || !activePlan || phase === "loading") return;
    const basePrompt = idea.trim() || activePlan.goal;
    const editedPrompt = refineInstructions.length
      ? `${basePrompt}. Also, ${refineInstructions.join(", ")}. Keep existing room layout, camera angle, windows, and other furniture unchanged. Do not add new furniture unless explicitly requested.`
      : `${basePrompt}. Keep existing room layout, camera angle, windows, and other furniture unchanged. Do not add new furniture unless explicitly requested.`;
    const combinedOperations: Operation[] = [
      ...activePlan.operations,
      ...refineInstructions.map(operationFromRefineInstruction),
    ];
    setStep("refine");
    setSavedMessage("");
    setImages((current) => current.map((view, viewIndex) => viewIndex === activeIndex ? { ...view, status: "loading" } : view));
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [activeView.image],
          originalImages: images.map((view) => view.image),
          text: editedPrompt,
          existingPlan: activePlan,
          operations: combinedOperations,
          index: activeIndex,
          isRefine: true,
        }),
      });
      const data = (await response.json()) as BatchResponse;
      if (!response.ok) throw new Error(data.error ?? "Edit regeneration failed");
      const viewResult = data.results[0];
      if (!viewResult?.proposalUrl) throw new Error(viewResult?.error ?? "Refinement returned no proposal.");
      setImages((current) => current.map((view, viewIndex) => viewIndex === activeIndex ? {
        ...view,
        status: "success",
        plan: data.plan,
        result: { ...viewResult, index: activeIndex },
      } : view));
      setRefineInstructionsByView((current) => ({ ...current, [activeView.id]: [] }));
      setEditingPlan(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not regenerate this edit. Your operation changes are preserved.";
      setSavedMessage(message);
      setImages((current) => current.map((view, viewIndex) => viewIndex === activeIndex ? ({
        ...view,
        status: "error",
        result: { index: activeIndex, proposalUrl: null, samResults: view.result?.samResults ?? null, error: message },
      }) : view));
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
    if (!activeView || !activePlan || !activeResult?.proposalUrl || activeView.status !== "success") return;
    try {
      saveEdit({
        originalUrl: activeView.image,
        proposalUrl: activeResult.proposalUrl,
        plan: activePlan,
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

          {images.length > 0 && (
            <Tabs value={String(activeIndex)} onValueChange={(value) => { setActiveIndex(Number(value)); setRefineInput(""); }} className="mt-4">
              <TabsList aria-label="Room views" className="flex w-full flex-wrap">
                {images.map((view, index) => (
                  <TabsTrigger key={view.id} value={String(index)} aria-label={`${view.label}, ${view.status}`} className={cn("relative w-20 overflow-hidden", view.status === "error" && "border-red-500 data-[state=active]:border-red-500") }>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={view.image} alt="" className="aspect-[4/3] w-full rounded object-cover" />
                    <span className="block truncate px-1 text-[10px]">{view.label || `View ${index + 1}`}</span>
                    <span className="sr-only">{view.status === "error" ? "Generation failed" : view.status === "loading" ? "Generating" : ""}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Dropzone / preview — scales up while dragging */}
          <motion.div
            key={activeView?.id ?? "empty"}
            initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
          >
            <Dropzone
              images={images.map((view) => view.image)}
              activeImage={activeView?.image ?? null}
              samResults={activeResult?.samResults ?? null}
              dragging={dragging}
              fileInputRef={fileRef}
              onFiles={onFiles}
              onDraggingChange={setDragging}
              onShowSamples={showSamples}
              onClear={() => { setImages([]); setActiveIndex(0); setPhase("idle"); setPlan(null); setGenerationError(""); setUploadError(""); }}
            />
          </motion.div>
          {uploadError && <p className="mt-2 text-center text-xs font-semibold text-red-600" role="alert">{uploadError}</p>}

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
              disabled={!images.length || phase === "loading"}
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

          {phase === "result" && generationError && !plan && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">
              <span>{generationError}</span>
              <Button variant="outline" size="sm" onClick={runMagic}>Retry all views</Button>
            </div>
          )}

          {/* Live result: banner + Spark checklist + real before/after */}
          {phase === "result" && activeView && activePlan && (
            <motion.div key={`result-${activeView.id}`} initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.3 }} className="mt-6 space-y-4">
              {(generationError || activeView.status === "error") && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  <span>{activeResult?.error ?? generationError ?? "Generation failed for this view."}</span>
                  {activeView.status === "error" && <Button variant="outline" size="sm" onClick={() => retryView(activeIndex)}>Retry view</Button>}
                </div>
              )}
              <div id="plan-checklist">
                <p className="text-sm font-bold text-primary dark:text-white">
                  Plan — {activePlan.goal}
                </p>
                {activeResult && (
                  <p className="mt-1 font-serif text-[15px] leading-[1.6] text-slate-600 dark:text-slate-300">
                    {activeResult.appliedOperations?.length ?? 0} {activeResult.appliedOperations?.length === 1 ? "operation" : "operations"} will be applied to this view
                    {(activeResult.skippedOperations?.length ?? 0) > 0 && ` (${activeResult.skippedOperations!.length} skipped - object not in this view)`}.
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{activeResult?.samResults?.connected ? `SAM connected · ${activeResult.samResults.objects.length} objects detected` : `Objects identified in this view: ${activeResult?.samResults?.objects.length ?? 0}`}</p>
                  <Button variant="ghost" size="sm" disabled={step !== null} onClick={() => editingPlan ? regenerateEditedPlan() : setEditingPlan(true)}>{step === "refine" ? "Refining proposal..." : step === "image" ? "Re-generating..." : editingPlan ? "Done editing" : "Edit plan"}</Button>
                </div>
                {activePlan.constraints.length > 0 && (
                    <p className="mt-0.5 font-serif text-[15px] italic leading-[1.6] text-slate-500 dark:text-slate-400">
                    {activePlan.constraints.join(" · ")}
                  </p>
                )}
                <ul className="mt-2 space-y-1.5">
                  {activePlan.operations.map((op, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 font-serif text-[15px] leading-[1.6] dark:bg-night"
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
                            { ["keep", "remove", "recolor", "reposition", "swap"].map((action) => <option key={action} value={action}>{action}</option>)}
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
                  {editingPlan && (
                    <section className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10" aria-labelledby="refine-heading">
                      <h3 id="refine-heading" className="text-sm font-bold text-primary dark:text-white">Refine with new instruction</h3>
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={refineInput}
                          onChange={(event) => setRefineInput(event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRefineInstruction(); } }}
                          placeholder="Add new change, e.g., remove the extra sofa that was added, or paint ceiling white"
                          aria-label="New refinement instruction"
                        />
                        <Button type="button" variant="outline" onClick={addRefineInstruction} disabled={!refineInput.trim()}>Add</Button>
                      </div>
                      {refineInstructions.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Refine instructions">
                          {refineInstructions.map((instruction, index) => (
                            <li key={`${instruction}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-full bg-link/10 px-3 py-1 text-xs text-primary dark:text-white">
                              <span className="max-w-[min(70vw,32rem)] truncate">{instruction}</span>
                              <button type="button" aria-label={`Remove instruction: ${instruction}`} onClick={() => activeView && setRefineInstructionsByView((current) => ({
                                ...current,
                                [activeView.id]: (current[activeView.id] ?? []).filter((_, itemIndex) => itemIndex !== index),
                              }))} className="font-bold text-red-600">×</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}
                {activeResult?.samResults?.objects.length ? <ul className="mt-2 flex flex-wrap gap-2" aria-label="Detected objects in active view">
                  {activeResult.samResults.objects.map((object, index) => <li key={`${object.label}-${index}`} className="rounded-full bg-surface px-2.5 py-1 text-xs text-primary dark:bg-night">{object.label}</li>)}
                </ul> : null}
              </div>
              {activeResult?.proposalUrl && <BeforeAfterSlider before={activeView.image} after={proposalSrc} afterLabel="Generated proposal" />}
              <div className="flex flex-col items-center gap-2">
                <Button variant="default" size="pill" onClick={persistEdit} disabled={activeView.status !== "success" || !activeResult?.proposalUrl} className="magic-glow w-56 bg-primary text-white">
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
              {images.length ? (
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
              onClick={() => pickSample(s)}
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
