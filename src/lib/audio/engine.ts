/**
 * Howler.js audio engine — imperative playback controller.
 *
 * CLIENT-ONLY: imports `howler` (a browser library). Import this module only
 * from "use client" components or other client modules — never from a server
 * component. No UI lives here; Slice 2.5 wires this into the player store.
 *
 * State machine (see src/types/audio.ts):
 *   IDLE → LOADING → PLAYING ⇄ PAUSED, PLAYING → ENDED, any → ERROR (terminal;
 *   recover with play(), which resets to LOADING). stop() → IDLE + release.
 *
 * Rendering: HTML5 audio (html5: true, preload: false) — streams without
 * waiting for full download. Web Audio is deferred to Slice 5.3's visualizer.
 * See KNOWN_ISSUE.md [2.1].
 */
import { Howl, type HowlOptions } from "howler";
import {
  AudioState,
  type AudioEngineState,
  type AudioEventMap,
  type StreamSource,
} from "@/types/audio";

const VOLUME_FADE_MS = 120;

export class AudioEngine {
  private howl: Howl | null = null;
  private soundId: number | null = null;
  private state: AudioState = AudioState.IDLE;
  private volume = 1;
  private streamUrl: string | null = null;
  private retried = false;
  private rafId: number | null = null;

  private listeners: { [K in keyof AudioEventMap]: Set<AudioEventMap[K]> } = {
    play: new Set(),
    pause: new Set(),
    end: new Set(),
    error: new Set(),
    progress: new Set(),
  };

  /* ---- Event emitter (typed, dependency-free) ---- */

  /** Subscribe to an event; returns an unsubscribe function. */
  on<K extends keyof AudioEventMap>(
    type: K,
    callback: AudioEventMap[K],
  ): () => void {
    this.listeners[type].add(callback);
    return () => this.off(type, callback);
  }

  off<K extends keyof AudioEventMap>(type: K, callback: AudioEventMap[K]) {
    this.listeners[type].delete(callback);
  }

  private emit<K extends keyof AudioEventMap>(
    type: K,
    event: Parameters<AudioEventMap[K]>[0],
  ) {
    // Inside the method body TS can't pin `K` to one key, so it widens
    // AudioEventMap[K] to a union whose parameter intersection is `never`.
    // Cast the whole listener set instead so the callback param and the event
    // arg share the same payload type. Safe: we only ever emit the matching
    // event per key.
    const list = this.listeners[type] as unknown as Set<
      (event: Parameters<AudioEventMap[K]>[0]) => void
    >;
    list.forEach((cb) => cb(event));
  }

  /* ---- Public controls ---- */

  /** Load and start a stream. Replaces whatever was playing. */
  play(source: StreamSource): void {
    this.teardownHowl();

    this.streamUrl = source.url;
    this.retried = false;
    this.state = AudioState.LOADING;

    this.howl = this.buildHowl(source);
    this.soundId = this.howl.play(); // preload:false → load + stream on play
    this.startProgressLoop();
  }

  /** Pause the current sound (resumable). */
  pause(): void {
    if (!this.howl || this.state !== AudioState.PLAYING) return;
    this.howl.pause(); // fires onpause → PAUSED
    this.stopProgressLoop();
  }

  /** Resume a paused sound. */
  resume(): void {
    if (!this.howl || this.state !== AudioState.PAUSED) return;
    this.howl.play(); // fires onplay → PLAYING
    this.startProgressLoop();
  }

  /** Full stop — releases the stream and returns to IDLE. */
  stop(): void {
    this.teardownHowl();
    this.stopProgressLoop();
    this.state = AudioState.IDLE;
  }

  /** Seek to `seconds`, clamped to the stream duration. */
  seek(seconds: number): void {
    if (!this.howl || this.soundId === null) return;
    const max = this.duration();
    const clamped =
      max > 0 ? Math.min(Math.max(seconds, 0), max) : Math.max(seconds, 0);
    this.howl.seek(clamped, this.soundId);
  }

  /** Set volume 0..1. Smooth fade when a sound is live, else persisted. */
  setVolume(value: number): void {
    this.volume = Math.min(Math.max(value, 0), 1);
    if (this.howl && this.state !== AudioState.IDLE && this.state !== AudioState.ERROR) {
      this.howl.fade(this.howl.volume(), this.volume, VOLUME_FADE_MS);
    }
  }

  /** Current playback position in seconds (0 when idle). */
  position(): number {
    if (!this.howl || this.soundId === null) return 0;
    const p = this.howl.seek(this.soundId);
    return Number.isFinite(p) ? p : 0;
  }

  /** Stream duration in seconds, or 0 when unknown (live streams). */
  duration(): number {
    if (!this.howl) return 0;
    const d = this.howl.duration();
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  getState(): AudioEngineState {
    return {
      state: this.state,
      position: this.position(),
      duration: this.duration(),
      volume: this.volume,
      streamUrl: this.streamUrl,
    };
  }

  /** Full teardown for HMR/unmount — cancels rAF, unloads, clears listeners. */
  destroy(): void {
    this.stopProgressLoop();
    this.teardownHowl();
    for (const key of Object.keys(this.listeners) as (keyof AudioEventMap)[]) {
      this.listeners[key].clear();
    }
    this.streamUrl = null;
    this.state = AudioState.IDLE;
    this.retried = false;
  }

  /* ---- Internals ---- */

  private buildHowl({ url, format }: StreamSource): Howl {
    const options: HowlOptions = {
      src: [url],
      html5: true,
      preload: false,
      volume: this.volume,
      onplay: () => {
        this.state = AudioState.PLAYING;
        this.emit("play", { type: "play" });
      },
      onpause: () => {
        this.state = AudioState.PAUSED;
        this.emit("pause", { type: "pause" });
      },
      onend: () => {
        this.state = AudioState.ENDED;
        this.stopProgressLoop();
        this.emit("end", { type: "end" });
      },
      onloaderror: (_id, err) => this.handleLoadFailure(err),
      onplayerror: (_id, err) => this.handleLoadFailure(err),
    };
    if (format) options.format = format;
    return new Howl(options);
  }

  /**
   * Retry once by rebuilding the Howl, then surface ERROR if it fails again.
   * Retry flag resets on the next play().
   */
  private handleLoadFailure(err: unknown): void {
    if (!this.retried && this.streamUrl) {
      this.retried = true;
      const url = this.streamUrl;
      this.teardownHowl();
      this.howl = this.buildHowl({ url });
      this.soundId = this.howl.play();
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    this.state = AudioState.ERROR;
    this.stopProgressLoop();
    this.teardownHowl();
    this.emit("error", { type: "error", error: new Error(message) });
  }

  private teardownHowl(): void {
    if (this.howl) {
      this.howl.unload();
      this.howl = null;
    }
    this.soundId = null;
  }

  private startProgressLoop(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      if (this.state === AudioState.PLAYING) {
        this.emit("progress", {
          type: "progress",
          position: this.position(),
          duration: this.duration(),
        });
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopProgressLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

/** Default singleton for imperative use. UI wiring lands in Slice 2.5. */
export const audioEngine = new AudioEngine();