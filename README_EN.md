<p align="center">
  <img src="public/favicon.ico" alt="SimPlayer Logo" width="80" height="80">
</p>

<h1 align="center">SimPlayer</h1>

<p align="center">
  A minimalist HTML5 web video player supporting multiple video formats and streaming media. Embed it in any webpage.
</p>

<p align="center">
  <a href="#features">Features</a> • <a href="#quick-start">Quick Start</a> • <a href="#usage">Usage</a> • <a href="#keyboard-shortcuts">Shortcuts</a> • <a href="#tech-stack">Tech Stack</a> • <a href="#deployment">Deployment</a> • <a href="#changelog">Changelog</a>
</p>

<p align="center">
  English | <a href="README.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/HLS.js-1.6-green" alt="HLS.js">
  <img src="https://img.shields.io/badge/License-MIT-gray" alt="License">
</p>

---

## Features

### Core Playback

- **Multi-format Support** — MP4, WebM, OGG, and HLS (M3U8) streaming formats
- **HLS Streaming** — Low-latency M3U8 playback via HLS.js with automatic error recovery and network retry
- **iOS Native HLS** — Uses Safari's native HLS engine on iOS, no HLS.js needed — better battery life and smoother playback
- **Custom Controls** — Play/pause, progress seeking (with hover preview), volume adjustment, playback speed (0.5x – 2x), skip forward/backward

### Enhanced Features

- **Picture-in-Picture** — Floating window playback with webkit prefix compatibility (requires browser support)
- **Fullscreen** — Double-click or button to toggle fullscreen with webkit prefix fallback and iOS Safari video fullscreen support
- **Screenshot** — One-click capture of the current frame as PNG with flash feedback
- **Progress Memory** — Automatically saves playback progress per video to localStorage; resumes on next visit
- **Resume Prompt** — Shows a prompt when history progress is detected; auto-dismisses after 5 seconds
- **CORS Fallback** — Automatically retries loading without crossOrigin when CORS blocks the initial request
- **Anti-Hotlinking Bypass** — Uses `no-referrer` policy to bypass CDN hotlink protection (e.g., Bilibili's HTTP 959 error)
- **Nested URL Parsing** — Correctly parses nested video URLs containing `&` and other special characters (e.g., Bilibili links)

### Interaction

- **Context Menu** — Glassmorphism-styled right-click menu: screenshot, video parameters, keyboard shortcuts, clear cache, visit project page
- **Fullscreen Dialogs** — Context menu and dialogs work correctly in fullscreen mode; auto-restores fullscreen when dismissing dialogs via Esc
- **Keyboard Shortcuts** — Space/K play/pause, arrow keys for seeking and volume, F for fullscreen, M to close dialogs
- **Pause-Persistent Controls** — Controls remain visible while the video is paused, never auto-hide
- **Mobile Support** — Touch drag on progress bar, responsive control sizes for small screens
- **Responsive Design** — Adapts seamlessly to desktop, tablet, and mobile screens

### Deployment & Embedding

- **Static Export** — Build output is purely static files, deployable to any static hosting platform
- **iframe Embedding** — Use as a standalone player embedded in other pages, with Picture-in-Picture permission support
- **Component Embedding** — Use as a React component directly in your Next.js project
- **Zero Configuration** — Pass video URL via query parameters, no backend required

## Quick Start

### Prerequisites

- Node.js 18+
- npm / bun / pnpm

### Build from Source

```bash
# Clone the repository
git clone https://github.com/Eq52/Sim-Player.git
cd Sim-Player

# Install dependencies
npm install

# Development mode
npm run dev

# Build static files (output to out/ directory)
npm run build

# Preview build output locally
npm run preview
```

### Deploy Directly

Download [SimPlayer-v2.0.0-deploy.zip](https://github.com/Eq52/Sim-Player/releases/download/v2.0.0/SimPlayer-v2.0.0-deploy.zip), extract it, and upload all files to any static hosting service.

## Usage

### URL Parameters

Pass the video URL via query parameters:

```
?url=https://example.com/video.mp4
?url=https://example.com/video.mp4&title=Video Title
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `url` | Video file URL (MP4 / WebM / OGG / M3U8) | Yes |
| `title` | Video title displayed at the top of the player | No |

> Nested URLs (e.g., Bilibili links containing `&`) are parsed correctly without manual encoding.

### iframe Embedding

```html
<iframe
  src="https://your-domain.com/?url=https://example.com/video.mp4&title=My Video"
  width="100%"
  style="aspect-ratio: 16/9; border: none;"
  allowfullscreen
  allow="picture-in-picture"
></iframe>
```

> **Tip:** Add `allow="picture-in-picture"` to the iframe tag to enable Picture-in-Picture support.

### Component Embedding

You can integrate the `VideoPlayer` component directly into your Next.js project:

```tsx
import VideoPlayer from '@/components/video-player';

<VideoPlayer
  src="https://example.com/video.mp4"
  title="Video Title"
  poster="/poster.png"
  fillContainer={false}
  onVideoInfo={(info) => console.log(info)}
  onError={(error) => console.error(error)}
/>
```

| Prop | Type | Description | Required |
|------|------|-------------|----------|
| `src` | `string` | Video file URL | Yes |
| `title` | `string` | Video title | No |
| `poster` | `string` | Poster image URL, defaults to `/poster.png` | No |
| `fillContainer` | `boolean` | Fill parent container (disables 16:9 aspect ratio) | No |
| `onVideoInfo` | `function` | Video metadata callback (resolution, duration, format) | No |
| `onError` | `function` | Error callback | No |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `←` | Seek backward 5 seconds |
| `→` | Seek forward 5 seconds |
| `↑` | Volume up 10% |
| `↓` | Volume down 10% |
| `F` | Toggle fullscreen |
| `M` | Close dialog (video parameters / keyboard shortcuts) |
| Double-click | Toggle fullscreen |
| Single-click | Play / Pause |

## Context Menu

Right-click on the player area to open the custom context menu:

- **Capture Current Frame** — Screenshot the current video frame and download as PNG
- **View Video Parameters** — Opens a dialog showing format, resolution, duration, playback progress, playback speed, volume, and buffer status
- **Keyboard Shortcuts** — Opens a keyboard shortcuts reference
- **Clear Playback Cache** — Clears localStorage playback records for all videos with a toast confirmation
- **Author Website** — Opens the GitHub repository

## Project Structure

```
SimPlayer/
├── public/
│   ├── favicon.ico          # Favicon
│   ├── poster.png           # Default video poster
│   └── cyberpunk-bg.png     # Default background image
├── src/
│   ├── app/
│   │   ├── globals.css      # Global styles & custom animations
│   │   ├── layout.tsx       # Root layout (Metadata, fonts)
│   │   └── page.tsx         # Main page (URL parameter parsing, empty state)
│   ├── components/
│   │   └── video-player.tsx # Core player component (iOS compat, HLS, fullscreen, PiP)
│   ├── hooks/               # Custom Hooks
│   └── lib/                 # Utility functions
├── .github/
│   └── workflows/
│       └── static.yml       # CI/CD auto-build and publish
├── next.config.ts           # Next.js config (static export)
├── package.json
└── tsconfig.json
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 16](https://nextjs.org/) | React framework, static site generation |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS |
| [HLS.js](https://github.com/video-dev/hls.js/) | M3U8 streaming playback |
| [Lucide React](https://lucide.dev/) | Icon library |

## Deployment

SimPlayer outputs purely static files to the `out/` directory after building. Deploy to any static hosting platform:

### Vercel

```bash
npm i -g vercel
vercel --prod
```

### Netlify

Drag and drop the `out/` directory to Netlify, or connect your Git repository for automatic deployments.

### GitHub Pages

Push the contents of the `out/` directory to the `gh-pages` branch.

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/SimPlayer/out;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker

```dockerfile
FROM nginx:alpine
COPY out/ /usr/share/nginx/html/
EXPOSE 80
```

## Known Limitations

- Screenshot does not work with cross-origin videos (browser CORS policy); a user-friendly error toast is shown
- Picture-in-Picture requires browser support and `allow="picture-in-picture"` on the iframe element
- Playback progress is stored in browser localStorage; clearing browser data will erase all progress
- iOS Safari fullscreen only supports native `<video>` element fullscreen, not container fullscreen (browser limitation)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details.

## Author

[Eq52](https://github.com/Eq52) and `GLM-5-Turbo`

## License

[MIT](LICENSE)
