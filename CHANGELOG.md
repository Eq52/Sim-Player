# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-05-17

### Added

- **iOS native HLS support** — Safari on iOS now uses the native HLS engine instead of HLS.js, reducing battery usage and improving playback smoothness
- **webkit fullscreen fallback** — Fullscreen toggle now falls back to `webkitRequestFullscreen` for older WebKit-based browsers
- **iOS video fullscreen** — On iOS Safari where container fullscreen is unsupported, the player automatically uses the native `<video>` element `webkitEnterFullscreen`
- **webkit PiP detection** — Picture-in-Picture support detection now includes `webkitPictureInPictureEnabled` for older Safari versions
- **Mobile touch drag** — Progress bar supports touch-based dragging on mobile devices via `touchmove` / `touchend` event handlers
- **Pause-persistent controls** — Player controls remain visible while the video is paused and never auto-hide
- **Cache clear feedback** — Clearing playback cache from the context menu now shows a toast notification for confirmation
- **Anti-hotlinking bypass** — Added `referrerPolicy="no-referrer"` to the `<video>` element to bypass CDN hotlink protection (e.g., Bilibili's HTTP 959 error)
- **Nested URL parameter parsing** — Replaced `URLSearchParams` with regex-based extraction to correctly parse video URLs containing `&` characters
- **CI/CD pipeline** — Added GitHub Actions workflow for automated static build and release publishing

### Fixed

- **Unused variable `setCoverUrl`** — Removed unused state setter that was causing a React warning
- **Unused variable `progressRestoredRef`** — Removed unused ref that served no purpose
- **Control bar auto-hide logic** — Controls now correctly remain visible when the context menu, video parameters dialog, or shortcuts help dialog is open
- **`handleScreenshot` unstable reference** — Removed unnecessary dependencies from `useCallback`, ensuring a stable function reference and eliminating redundant re-creates
- **iOS Safari HLS broken by `crossOrigin`** — The `crossOrigin="anonymous"` attribute is now skipped on iOS, where it interferes with native HLS playback
- **iOS HLS double error handler** — CORS retry no longer triggers on iOS native HLS to prevent double-firing the error handler
- **`resumePromptTimerRef` memory leak** — Timer is now properly cleaned up on component unmount to prevent state updates on unmounted components
- **Fullscreen change missing webkit prefix** — Added `webkitfullscreenchange` event listener alongside the standard `fullscreenchange` event
- **Controls auto-hide ignoring shortcuts dialog** — Added `showShortcutsDialog` to the auto-hide condition check

### Changed

- **DRY refactor: `initHls` extraction** — HLS initialization logic extracted into a reusable function, eliminating duplicated code between initial load and CORS retry
- **DRY refactor: fullscreen helpers** — `getFullscreenElement`, `requestFullscreen`, and `exitFullscreen` extracted as utility functions with webkit prefix support
- **iOS detection utility** — Added `detectIOS()` function using user agent and touch capability detection
- **HLS.js initialization options** — Added `lowLatencyMode` and `enableWorker` for improved streaming performance
- **Version bumped to 2.0.0** — Reflecting the scope of new features and breaking improvements

---

## [1.0.0] - 2026-05-16

### Added

- **Initial release** — SimPlayer v1.0.0, a minimalist HTML5 web video player
- **Multi-format playback** — Support for MP4, WebM, OGG, and HLS (M3U8) video formats
- **Custom control bar** — Play/pause, progress seeking, volume control, playback speed (0.5x – 2x), skip forward/backward
- **Picture-in-Picture mode** — Floating window playback (browser support required)
- **Fullscreen toggle** — Double-click or button to enter/exit fullscreen
- **Video screenshot** — Capture current frame as PNG with one click
- **Playback progress memory** — Auto-save and resume viewing progress via localStorage
- **Resume prompt** — Prompt dialog when historical progress is detected
- **Right-click context menu** — Glassmorphism-styled menu with screenshot, video parameters, shortcuts help, cache clear, and project link
- **Video parameters dialog** — Display resolution, duration, format, playback rate, volume, and buffer status
- **Keyboard shortcuts** — Space/K, arrow keys, F, M for common actions
- **Responsive design** — Adapts to desktop, tablet, and mobile screens
- **Static export** — Build output as pure static files for any hosting platform
- **iframe embedding** — Embed as a standalone player in other web pages
