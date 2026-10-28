"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type HelpModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  async function submitHelp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSubmitting(true);
    setToast("");

    try {
      const response = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          message: formData.get("message"),
        }),
      });
      if (!response.ok) throw new Error("Help request failed");
      form.reset();
      setToast("Thanks, your message has been sent.");
      window.setTimeout(() => {
        setToast("");
        onOpenChange(false);
      }, 1800);
    } catch {
      setToast("We couldn't send your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return createPortal(
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTitle>How can we help?</DialogTitle>
        <DialogDescription>Send a message and we’ll get back to you.</DialogDescription>
        <form className="mt-5 space-y-4" onSubmit={submitHelp}>
          <div>
            <label htmlFor="help-name" className="mb-1.5 block text-sm font-bold text-primary dark:text-white">Name</label>
            <Input id="help-name" name="name" autoComplete="name" required />
          </div>
          <div>
            <label htmlFor="help-email" className="mb-1.5 block text-sm font-bold text-primary dark:text-white">Email</label>
            <Input id="help-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label htmlFor="help-message" className="mb-1.5 block text-sm font-bold text-primary dark:text-white">Message</label>
            <textarea
              id="help-message"
              name="message"
              required
              rows={4}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-night dark:text-slate-100"
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending..." : "Send message"}
          </Button>
          {toast && <p role="status" className="text-center text-sm text-slate-600 dark:text-slate-300">{toast}</p>}
        </form>
      </Dialog>
    , document.body
  );
}