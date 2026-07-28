"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to clipboard",
  className,
}: {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage, {
        description: `${label}: ${value}`,
      });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy", {
        description: "Your browser blocked clipboard access.",
      });
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "grid size-9 place-items-center rounded-xl border border-white/10 bg-white/8 text-cyan-200 hover:-translate-y-0.5 hover:bg-white/14 hover:text-white",
        className,
      )}
      aria-label={`${label} ${value}`}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
