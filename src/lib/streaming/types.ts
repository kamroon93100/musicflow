/**
 * Structured stream error codes + payload — shared between the client-facing
 * /api/stream route (server) and the player store / UI (client). The server
 * classifies a failed stream fetch into one of these codes; the client maps
 * codes to user-friendly messages (see error-messages.ts). A code is stronger
 * signal than the raw error string, so the UI can tailor its message per case.
 */

/** The complete set of stream failure classes. */
export const STREAM_ERROR_CODES = [
  "STREAM_NO_PROVIDERS",
  "STREAM_TIMEOUT",
  "STREAM_GEOBLOCKED",
  "STREAM_INVALID_ID",
  "STREAM_UNKNOWN",
] as const;

export type StreamErrorCode = (typeof STREAM_ERROR_CODES)[number];

/** Narrow a runtime value (e.g. a JSON body field) to a valid code. */
export function isStreamErrorCode(value: unknown): value is StreamErrorCode {
  return (
    typeof value === "string" &&
    (STREAM_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** Store-side error snapshot: code keys friendly copy; message is the raw detail. */
export interface StreamErrorInfo {
  code: StreamErrorCode;
  message: string;
}

/** Failure body returned by /api/stream on every error path (400/502/500). */
export interface StreamErrorPayload {
  success: false;
  error: string;
  code: StreamErrorCode;
}