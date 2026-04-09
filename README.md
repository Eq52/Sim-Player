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
- **自定义控件** — 播放/暂停、进度拖拽、音量调节、倍速切换（0.5x ~ 2x）、快进/快退
- **画中画模式** — 支持 Picture-in-Picture 浮窗播放（需浏览器支持）
- **全屏播放** — 双击或按钮切换全屏，控件在全屏下完美适配
- **视频截图** — 一键截取当前画面，自动保存为 PNG 文件
- **播放进度记忆** — 基于 localStorage 自动保存每个视频的观看进度，下次打开可恢复
- **断点续播提示** — 检测到历史进度时弹出提示，可选择跳转或忽略
- **右键菜单** — 半透明毛玻璃风格，支持查看视频参数、快捷键帮助、截图、清除缓存
- **全屏兼容** — 右键菜单与对话框在全屏模式下均可正常使用
- **响应式设计** — 全面适配桌面端、平板和手机屏幕
- **纯静态导出** — 构建产物为纯静态文件，可部署至任意静态托管平台
- **iframe 嵌入** — 可作为独立播放器嵌入其他网页

## 快速开始

### 环境要求

- Node.js 18+
- npm / bun / pnpm

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/your-username/SimPlayer.git
cd SimPlayer

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

下载 `SimPlayer-deploy.zip`，解压后将其中的所有文件上传至任意静态托管服务即可。

## 使用方式

### URL 参数

通过 URL Query 参数传入视频地址：

```
?url=https://example.com/video.mp4
?url=https://example.com/video.mp4&title=视频标题
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `url` | 视频文件地址（支持 MP4 / WebM / OGG / M3U8） | ✅ |
| `title` | 视频标题，显示在播放器顶部 | ❌ |

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
│   │   └── video-player.tsx # 核心播放器组件
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

## 作者

[Eq52](https://github.com/Eq52) and `GLM-5-Turbo`

## 许可证

[MIT](LICENSE)
