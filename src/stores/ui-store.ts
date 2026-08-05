import { create } from "zustand";

/**
 * Global UI state that isn't owned by a single component.
 *
 * Player + queue state are intentionally NOT here — they land in their own
 * stores in Slice 2.5 per the build plan (no speculative code).
 */
interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Full-screen player overlay open state (Slice 4.4) */
  isFullScreenPlayerOpen: boolean;
  openFullScreenPlayer: () => void;
  closeFullScreenPlayer: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  isFullScreenPlayerOpen: false,
  openFullScreenPlayer: () => set({ isFullScreenPlayerOpen: true }),
  closeFullScreenPlayer: () => set({ isFullScreenPlayerOpen: false }),
}));
