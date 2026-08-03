import type { MetadataRoute } from "next";

/**
 * PWA manifest (served at /manifest.webmanifest). Next 16 convention is a
 * route handler, not `metadata.manifest` in layout.tsx.
 *
 * Installability PNG icons (192/512) are deferred to Slice 5.6 (Offline PWA) —
 * SVG icons are wired now so the manifest structure is in place.
 */
export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "MusicFlow";

  return {
    name: appName,
    short_name: appName,
    description:
      "Free music streaming — YouTube Music audio, Spotify metadata, synced lyrics.",
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
