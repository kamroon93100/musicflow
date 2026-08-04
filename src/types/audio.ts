/**
 * Audio engine domain types — pure types, no runtime logic.
 */

/** Playback state machine (see src/lib/audio/engine.ts for transitions). */
export enum AudioState {
  IDLE = "idle",
  LOADING = "loading",
  PLAYING = "playing",
  PAUSED = "paused",
  ENDED = "ended",
  ERROR = "error",
}

/**
 * Payload-bearing event map emitted by the AudioEngine. The `on()`/`emit()`
 * methods are keyed by these names so event payloads stay type-safe.
 */
export interface AudioEventMap {
  play: (event: { type: "play" }) => void;
  pause: (event: { type: "pause" }) => void;
  end: (event: { type: "end" }) => void;
  error: (event: { type: "error"; error: Error }) => void;
  progress: (event: {
    type: "progress";
    position: number;
    duration: number;
  }) => void;
}

/** One emitted audio event, discriminated by `type`. */
export type AudioEvent = {
  [K in keyof AudioEventMap]: AudioEventMap[K] extends (e: infer E) => void
    ? E
    : never;
}[keyof AudioEventMap];

/** A loadable audio source (a Piped stream proxy URL in Slice 2.2). */
export interface StreamSource {
  /** Direct audio URL. */
  url: string;
  /** Optional format hint for howler (e.g. "mp3", "m4a"). */
  format?: string;
}

/** Immutable snapshot returned by AudioEngine.getState(). */
export interface AudioEngineState {
  state: AudioState;
  /** Current playback position in seconds. */
  position: number;
  /** Total duration in seconds, or 0 when unknown (live streams). */
  duration: number;
  /** Current volume, 0..1. */
  volume: number;
  /** URL of the current (or last) source, or null when idle. */
  streamUrl: string | null;
}