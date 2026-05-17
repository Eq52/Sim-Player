<p align="center">
  <img src="public/favicon.ico" alt="SimPlayer Logo" width="80" height="80">
</p>

<h1 align="center">SimPlayer</h1>

<p align="center">
  一款极简风格的 HTML5 网页视频播放器，支持多格式视频流媒体播放，可嵌入任何网页使用。
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> • <a href="#快速开始">快速开始</a> • <a href="#使用方式">使用方式</a> • <a href="#快捷键">快捷键</a> • <a href="#技术栈">技术栈</a> • <a href="#部署">部署</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/HLS.js-1.6-green" alt="HLS.js">
  <img src="https://img.shields.io/badge/License-MIT-gray" alt="License">
</p>

---

## 功能特性

- **多格式支持** — 支持 MP4、WebM、OGG 及 HLS（M3U8）流媒体格式
- **自定义控件** — 播放/暂停、进度拖拽、音量调节、倍速切换（0.5x ~ 2x）、快进/快退 5 秒
- **iOS 原生 HLS 播放** — 自动检测 iOS 设备，使用 Safari 原生 HLS 解析；自动处理 iOS 专属的错误恢复和卡顿恢复机制
- **全屏兼容** — 支持 Fullscreen API 及 WebKit 前缀全屏（兼容 Safari / 旧版浏览器），iOS Safari 通过 `webkitEnterFullscreen` 实现视频元素全屏
- **画中画模式** — 支持 Picture-in-Picture 浮窗播放，包含 WebKit 前缀检测以兼容旧版 Safari
- **视频截图** — 一键截取当前画面，自动保存为带时间戳的 PNG 文件，附带屏幕闪烁反馈
- **播放进度记忆** — 基于 localStorage 自动保存每个视频的观看进度（每 3 秒存档），下次打开可恢复
- **断点续播提示** — 检测到历史进度时弹出提示（5 秒自动消失），可选择跳转或忽略
- **移动端触摸拖拽** — 进度条支持触摸拖拽定位（`onTouchStart/Move/End`），拖拽期间控件保持显示不自动隐藏
- **控件自动隐藏** — 播放中 3 秒无操作自动隐藏控件，暂停时控件常驻显示；对话框或右键菜单打开时控件不会被隐藏
- **进度条热区** — 控件隐藏时，底部热区仍可触发控件显示
- **右键菜单** — 半透明毛玻璃风格，自动边界检测防止溢出视口，4 秒无操作自动关闭；支持截图、查看视频参数、快捷键帮助、清除缓存
- **全屏对话框兼容** — 右键菜单、视频参数和快捷键对话框在全屏模式下均可正常使用；按 Esc 退出对话框后自动重新进入全屏
- **CORS 降级** — 首次尝试带 `crossOrigin="anonymous"` 加载视频，若 CORS 阻断则自动降级重试
- **截图文件名** — 包含时间戳信息（如 `screenshot_1-23-45.png`）
- **缓存清除反馈** — 删除播放缓存后弹出 Toast 通知确认操作成功
- **响应式设计** — 全面适配桌面端、平板和手机屏幕，控件尺寸随屏幕自适应
- **纯静态导出** — 构建产物为纯静态文件，可部署至任意静态托管平台
- **iframe 嵌入** — 可作为独立播放器嵌入其他网页

## 快速开始

### 环境要求

- Node.js 18+
- npm / bun / pnpm

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/Eq52/Sim-Player.git
cd Sim-Player

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建静态文件（输出至 out/ 目录）
npm run build

# 本地预览构建产物
npm run preview
```

### 直接部署

下载 `SimPlayer-deploy.zip` ([Go](https://github.com/Eq52/Sim-Player/releases/download/v1.0.0/SimPlayer-deploy.zip)) ，解压后将其中的所有文件上传至任意静态托管服务即可。

## 使用方式

### URL 参数

通过 URL Query 参数传入视频地址：

```
?url=https://example.com/video.mp4
?url=https://example.com/video.mp4&title=视频标题
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `url` | 视频文件地址（支持 MP4 / WebM / OGG / M3U8） | 是 |
| `title` | 视频标题，显示在播放器顶部 | 否 |

### 组件嵌入

```tsx
import VideoPlayer from '@/components/video-player';

<VideoPlayer
  src="https://example.com/video.mp4"
  title="视频标题"
  poster="/poster.png"
  fillContainer={false}
  onVideoInfo={(info) => console.log(info)}
  onError={(error) => console.error(error)}
/>
```

| 属性 | 类型 | 说明 | 必填 |
|------|------|------|------|
| `src` | `string` | 视频文件地址 | 是 |
| `title` | `string` | 视频标题 | 否 |
| `poster` | `string` | 封面图 URL，默认 `/poster.png` | 否 |
| `fillContainer` | `boolean` | 是否填充父容器（禁用 16:9 宽高比） | 否 |
| `onVideoInfo` | `function` | 视频元数据回调（分辨率、时长、格式） | 否 |
| `onError` | `function` | 错误回调 | 否 |

### iframe 嵌入

```html
<iframe
  src="https://your-domain.com/?url=https://example.com/video.mp4&title=My Video"
  width="100%"
  style="aspect-ratio: 16/9; border: none;"
  allowfullscreen
  allow="picture-in-picture"
></iframe>
```

> **注意**：如需使用画中画功能，请在 iframe 标签中添加 `allow="picture-in-picture"` 属性。

## 快捷键

| 按键 | 功能 |
|------|------|
| `Space` / `K` | 播放 / 暂停 |
| `←` | 快退 5 秒 |
| `→` | 快进 5 秒 |
| `↑` | 音量增加 10% |
| `↓` | 音量减少 10% |
| `F` | 切换全屏 |
| `M` | 关闭弹窗（视频参数 / 快捷键帮助） |
| 双击画面 | 切换全屏 |
| 单击画面 | 播放 / 暂停 |

## 右键菜单

右键点击播放器区域可呼出自定义菜单：

- **截取当前画面** — 截取当前视频帧并下载 PNG 文件
- **查看视频参数** — 弹出对话框显示格式、分辨率、时长、播放进度、播放速度、音量、缓冲进度
- **快捷键帮助** — 弹出快捷键参考列表
- **删除播放缓存** — 清除所有视频的 localStorage 播放记录，并弹出 Toast 确认
- **作者网站** — 跳转至 GitHub 仓库

## 项目结构

```
SimPlayer/
├── public/
│   ├── favicon.ico          # 网站图标
│   ├── poster.png           # 视频封面图
│   └── cyberpunk-bg.png     # 默认背景图
├── src/
│   ├── app/
│   │   ├── globals.css      # 全局样式 & 自定义动画
│   │   ├── layout.tsx       # 根布局（Metadata、字体）
│   │   └── page.tsx         # 主页面（URL 参数解析、空状态）
│   ├── components/
│   │   └── video-player.tsx # 核心播放器组件（含 iOS 兼容、HLS、全屏、PiP）
│   ├── hooks/               # 自定义 Hooks
│   └── lib/                 # 工具函数
├── next.config.ts           # Next.js 配置（静态导出）
├── package.json
└── tsconfig.json
```

## 技术栈

| 技术 | 用途 |
|------|------|
| [Next.js 16](https://nextjs.org/) | React 框架，静态站点生成 |
| [TypeScript](https://www.typescriptlang.org/) | 类型安全 |
| [Tailwind CSS 4](https://tailwindcss.com/) | 原子化 CSS 样式 |
| [HLS.js](https://github.com/video-dev/hls.js/) | M3U8 流媒体播放支持 |
| [Lucide React](https://lucide.dev/) | 图标库 |

## 部署

SimPlayer 构建后输出纯静态文件（`out/` 目录），可部署至任意静态托管平台：

### Vercel

```bash
npm i -g vercel
vercel --prod
```

### Netlify

将 `out/` 目录拖拽上传至 Netlify，或连接 Git 仓库自动部署。

### GitHub Pages

将 `out/` 目录内容推送至 `gh-pages` 分支即可。

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

## 已知限制

- 截图功能不支持跨域视频（受浏览器 CORS 策略限制）
- 画中画功能需浏览器支持，且在 iframe 中使用时需添加 `allow="picture-in-picture"` 属性
- 播放进度存储于浏览器 localStorage，清除浏览器数据会导致进度丢失
- iOS Safari 的全屏模式仅作用于 `<video>` 元素（浏览器限制），不支持容器级全屏

## 作者

[Eq52](https://github.com/Eq52) and `GLM`

## 许可证

[MIT](LICENSE)
