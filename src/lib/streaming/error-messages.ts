/**
 * Stream error code → user-friendly copy, and a resolver used by both player
 * bars. Copy is action-oriented: each message tells the user the next step.
 * The resolver falls back to the raw message only when a code isn't recognized
 * (defensive — the store always carries a valid code from src/lib/streaming/types).
 */
import type { StreamErrorCode, StreamErrorInfo } from "@/lib/streaming/types";

export const STREAM_ERROR_MESSAGES: Record<StreamErrorCode, string> = {
  STREAM_NO_PROVIDERS: "Sources are down. Try another track.",
  STREAM_TIMEOUT: "Stream timed out. Try another track.",
  STREAM_GEOBLOCKED: "This track isn't available in your region.",
  STREAM_INVALID_ID: "This track can't be played.",
  STREAM_UNKNOWN: "Something went wrong. Try again.",
};

/** Display string for a stream error; null when there's no error. */
export function streamErrorMessage(err: StreamErrorInfo | null): string | null {
  if (!err) return null;
  return STREAM_ERROR_MESSAGES[err.code] ?? err.message;
}