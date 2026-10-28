"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ProfileEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  onSave: () => void;
  onLogout: () => void;
};

export function ProfileEditModal({
  open,
  onOpenChange,
  draftName,
  onDraftNameChange,
  onSave,
  onLogout,
}: ProfileEditModalProps) {
  if (!open) return null;

  return createPortal(
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-sm">
      <DialogTitle>Profile</DialogTitle>
      <DialogDescription>Your name is stored only in this browser.</DialogDescription>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label htmlFor="profile-edit-name" className="block text-sm font-bold text-primary dark:text-white">
          Profile name
        </label>
        <Input
          id="profile-edit-name"
          autoFocus
          required
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          placeholder="Enter your name"
        />
        <Button type="submit" className="w-full">Save</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onLogout}>
          Clear local profile
        </Button>
      </form>
    </Dialog>,
    document.body
  );
}