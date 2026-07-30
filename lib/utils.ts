import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatXLM(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(num);
}

/**
 * Copies `text` to the system clipboard.
 *
 * Strategy (most-to-least capable):
 *  1. `navigator.clipboard.writeText` — requires a secure context (HTTPS /
 *     localhost). Available in all modern browsers on secure origins.
 *  2. `document.execCommand("copy")` via a temporary textarea — legacy
 *     fallback that works on plain HTTP and inside many in-app WebViews
 *     (Freighter, Lobstr, Telegram, etc.) where the Clipboard API is absent.
 *
 * @returns `true` when the text was copied, `false` when both strategies fail.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // ── Modern Clipboard API ───────────────────────────────────────────────────
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy approach (e.g. permission denied).
    }
  }

  // ── Legacy execCommand fallback ────────────────────────────────────────────
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Keep the textarea off-screen so it doesn't affect layout or scroll.
    textarea.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
