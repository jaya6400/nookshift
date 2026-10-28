"use client";

import { motion } from "framer-motion";
import { CloudUpload, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SamResults } from "@/lib/meta";
import { cn } from "@/lib/utils";

type DropzoneProps = {
  images: string[];
  activeImage: string | null;
  samResults: SamResults | null;
  dragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFiles: (files: File[]) => void;
  onDraggingChange: (dragging: boolean) => void;
  onShowSamples: () => void;
  onClear: () => void;
};

export function Dropzone({ images, activeImage, samResults, dragging, fileInputRef, onFiles, onDraggingChange, onShowSamples, onClear }: DropzoneProps) {
  const [fileError, setFileError] = useState("");

  const acceptFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    const valid = files.filter((file) => file.type.startsWith("image/"));
    const invalidCount = files.length - valid.length;
    const available = Math.max(0, 3 - images.length);
    const accepted = valid.slice(0, available);
    const rejectedCount = valid.length - accepted.length;
    const messages = [];
    if (invalidCount) messages.push(`${invalidCount} file${invalidCount === 1 ? " was" : "s were"} not an image.`);
    if (rejectedCount) messages.push(`Only 3 images are allowed; ${rejectedCount} file${rejectedCount === 1 ? " was" : "s were"} not added.`);
    setFileError(messages.join(" "));
    if (accepted.length) onFiles(accepted);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className={cn("card-surface mt-4 flex min-h-64 items-center justify-center rounded-2xl p-4 transition-transform duration-200", dragging && "scale-[1.02]")}
      onDragOver={(event) => { event.preventDefault(); onDraggingChange(true); }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(event) => { event.preventDefault(); onDraggingChange(false); acceptFiles(event.dataTransfer.files); }}
    >
      {activeImage ? (
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ duration: 0.35 }} className="relative w-full max-w-lg overflow-hidden rounded-xl shadow-key">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeImage} alt="Your space, active view" className="block w-full" />
          {samResults?.boxes.map((box, index) => (
            <span
              key={`${box.label}-${index}`}
              className="absolute flex max-w-[45%] items-start gap-1 text-[10px] font-bold text-white"
              style={{ left: `${(box.x / 1024) * 100}%`, top: `${(box.y / 768) * 100}%` }}
            >
              <span className="mt-0.5 size-2 shrink-0 rounded-full bg-link ring-2 ring-white" />
              <span className="rounded bg-primary/85 px-1.5 py-0.5">{box.label}</span>
            </span>
          ))}
          <div className="absolute right-2 top-2 flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white">Add views</button>
            <button type="button" onClick={onClear} aria-label="Clear uploaded images" className="rounded-full bg-black/65 p-1.5 text-white"><Trash2 className="size-4" /></button>
          </div>
          <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-xs font-semibold text-white">{images.length}/3 views</span>
        </motion.div>
      ) : (
        <div className="flex w-full max-w-lg flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-link/50 bg-surface2/30 px-6 py-10 text-center dark:bg-white/5">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2">
            <CloudUpload className="size-8 text-link" />
            <span className="text-sm font-bold text-primary dark:text-white">Drop up to 3 room images</span>
          </button>
          <button onClick={onShowSamples} className="text-sm text-link hover:underline">Not have? Get one from Samples -&gt;</button>
        </div>
      )}
      {fileError && <p className="absolute bottom-2 left-2 right-2 text-center text-xs font-semibold text-red-600" role="alert">{fileError}</p>}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { if (event.target.files) acceptFiles(event.target.files); event.target.value = ""; }} />
    </motion.div>
  );
}