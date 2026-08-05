import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Seconds → m:ss (e.g. 274 → "4:34"). Invalid/negative → "0:00". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Seconds → compact human duration for the playlist header meta row.
 *   < 60min → "45 min";  >= 60min → "1 hr 23 min";  0 → "0 min".
 * Caller passes the summed duration of all tracks (null durations skipped).
 */
export function formatTotalDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h} hr ${m} min`;
}
