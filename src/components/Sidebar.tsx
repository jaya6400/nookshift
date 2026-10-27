"use client";

import { Images, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileBadge } from "@/components/ProfileBadge";
import { SAMPLES } from "@/lib/samples";
import { cn } from "@/lib/utils";

type SidebarProps = {
  name: string;
  initial: string;
  collapsed: boolean;
  canEditPlan: boolean;
  highlightSamples: boolean;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  onSaveName: () => void;
  onLogout: () => void;
  onToggleCollapsed: () => void;
  onEditPlan: () => void;
  onPickSample: (src: string) => void;
  onShowSamples: () => void;
};

export function Sidebar({
  name,
  initial,
  collapsed,
  canEditPlan,
  highlightSamples,
  draftName,
  onDraftNameChange,
  onSaveName,
  onLogout,
  onToggleCollapsed,
  onEditPlan,
  onPickSample,
  onShowSamples,
}: SidebarProps) {
  return (
    <aside className={cn(
      "relative hidden min-h-[720px] flex-col rounded-2xl border border-slate-100 bg-white p-4 pb-24 shadow-key transition-all duration-200 dark:border-white/5 dark:bg-night2 md:flex",
      collapsed ? "w-16 items-center" : "w-[20%] min-w-52"
    )}>
      <div className="flex items-center justify-between gap-2">
        {!collapsed && <div>
          <h2 className="text-base font-bold text-primary dark:text-white">Your Space</h2>
          <p className="text-xs text-slate-500 dark:text-slate-300">Hello, {name}</p>
        </div>}
        <button onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="rounded-lg p-1.5 text-primary hover:bg-surface dark:text-slate-200 dark:hover:bg-night">
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed && <div className="mt-5 flex flex-1 flex-col gap-3">
        <Button variant="outline" onClick={onShowSamples}><Images className="size-4" />Get Sample Images</Button>
        <Button variant="ghost" onClick={onEditPlan} disabled={!canEditPlan}><PencilRuler className="size-4" />Edit Space</Button>
        <section
          id="sample-spaces"
          className={cn("mt-2 rounded-xl border border-transparent p-2 transition-colors duration-300", highlightSamples && "border-2 border-link bg-surface")}
        >
          <h3 className="mb-2 text-xs font-bold text-primary dark:text-white">Sample Spaces</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {SAMPLES.map((sample) => (
              <button key={sample.id} onClick={() => onPickSample(sample.src)} title={sample.label} className="aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sample.src} alt={sample.label} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      </div>}

      <ProfileBadge
        name={name}
        initial={initial}
        collapsed={collapsed}
        draftName={draftName}
        onDraftNameChange={onDraftNameChange}
        onSave={onSaveName}
        onLogout={onLogout}
      />
    </aside>
  );
}