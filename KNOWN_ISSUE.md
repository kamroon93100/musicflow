# Known Issues

## [1.1] `--accent` set to green → hover surfaces render green
- **Status**: Accepted for now (matches Spotify brand).
- **Impact**: shadcn hover surfaces (`bg-accent text-accent-foreground`) use
  `#1db954` with `#121212` foreground. Contrast is fine; the aesthetic may or
  may not hold up once real UI lands.
- **Resolution**: If hover surfaces look bad in Slice 4 (Core UI), add a
  separate `--hover` token (`#282828`) and point hover utilities at it instead
  of `--accent`. Not doing this now — would be speculative.

## [1.1] PWA install prompt needs PNG icons
- **Status**: Deferred intentionally.
- **Impact**: `/manifest.webmanifest` is served and the app is installable in
  practice, but Chrome's install *prompt* requires 192/512 PNG icons — currently
  only an SVG icon exists.
- **Resolution**: Generate 192/512 PNG icons in Slice 5.6 (Offline PWA), where
  installability actually lands.
