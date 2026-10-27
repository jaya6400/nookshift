"use client";

import { useEffect, useState } from "react";
import { Clock3, Images } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { readSavedEdits, type SavedEdit } from "@/lib/saved-edits";

export function SavedEdits() {
  const [edits, setEdits] = useState<SavedEdit[]>([]);
  const [selected, setSelected] = useState<SavedEdit | null>(null);

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

  return (
    <motion.section
      id="saved-edits"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto mt-8 mb-16 max-w-7xl px-4 sm:px-6"
    >
      <h2 className="mb-4 text-2xl font-bold text-primary dark:text-white">Saved edits</h2>
      {edits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-link/40 bg-[#EFF6FF] px-6 py-12 text-center dark:bg-night2">
          <Images className="size-8 text-link" />
          <p className="font-bold text-primary dark:text-white">Your saved edits will be shown here.</p>
          <p className="text-sm text-slate-500 dark:text-slate-300">Edit a space in Studio and save to see it here.</p>
        </div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {edits.map((edit, index) => (
            <motion.button
              key={`${edit.timestamp}-${index}`}
              type="button"
              onClick={() => setSelected(edit)}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden rounded-xl border border-surface2 bg-white text-left shadow-key transition hover:-translate-y-0.5 hover:shadow-key-lg dark:border-white/10 dark:bg-night2"
            >
              <div className="grid aspect-[16/7] grid-cols-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={edit.originalUrl} alt="Original room" className="h-full w-full object-cover" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={edit.proposalUrl} alt="Saved proposal" className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <p className="line-clamp-2 font-bold text-primary dark:text-white">{edit.plan.goal}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock3 className="size-3.5" />{new Date(edit.timestamp).toLocaleString()}
                </p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        {selected && <>
          <DialogTitle>{selected.plan.goal}</DialogTitle>
          <DialogDescription>{new Date(selected.timestamp).toLocaleString()}</DialogDescription>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.originalUrl} alt="Original room" className="w-full rounded-lg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.proposalUrl} alt="Saved proposal" className="w-full rounded-lg" />
          </div>
          <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {selected.plan.operations.map((operation, index) => <li key={`${operation.target}-${index}`}>{operation.action}: {operation.target}{operation.value ? ` — ${operation.value}` : ""}</li>)}
          </ul>
        </>}
      </Dialog>
    </motion.section>
  );
}