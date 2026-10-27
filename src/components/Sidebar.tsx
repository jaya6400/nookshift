"use client";

import { Images, PencilRuler } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ProfileBadge } from "@/components/ProfileBadge";
import { cn } from "@/lib/utils";

type SidebarProps = {
  name: string;
  initial: string;
  collapsed: boolean;
  canEditPlan: boolean;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  onSaveName: () => void;
  onLogout: () => void;
  onToggleCollapsed: () => void;
  onEditPlan: () => void;
  onShowSamples: () => void;
};

export function Sidebar({
  name,
  initial,
  collapsed,
  canEditPlan,
  draftName,
  onDraftNameChange,
  onSaveName,
  onLogout,
  onToggleCollapsed,
  onEditPlan,
  onShowSamples,
}: SidebarProps) {
  return (
    <motion.aside variants={{ hidden: { opacity: 0, x: -14 }, visible: { opacity: 1, x: 0 } }} transition={{ duration: 0.4 }} className={cn(
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
        <Button id="get-samples-btn" variant="outline" onClick={onShowSamples}><Images className="size-4" />Get Samples</Button>
        <Button variant="ghost" onClick={onEditPlan} disabled={!canEditPlan}><PencilRuler className="size-4" />Edit Space</Button>
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
    </motion.aside>
  );
}