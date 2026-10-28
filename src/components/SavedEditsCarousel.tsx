"use client";

import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Clock3, Images } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { readSavedEdits, type SavedEdit } from "@/lib/saved-edits";

export function SavedEditsCarousel() {
  const [edits, setEdits] = useState<SavedEdit[]>([]);
  const [selected, setSelected] = useState<SavedEdit | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "center", loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setEdits(readSavedEdits());
    const sync = () => setEdits(readSavedEdits());
    window.addEventListener("storage", sync);
    window.addEventListener("nookshift:saved-edits", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("nookshift:saved-edits", sync);
    };
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const updateIndex = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", updateIndex);
    updateIndex();
    return () => { emblaApi.off("select", updateIndex); };
  }, [emblaApi]);

  return (
    <motion.section
      id="saved-edits"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto mb-16 mt-8 max-w-7xl px-4 sm:px-6"
    >
      <h2 className="mb-4 text-2xl font-bold text-primary dark:text-white">Saved edits</h2>
      {edits.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 bg-[#EFF6FF] px-6 py-12 text-center dark:bg-night2">
          <Images className="size-8 text-link" />
          <p className="font-bold text-primary dark:text-white">Your saved edits will be shown here.</p>
          <p className="text-sm text-slate-500 dark:text-slate-300">Edit a space in Studio and save to see it here.</p>
        </div>
      ) : (
        <div className="relative px-10">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex touch-pan-y">
              {edits.map((edit, index) => (
                <div key={`${edit.timestamp}-${index}`} className="min-w-0 flex-[0_0_100%] px-2 sm:flex-[0_0_70%] lg:flex-[0_0_50%]">
                  <button
                    type="button"
                    onClick={() => setSelected(edit)}
                    className="block w-full overflow-hidden rounded-xl border border-[#DBEAFE] bg-white text-left shadow-key transition hover:shadow-key-lg dark:border-white/10 dark:bg-night2"
                  >
                    <div className="grid aspect-[16/7] grid-cols-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={edit.originalUrl} alt="Before edit" className="h-full w-full object-cover" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={edit.proposalUrl} alt="After edit" className="h-full w-full object-cover" />
                    </div>
                    <div className="p-4">
                      <p className="line-clamp-2 font-bold text-primary dark:text-white">{edit.plan.goal}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Clock3 className="size-3.5" />{new Date(edit.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button type="button" aria-label="Previous saved edit" onClick={() => emblaApi?.scrollPrev()} disabled={selectedIndex === 0} className="absolute left-0 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#DBEAFE] bg-white text-primary shadow-key disabled:opacity-40 dark:border-white/10 dark:bg-night2 dark:text-white">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label="Next saved edit" onClick={() => emblaApi?.scrollNext()} disabled={selectedIndex >= edits.length - 1} className="absolute right-0 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#DBEAFE] bg-white text-primary shadow-key disabled:opacity-40 dark:border-white/10 dark:bg-night2 dark:text-white">
            <ChevronRight className="size-5" />
          </button>
          <div className="mt-4 flex justify-center gap-2" aria-label="Saved edit slides">
            {edits.map((edit, index) => (
              <button
                key={`${edit.timestamp}-dot-${index}`}
                type="button"
                aria-label={`Go to saved edit ${index + 1}`}
                aria-current={index === selectedIndex}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`size-2.5 rounded-full transition-colors ${index === selectedIndex ? "bg-[#F1FF5E] ring-1 ring-primary" : "bg-slate-300 dark:bg-slate-600"}`}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        {selected && <>
          <DialogTitle>{selected.plan.goal}</DialogTitle>
          <DialogDescription>{new Date(selected.timestamp).toLocaleString()}</DialogDescription>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.originalUrl} alt="Before edit" className="w-full rounded-lg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.proposalUrl} alt="After edit" className="w-full rounded-lg" />
          </div>
          <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {selected.plan.operations.map((operation, index) => <li key={`${operation.target}-${index}`}>{operation.action}: {operation.target}{operation.value ? ` — ${operation.value}` : ""}</li>)}
          </ul>
        </>}
      </Dialog>
    </motion.section>
  );
}