"use client";

import { motion } from "framer-motion";
import { CloudUpload } from "lucide-react";
import type { SamResults } from "@/lib/meta";
import { cn } from "@/lib/utils";

type DropzoneProps = {
  image: string | null;
  samResults: SamResults | null;
  dragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFile: (file: File | undefined) => void;
  onDraggingChange: (dragging: boolean) => void;
  onShowSamples: () => void;
  onReplace: () => void;
};

export function Dropzone({ image, samResults, dragging, fileInputRef, onFile, onDraggingChange, onShowSamples, onReplace }: DropzoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className={cn("card-surface mt-4 flex min-h-64 items-center justify-center rounded-2xl p-4 transition-transform duration-200", dragging && "scale-[1.02]")}
      onDragOver={(event) => { event.preventDefault(); onDraggingChange(true); }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(event) => { event.preventDefault(); onDraggingChange(false); onFile(event.dataTransfer.files?.[0]); }}
    >
      {image ? (
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ duration: 0.35 }} className="relative w-full max-w-lg overflow-hidden rounded-xl shadow-key">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Your space" className="block w-full" />
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
          <button onClick={onReplace} className="absolute right-2 top-2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">Replace</button>
        </motion.div>
      ) : (
        <div className="flex w-full max-w-lg flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-link/50 bg-surface2/30 px-6 py-10 text-center dark:bg-white/5">
          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2">
            <CloudUpload className="size-8 text-link" />
            <span className="text-sm font-bold text-primary dark:text-white">Drop your space image or video</span>
          </button>
          <button onClick={onShowSamples} className="text-sm text-link hover:underline">Not have? Get one from Samples -&gt;</button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />
    </motion.div>
  );
}