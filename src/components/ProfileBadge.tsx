"use client";

import { useState } from "react";
import { ChevronUp, CircleHelp, SlidersHorizontal, UserRound } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ProfileBadgeProps = {
  name: string;
  initial: string;
  collapsed: boolean;
  onEditProfile: () => void;
  onShowHelp: () => void;
};

export function ProfileBadge({
  name,
  initial,
  collapsed,
  onEditProfile,
  onShowHelp,
}: ProfileBadgeProps) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="absolute bottom-4 left-4 right-4">
      <CollapsibleContent className="absolute bottom-full left-0 mb-3 w-full min-w-48 rounded-xl border border-slate-100 bg-white p-3 shadow-key-lg dark:border-white/10 dark:bg-night">
        <button
          type="button"
          onClick={() => setSettingsOpen((value) => !value)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-bold text-primary hover:bg-surface dark:text-white dark:hover:bg-night2"
        >
          <SlidersHorizontal className="size-4" />
          Settings
        </button>
        {settingsOpen && (
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setOpen(false);
                onEditProfile();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-primary hover:bg-surface dark:text-white dark:hover:bg-night2"
            >
              <UserRound className="size-4" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setOpen(false);
                onShowHelp();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-primary hover:bg-surface dark:text-white dark:hover:bg-night2"
            >
              <CircleHelp className="size-4" />
              Help
            </button>
          </div>
        )}
      </CollapsibleContent>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-label="Open profile and settings"
          className="flex w-full items-center gap-2.5 rounded-xl text-left"
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-key">
            {initial}
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-white dark:ring-night2" />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold leading-tight text-primary dark:text-white">{name}</span>
              <span className="block text-[11px] text-slate-400 dark:text-slate-500">Workspace architect</span>
            </span>
          )}
          {!collapsed && <ChevronUp className="size-4 text-slate-400" />}
          <span className="sr-only"><UserRound /></span>
        </button>
      </CollapsibleTrigger>
    </Collapsible>
  );
}