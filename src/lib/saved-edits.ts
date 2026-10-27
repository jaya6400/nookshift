import type { Plan } from "@/lib/meta";

export const SAVED_EDITS_KEY = "nookshift_saved_edits";

export type SavedEdit = {
  originalUrl: string;
  proposalUrl: string;
  plan: Plan;
  timestamp: string;
};

export function readSavedEdits(): SavedEdit[] {
  try {
    const stored = localStorage.getItem(SAVED_EDITS_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as SavedEdit[] : [];
  } catch {
    return [];
  }
}

export function saveEdit(edit: SavedEdit): void {
  const saved = readSavedEdits();
  localStorage.setItem(SAVED_EDITS_KEY, JSON.stringify([edit, ...saved]));
}