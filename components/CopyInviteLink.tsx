"use client";

import { useState } from "react";

// Shows a tappable "copy link" affordance instead of raw text — nobody
// wants to select-and-copy a URL by hand on mobile. Stops propagation so it
// works safely inside a card that's itself a <Link>.
export function CopyInviteLink({ code, className = "" }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be unavailable (older Safari, non-HTTPS) — fall
      // back to the classic hidden-textarea + execCommand trick.
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-chalk-dim transition-colors hover:border-chalk-dim hover:text-chalk ${className}`}
    >
      {copied ? "Copied ✓" : "📋 Copy invite link"}
    </button>
  );
}
