---
name: blog-saver
description: "网页文章抓取技能。通过 CLI 工具一键保存微信/博客文章，同时输出 HTML（阅读）+ Markdown（AI）双格式。可选图片内嵌（离线可用）。"
description_zh: "网页文章抓取 → HTML + Markdown 双格式归档"
description_en: "Scrape web articles, save as HTML + Markdown"
version: 2.1.0
allowed-tools: Read,Bash
metadata:
  clawdbot:
    emoji: "📄"
    requires:
      bins:
        - node
---

# 网页文章抓取

## 适用场景

以下任意一种表达方式都应触发此技能：

- 直接给链接："帮我保存这篇文章 https://..."
- 保存指令 + 地址："保存文章 https://..." 或 "保存文章到某个路径"
- 关键词触发："帮我抓取这个链接"、"把这个网页存下来"
- 转存归档："把这篇文章转为文件"、"帮我存到稍后读"

**URL 来源可以是**：
1. 用户直接提供的完整 URL（最常见）
2. 用户提供的搜索关键词 → 先用 `wechat-article-search` skill 搜索获取链接，再执行抓取

## 前置准备

### 安装依赖

```bash
cd <BLOG-SAVER-ROOT>
npm install
```

### 配置路径

修改下方的 `CLI_ROOT` 和 `DEFAULT_OUTPUT_DIR` 为你实际的安装路径和期望的输出目录。

```
CLI_ROOT = <BLOG-SAVER-ROOT>        # 项目根目录
DEFAULT_OUTPUT_DIR = <OUTPUT-DIR>    # 文章保存目录
```

## 工作流程

### 步骤1: 解析用户意图

从用户输入中提取：

1. **URL** — 直接链接或需要先搜索
2. **保存路径**（可选） — 用户指定则用指定的，未指定则使用默认输出目录
3. **是否需要图片** — 仅当用户明确说"带图片"、"连图片一起"、"图片也保存"、"离线看"等时才启用 `--images`
4. **标签**（可选） — 根据文章内容提取 3~8 个关键词

如果用户只给了关键词但没有链接，先使用 `wechat-article-search` skill 搜索获取链接。

### 步骤2: 运行 CLI 工具

**默认模式（无图片，文件小）**：
```bash
node <CLI_ROOT>/src/index.cjs "<URL>"
```

**带标签**（推荐，Agent 根据文章内容自动提取）：
```bash
node <CLI_ROOT>/src/index.cjs "<URL>" --tags "标签1, 标签2, 标签3"
```

**图片模式**（用户明确要求保存图片时，图片内嵌为 base64，离线可用）：
```bash
node <CLI_ROOT>/src/index.cjs "<URL>" --images
```

**组合使用**：
```bash
node <CLI_ROOT>/src/index.cjs "<URL>" --images --tags "标签1, 标签2"
```

**指定输出目录**：
```bash
node <CLI_ROOT>/src/index.cjs "<URL>" --output "<自定义路径>"
```

工具自动完成：浏览器打开 → 提取内容 → 生成 HTML + Markdown 两个文件。
工具输出包含两个文件的保存路径和大小，直接报告给用户即可。

**注意**：不需要手动写脚本、不需要读中间文件、不需要手动生成任何内容。

### 步骤3: 展示结果

- 告诉用户文件保存路径（HTML + MD 两个文件）
- 用 `preview_url` 展示生成的 HTML 文件（用于阅读预览）
- 告知用户 MD 文件适合给 AI 模型查看（token 开销小）
- 如果工具报错，将错误信息报告给用户

## 输出格式

**每次抓取同时输出两个文件**，同一文件名，不同扩展名：

### 1. HTML 文件（供人阅读）

- 保留原始排版（代码块、表格、列表、图片等完全还原）
- 内置阅读样式（干净的排版，类似微信读书风格）
- 元信息头（来源、作者、原文链接、标签）
- `<meta name="referrer" content="no-referrer">` 确保外部图片能正常加载
- 双击即可在浏览器中打开

### 2. Markdown 文件（供 AI 模型）

- token 开销小，适合粘贴给 AI 对话
- 代码块、表格、列表、引用等结构化内容完整保留
- 元信息以 blockquote 头部呈现（来源、日期、链接、标签）
- 图片保留 URL 外链（不内嵌，保持文件小）

### 图片模式对比

| 模式 | 命令 | HTML 图片处理 | MD 图片 | 适用场景 |
|------|------|-------------|---------|---------|
| 默认 | 无 `--images` | 图片保留 CDN 外链 | URL 外链 | 日常抓取，联网可用 |
| 图片模式 | `--images` | 图片内嵌为 base64 | URL 外链 | 需要离线阅读 HTML |

> **注意**：Markdown 文件始终使用 URL 外链（不内嵌图片），因为 MD 主要给 AI 看，不需要离线图片。

## 工具说明

| 文件 | 说明 |
|---|---|
| `src/index.cjs` | CLI 入口（参数解析 + 流程编排） |
| `src/scraper.cjs` | Playwright 抓取（HTML 提取 + DOM→MD 转换 + 可选 base64 图片嵌入） |
| `src/generator.cjs` | HTML 模板 + Markdown 模板生成 + 文件保存 |

### CLI 参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `<url>` | — | 文章 URL（必须） |
| `--images` | `-i` | HTML 中嵌入图片为 base64（离线可用，HTML 文件较大） |
| `--output` | `-o` | 输出目录（默认：`./output`） |
| `--tags` | `-t` | 标签，逗号分隔（如 `"CVE, Windows, 提权"`） |

### 依赖

- `playwright-core`（需 `npm install`）
- 系统浏览器 Edge 或 Chrome（自动检测）

### 降级策略

```
blog-saver CLI（默认）→ 失败 → Agent Browser（如可用）→ 失败 → 提示用户手动复制
```

## 注意事项

- 仅用于个人学习和知识管理，请勿用于商业用途或大规模爬取
- 遵守目标网站的使用条款和 robots.txt 规则
- 尊重文章版权，转载请注明出处
