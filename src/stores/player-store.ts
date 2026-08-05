"use client";

/**
 * Player store — single source of truth for playback, queue, history, and
 * modes. Glue layer that connects the AudioEngine (2.1), Piped stream API
 * (2.2), gapless preloader (2.3), and Media Session (2.4). No UI lives here.
 *
 * Engine mechanics stay in the engine; the STORE owns timing (when to preload,
 * when to advance, repeat/shuffle policy). Queue model: `[current, ...queue]`;
 * `currentIndex` = current track's position in the session (== history.length).
 *
 * State isolation: consumers select fields granularly (see use-player.ts) so
 * position ticks never re-render the player bar wholesale.
 */
import { create } from "zustand";
import {
  AudioState,
  type StreamSource,
  type TrackMetadata,
} from "@/types/audio";
import type { StreamInfo, Track } from "@/types/piped";
import { audioEngine } from "@/lib/audio/engine";
import { MediaSessionController } from "@/lib/audio/media-session";

export type RepeatMode = "off" | "one" | "all";

export interface PlayerState {
  // Playback
  currentTrack: Track | null;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  /** Non-null when the last startTrack failed to fetch a stream (kept set so
   *  the bar can show the track info + an error instead of going blank). */
  streamError: string | null;
  position: number;
  duration: number;
  volume: number;

  // Queue
  queue: Track[];
  history: Track[];
  currentIndex: number;

  // Modes
  shuffle: boolean;
  repeat: RepeatMode;

  // Actions
  playTrack: (track: Track) => Promise<void>;
  playQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

/* ---- Stream resolution seam -------------------------------------------------
 * Default: Piped proxy via /api/stream. Piped stream endpoints are
 * YouTube-anti-bot-blocked right now (KNOWN_ISSUE [2.2]), so the TEMP test page
 * injects a SoundHelix resolver via setStreamResolver(). Production never
 * calls the override.
 */
/** Max total attempts per stream fetch (1 initial + 1 retry). */
const MAX_STREAM_ATTEMPTS = 2;

async function defaultResolveStream(track: Track): Promise<StreamSource> {
  let lastError: Error = new Error(`Failed to load stream for "${track.title}"`);
  for (let attempt = 1; attempt <= MAX_STREAM_ATTEMPTS; attempt++) {
    let status = 0;
    try {
      const res = await fetch(`/api/stream/${encodeURIComponent(track.id)}`);
      status = res.status;
      const json = (await res.json()) as {
        success?: boolean;
        data?: StreamInfo;
        error?: string;
      };
      if (res.ok && json.success && json.data) {
        return { url: json.data.url, format: json.data.format ?? undefined };
      }
      lastError = new Error(
        json.error ?? `Failed to load stream for "${track.title}"`,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    // 502/429/403 = Piped/YouTube anti-bot block or rate limit (KNOWN_ISSUE
    // [2.2]) — the block won't clear mid-retry, so fail fast. Only a transient
    // non-throttle failure earns the single retry.
    if (status === 502 || status === 429 || status === 403) break;
  }
  throw lastError;
}

let resolveStream: (track: Track) => Promise<StreamSource> = defaultResolveStream;
/** Test/tooling override. Production always uses defaultResolveStream. */
export function setStreamResolver(
  resolver: (track: Track) => Promise<StreamSource>,
): void {
  resolveStream = resolver;
}

/* ---- Internal, non-reactive state -------------------------------------------- */
let preloadedTrack: Track | null = null; // the buffered "next" (engine promotes it)
let preloadInFlight = false;

const mediaSession = new MediaSessionController(audioEngine);
mediaSession.attach();

const REPEAT_CYCLE: RepeatMode[] = ["off", "one", "all"];

const PRELOAD_FRACTION = 0.8;
const PRELOAD_REMAINING_SECONDS = 20;

/* ---- Store -------------------------------------------------------------------- */
export const usePlayerStore = create<PlayerState>()((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  streamError: null,
  position: 0,
  duration: 0,
  volume: 1,

  queue: [],
  history: [],
  currentIndex: 0,

  shuffle: false,
  repeat: "off",

  playTrack: (track) => startTrack(track),
  playQueue: (tracks, startIndex = 0) => playQueue(tracks, startIndex),
  pause: () => audioEngine.pause(),
  resume: () => audioEngine.resume(),
  stop: () => stopPlayback(),
  next: () => nextTrack(),
  previous: () => previousTrack(),
  seek: (position) => audioEngine.seek(position),
  setVolume: (volume) => {
    audioEngine.setVolume(volume);
    set({ volume });
  },
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeat:
        REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(s.repeat) + 1) % REPEAT_CYCLE.length],
    })),
  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
  removeFromQueue: (index) =>
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  clearQueue: () => set({ queue: [] }),
}));

/* ---- Internal helpers ----------------------------------------------------------- */
function toMetadata(track: Track): TrackMetadata {
  return {
    title: track.title,
    artist: track.artist,
    artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: "any" }] : [],
  };
}

/** Fetch + play a single track, updating store + media session. */
async function startTrack(track: Track): Promise<void> {
  preloadedTrack = null;
  preloadInFlight = false;
  // Optimistic track info (Spotify behavior): publish the track BEFORE the
  // stream fetch so the bar shows it instantly. If the stream then fails, the
  // track stays visible with a streamError instead of the bar going blank.
  usePlayerStore.setState({
    currentTrack: track,
    isLoading: true,
    isPlaying: false,
    isPaused: false,
    streamError: null,
    position: 0,
    duration: 0,
  });
  try {
    const source = await resolveStream(track);
    if (!source.url) throw new Error(`Empty stream URL for "${track.title}"`);
    audioEngine.play({ url: source.url, format: source.format });
    mediaSession.setMetadata(toMetadata(track));
    usePlayerStore.setState({ isLoading: false, streamError: null });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Stream unavailable";
    console.warn("[player] failed to start track:", err);
    usePlayerStore.setState({ isLoading: false, streamError: message });
  }
}

async function playQueue(tracks: Track[], startIndex = 0): Promise<void> {
  if (tracks.length === 0) return;
  const start = Math.min(Math.max(startIndex, 0), tracks.length - 1);
  const { shuffle } = usePlayerStore.getState();
  let upcoming = tracks.slice(start + 1);
  if (shuffle) upcoming = shuffleArray(upcoming);
  usePlayerStore.setState({
    currentTrack: null,
    queue: upcoming,
    history: tracks.slice(0, start).reverse(),
    currentIndex: start,
    position: 0,
    duration: 0,
    isPlaying: false,
    isPaused: false,
  });
  await startTrack(tracks[start]);
}

async function nextTrack(): Promise<void> {
  const s = usePlayerStore.getState();
  const next = s.queue[0];
  if (next) {
    const finished = s.currentTrack;
    usePlayerStore.setState((st) => ({
      history: finished ? [finished, ...st.history] : st.history,
      queue: st.queue.slice(1),
      currentIndex: st.currentIndex + 1,
    }));
    await startTrack(next);
    return;
  }
  // Queue exhausted → repeat policy decides.
  if (s.repeat === "all" && (s.currentTrack || s.history.length > 0)) {
    const played = s.currentTrack
      ? [s.currentTrack, ...s.history]
      : [...s.history];
    const chronological = played.slice().reverse();
    const rebuilt = chronological.filter((t) => t.id !== s.currentTrack?.id);
    usePlayerStore.setState({ history: [], queue: rebuilt, currentIndex: 0 });
    if (rebuilt[0]) await startTrack(rebuilt[0]);
    return;
  }
  stopPlayback();
}

async function previousTrack(): Promise<void> {
  const s = usePlayerStore.getState();
  const prev = s.history[0];
  if (!prev) return;
  const cur = s.currentTrack;
  usePlayerStore.setState((st) => ({
    queue: cur ? [cur, ...st.queue] : st.queue,
    history: st.history.slice(1),
    currentIndex: Math.max(0, st.currentIndex - 1),
  }));
  await startTrack(prev);
}

function stopPlayback(): void {
  audioEngine.stop();
  mediaSession.clear();
  preloadedTrack = null;
  preloadInFlight = false;
  usePlayerStore.setState({
    currentTrack: null,
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    streamError: null,
    position: 0,
    duration: 0,
    queue: [],
    currentIndex: 0,
    // history intentionally retained (Spotify behavior).
  });
}

/** Buffer `track` as the gapless next, if it's still the imminent one. */
async function preloadTrack(track: Track): Promise<void> {
  if (preloadInFlight) return;
  preloadInFlight = true;
  try {
    const source = await resolveStream(track);
    const s = usePlayerStore.getState();
    const stale =
      preloadedTrack !== null ||
      s.currentTrack?.id === track.id ||
      s.queue[0]?.id !== track.id;
    if (stale) return;
    audioEngine.preload({ url: source.url, format: source.format });
    preloadedTrack = track;
    console.log(`[player] preload triggered: ${track.title}`);
  } catch (err) {
    console.warn("[player] preload failed:", err);
  } finally {
    preloadInFlight = false;
  }
}

/** 80%-or-20s rule. Runs on every progress tick — guards make it a no-op most frames. */
function maybePreloadNext(): void {
  const s = usePlayerStore.getState();
  if (preloadedTrack) return;
  if (s.repeat === "one") return; // will replay current, not advance
  if (s.duration <= 0) return;
  const nearEnd =
    s.position >= s.duration * PRELOAD_FRACTION ||
    s.duration - s.position <= PRELOAD_REMAINING_SECONDS;
  if (!nearEnd) return;
  const next = s.queue[0];
  if (!next) return;
  void preloadTrack(next);
}

function handleEngineEnd(): void {
  const s = usePlayerStore.getState();
  if (audioEngine.getState().state === AudioState.PLAYING) {
    // Engine auto-promoted to the preloaded howl (gapless).
    const promoted = preloadedTrack;
    preloadedTrack = null;
    if (promoted) {
      const finished = s.currentTrack;
      usePlayerStore.setState((st) => ({
        currentTrack: promoted,
        history: finished ? [finished, ...st.history] : st.history,
        queue: st.queue.slice(1),
        currentIndex: st.currentIndex + 1,
      }));
      mediaSession.setMetadata(toMetadata(promoted));
      const next = usePlayerStore.getState().queue[0];
      if (next) void preloadTrack(next); // eager chain to keep gapless
    }
  } else if (s.repeat === "one" && s.currentTrack) {
    void startTrack(s.currentTrack); // replay current
  } else {
    void nextTrack(); // advance / wrap / stop
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ---- Engine event wiring (module init, client-only) ------------------------------ */
audioEngine.on("play", () => {
  usePlayerStore.setState({
    isPlaying: true,
    isPaused: false,
    isLoading: false,
    streamError: null,
  });
});
audioEngine.on("pause", () => {
  usePlayerStore.setState({ isPlaying: false, isPaused: true });
});
audioEngine.on("end", handleEngineEnd);
audioEngine.on("error", () => {
  usePlayerStore.setState({ isPlaying: false, isPaused: false, isLoading: false });
});
audioEngine.on("progress", (e) => {
  usePlayerStore.setState({ position: e.position, duration: e.duration });
  maybePreloadNext();
});
