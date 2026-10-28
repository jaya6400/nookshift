"use client";

import { useState } from "react";
import { Dialog, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function NameModal({
  open,
  onSaved,
}: {
  open: boolean;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name to enter the workspace.");
      return;
    }
    try {
      localStorage.setItem("nookshift_user", trimmed);
    } catch {}
    onSaved(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} className="max-w-sm">
      <DialogTitle>Welcome to NookShift</DialogTitle>
      <DialogDescription>
        No sign-in needed. Tell us your name so we can greet you in the workspace.
      </DialogDescription>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor="nookshift-name" className="text-sm font-bold text-primary dark:text-white">
          Enter your name
        </label>
        <Input
          id="nookshift-name"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="e.g. Clara"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button type="submit" className="w-full">
          Save &amp; Enter Workspace
        </Button>
      </form>
    </Dialog>
  );
}
