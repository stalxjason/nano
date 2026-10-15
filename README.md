# NanoBanana Studio - 现代化 AI 多模态图片生成 Web UI

[![Vue 3](https://img.shields.io/badge/Vue-3.4+-4FC08D?style=flat&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4+-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

NanoBanana Studio 是一个轻量、纯前端、高性能的 AI 视觉创作 Web 应用。支持文生图（Text to Image）与图文重塑（Image to Image），可直接接入 **OpenRouter API** 或自定义中转端点（如 **CLIProxyAPI**），无需部署繁重的后端服务器。

---

## 🌟 核心功能与亮点

### ✨ 双工作流创作空间
- **文生图 (Text to Image)**：纯文本驱动的高清画面创作，提供丰富的构图、光影与艺术风格预设模板。
- **图文重塑 (Image + Text)**：支持上传多张本地参考图片，结合自然语言指导 AI 进行画面重塑、风格迁移与垫图创作。
- **参数精细调节**：支持宽高比切换（1:1、16:9、9:16、4:3、3:4 等）、专属尺寸、画质质量、Google Search 联网检索工具等。
- **多图批量渲染**：单次可批量并发生成 1 至 8 张作品，支持强制并发与平滑排队。

### 🚀 性能与体验深度优化
- 🖼️ **客户端大图智能预压缩**：针对手机/单反拍摄的数千万像素（10MB+）原图，前端通过离屏 Canvas 自动等比例缩放（最大边长 1600px）并重采样为高质量 WebP/JPEG，**缩减 80%~95% 体积**，彻底杜绝内存溢出、DOM 渲染卡死与 `413 Payload Too Large` / 网络传输超时。
- 🛑 **全流程请求中断控制 (`AbortController`)**：生成过程中随时可点击 **“中止生成 (Stop)”**，前端立即撤销并中断所有正在进行的 API 请求，避免浪费 API 额度与漫长等待。
- 🗄️ **IndexedDB 本地持久化历史**：突破传统 LocalStorage 5MB 容量上限，采用原生 IndexedDB 离线存储最近 50 条完整作品记录（包含高清画作、提示词、尺寸比例与所选模型），**页面刷新不丢失**，随时载入历史或二次创作，并支持单条删除与一键清空。
- 📦 **纯前端零依赖 ZIP 打包下载**：多图成果支持一键打包下载为 `.zip` 压缩包，毫秒级无损封装，彻底告别浏览器针对连续下载的安全弹窗拦截，且自动内附 `generation-info.txt` 记录创作参数。
- 🛡️ **并发限流池与防 HTML 污染**：
  - 批量生成时内置最大并发池控制（默认同时最多 3 个请求），避免瞬间并发打满导致第三方代理返回 `429 Too Many Requests` 限流；
  - 针对 Cloudflare 524 响应超时、Nginx 502/504 网关错误返回的 HTML 源码，自动提取标题与核心状态，呈现整洁的中文错误指引。
- ⌨️ **便捷快捷键支持**：
  - `Ctrl / ⌘ + Enter`：快速触发生成；
  - 全屏画廊灯箱下支持 `←` / `→` 键平滑切图，`ESC` 退出全屏。

---

## 🛠️ 技术栈

| 领域 | 技术方案 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | Vue 3 (Composition API, `<script setup>`) | 响应式状态管理与组件化 |
| **开发与构建** | Vite 6 | 秒级极速热重载与模块打包 |
| **编程语言** | TypeScript 5 | 严格类型检查与安全重构 |
| **样式体系** | TailwindCSS 3 + PostCSS | 精致毛玻璃与响应式暗亮配色 |
| **本地持久化** | 原生 IndexedDB + LocalStorage | 离线大图持久化与偏好配置记忆 |
| **数据流转** | 客户端 Canvas 压缩 + 纯前端 Store ZIP 打包 | 零额外重型库的高性能流式处理 |

---

## 📁 项目目录结构

```
nano-banana/
├── src/
│   ├── components/                 # UI 业务组件
│   │   ├── ApiKeyModal.vue         # API 密钥与自定义端点配置弹窗
│   │   ├── ModelSelector.vue       # 顶栏模型智能选择器
│   │   ├── ImageUpload.vue         # 参考图片上传与剪贴板/拖拽感知
│   │   ├── PresetPrompts.vue       # 灵感提示词与预设模板选择器
│   │   ├── ResultDisplay.vue       # 作品画廊、全屏灯箱、ZIP打包与历史抽屉
│   │   └── Footer.vue              # 页面页脚
│   ├── config/                     # 模型能力与端点规格
│   │   ├── api.ts                  # 端点解析与网络默认常量
│   │   ├── imageModels.ts          # 模型过滤与专属规则
│   │   └── modelCapabilities.ts   # 模型家族与比例/尺寸映射字典
│   ├── data/                       # 静态预设资源
│   │   └── templates.ts            # 风格模板与提示词预设库
│   ├── services/                   # 网络通信层
│   │   └── api.ts                  # Chat/Images API 调度、并发池、重试与错误过滤
│   ├── types/                      # TypeScript 类型定义
│   │   └── index.ts                # 请求模型、进度回调与历史记录接口
│   ├── utils/                      # 基础工具库
│   │   ├── imageCompressor.ts      # Canvas 离屏智能图片预压缩工具
│   │   ├── indexedDb.ts            # 原生 IndexedDB 历史持久化管理器
│   │   ├── storage.ts              # LocalStorage 偏好配置存取
│   │   └── zip.ts                  # 纯前端零依赖 Store ZIP 打包下载器
│   ├── App.vue                     # 主创作工作台与核心状态调度
│   ├── main.ts                     # 应用挂载入口
│   └── style.css                   # 全局样式与 Tailwind 指令
├── index.html                      # HTML 入口模板
├── package.json                    # 依赖管理与项目脚本
├── tailwind.config.js              # Tailwind 主题与样式配置
├── tsconfig.json                   # TypeScript 配置
└── vite.config.ts                  # Vite 构建配置
```

---

## 🚀 本地开发与运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动本地开发服务
```bash
npm run dev
```
打开浏览器访问控制台提示的地址（默认 `http://localhost:5173`）即可使用。

### 3. 类型检查与生产构建
```bash
# 执行严格 TypeScript 类型检查
npm run type-check

# 生产环境打包编译（产物位于 dist 目录）
npm run build

# 本地预览生产构建产物
npm run preview
```

---

## 🌐 静态托管与部署

本项目为**纯前端应用**，不依赖任何 Node.js 服务端运行时。构建生成的 `dist/` 静态文件夹可直接部署到任何静态托管平台：

- **Vercel**：导入仓库后 Framework Preset 选择 `Vite`，直接一键部署；
- **Cloudflare Pages**：连接 Git 仓库，Build command 填 `npm run build`，Build output directory 填 `dist`；
- **Netlify / GitHub Pages / Gitee Pages**：上传或自动构建 `dist` 目录即可；
- **Nginx / 静态文件服务器**：将打包后的 `dist` 目录直接映射为 Web 根目录。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
