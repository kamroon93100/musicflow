/**
 * Media Session API controller — OS Now Playing widget + media keys.
 *
 * CLIENT-ONLY: touches `navigator.mediaSession` (browser API). Graceful no-op
 * when unsupported. Owns NO audio — it mirrors the engine's state and forwards
 * OS play/pause/seek actions back into it. The engine stays playback-only;
 * Slice 2.5's player store will own the metadata-to-track mapping.
 *
 * MDN ordering caveat: `setActionHandler` can throw if metadata hasn't been set
 * yet, so handlers register lazily on the first setMetadata() call.
 */
import { AudioState, type TrackMetadata } from "@/types/audio";
import type { AudioEngine } from "@/lib/audio/engine";

type PlaybackState = "playing" | "paused" | "none";

const ACTIONS = [
  "play",
  "pause",
  "previoustrack",
  "nexttrack",
  "seekto",
] as const;

/** Throttle OS position writes — never pump at rAF rate (120fps rule). */
const POSITION_THROTTLE_SECONDS = 0.25;

export class MediaSessionController {
  private readonly engine: AudioEngine;
  private readonly supported: boolean;
  private offs: (() => void)[] = [];
  private handlersRegistered = false;
  private hasMetadata = false;
  private lastPosition = -1;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    this.supported =
      typeof navigator !== "undefined" && "mediaSession" in navigator;
  }

  /** Subscribe to engine events and mirror state into the OS. */
  attach(): void {
    if (!this.supported) return;
    this.offs = [
      this.engine.on("play", () => this.updatePlaybackState("playing")),
      this.engine.on("pause", () => this.updatePlaybackState("paused")),
      this.engine.on("end", () => {
        if (this.engine.getState().state === AudioState.PLAYING) {
          // Gapless promote — keep the OS widget alive, just re-sync.
          this.updatePlaybackState("playing");
        } else {
          this.setPlaybackState("none");
          this.clearPosition();
        }
      }),
      this.engine.on("error", () => {
        this.setPlaybackState("none");
        this.clearPosition();
      }),
      this.engine.on("progress", (e) =>
        this.updatePosition(e.position, e.duration),
      ),
    ];
  }

  /** Push track metadata to the OS and register action handlers once. */
  setMetadata(metadata: TrackMetadata): void {
    if (!this.supported) return;
    this.hasMetadata = true;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title,
      artist: metadata.artist ?? "",
      album: metadata.album ?? "",
      artwork: metadata.artwork ?? [],
    });
    this.ensureHandlers();
    this.updatePlaybackState(
      this.engine.getState().state === AudioState.PLAYING
        ? "playing"
        : "paused",
    );
  }

  /** Remove the OS widget entirely (e.g. on stop). */
  clear(): void {
    if (!this.supported) return;
    this.hasMetadata = false;
    navigator.mediaSession.metadata = null;
    this.setPlaybackState("none");
    this.clearPosition();
  }

  /** Full teardown — detach listeners, unregister handlers, clear the widget. */
  destroy(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    if (!this.supported) return;
    this.handlersRegistered = false;
    for (const action of ACTIONS) {
      navigator.mediaSession.setActionHandler(action, null);
    }
    this.clear();
  }

  /* ---- Internals ---- */

  private ensureHandlers(): void {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;

    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => {
      if (this.engine.getState().state === AudioState.PAUSED) {
        this.engine.resume();
      }
    });
    ms.setActionHandler("pause", () => {
      if (this.engine.getState().state === AudioState.PLAYING) {
        this.engine.pause();
      }
    });
    // Registered so the buttons appear; real skip needs a queue (Slice 2.5).
    ms.setActionHandler("previoustrack", () => {
      console.debug("[media-session] previoustrack — queue lands in Slice 2.5");
    });
    ms.setActionHandler("nexttrack", () => {
      console.debug("[media-session] nexttrack — queue lands in Slice 2.5");
    });
    if (typeof ms.setPositionState === "function") {
      ms.setActionHandler("seekto", (details) => {
        if (typeof details.seekTime === "number") {
          this.engine.seek(details.seekTime);
        }
      });
    }
  }

  private updatePlaybackState(state: PlaybackState): void {
    if (!this.hasMetadata) return;
    this.setPlaybackState(state);
  }

  private setPlaybackState(state: PlaybackState): void {
    if (!this.supported) return;
    navigator.mediaSession.playbackState = state;
  }

  private updatePosition(position: number, duration: number): void {
    if (!this.hasMetadata || duration <= 0) return;
    if (typeof navigator.mediaSession.setPositionState !== "function") return;
    if (Math.abs(position - this.lastPosition) < POSITION_THROTTLE_SECONDS) {
      return;
    }
    this.lastPosition = position;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position,
        playbackRate: 1,
      });
    } catch {
      // Chrome throws InvalidStateError when idle/metadata-less — ignore.
    }
  }

  private clearPosition(): void {
    if (!this.supported) return;
    if (typeof navigator.mediaSession.setPositionState !== "function") return;
    try {
      navigator.mediaSession.setPositionState({
        duration: 0,
        position: 0,
        playbackRate: 1,
      });
    } catch {
      /* ignore */
    }
    this.lastPosition = -1;
  }
}
