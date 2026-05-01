# blog-saver

一键抓取网页文章，同时输出 **HTML**（供阅读）+ **Markdown**（供 AI）双格式。

## 特性

- 双格式输出：HTML 保留原始排版，Markdown 节省 token
- 支持微信公众号、知乎、掘金、CSDN、GitHub、看雪论坛、FreeBuf 等主流平台
- 图片可选 CDN 外链（文件小）或 base64 嵌入（离线可用）
- 使用 Playwright-Core + 系统浏览器，无需安装额外浏览器
- 跨平台：Windows / macOS / Linux

## 安装

```bash
# 1. 克隆项目
git clone https://github.com/<your-username>/blog-saver.git
cd blog-saver

# 2. 安装依赖
npm install
```

> 需要系统已安装 Microsoft Edge 或 Google Chrome。

## 用法

### 基本用法（默认模式，图片用 CDN 外链）

```bash
node src/index.cjs "https://mp.weixin.qq.com/s/xxxxx"
```

输出到 `./output/` 目录。

### 带图片（base64 嵌入，离线可用）

```bash
node src/index.cjs "https://mp.weixin.qq.com/s/xxxxx" --images
```

### 带标签

```bash
node src/index.cjs "https://mp.weixin.qq.com/s/xxxxx" --tags "CVE, Windows, 提权"
```

### 指定输出目录

```bash
node src/index.cjs "https://mp.weixin.qq.com/s/xxxxx" --output ~/Desktop/articles
```

### 组合使用

```bash
node src/index.cjs "https://mp.weixin.qq.com/s/xxxxx" --images --tags "安全, AI" --output ./saved
```

## CLI 参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `<url>` | — | 文章 URL（必须） |
| `--images` | `-i` | HTML 中嵌入图片为 base64（离线可用，文件较大） |
| `--output` | `-o` | 输出目录（默认：`./output`） |
| `--tags` | `-t` | 标签，逗号分隔（如 `"CVE, Windows, 提权"`） |

## 输出示例

每次抓取同时生成两个文件：

```
output/
├── 文章标题.html    # 双击即可阅读，保留原始排版
└── 文章标题.md      # 纯文本，适合给 AI 模型查看
```

### HTML vs Markdown 对比

| | HTML | Markdown |
|---|---|---|
| 用途 | 人眼阅读 | AI 模型查看 |
| 排版 | 完整保留（代码块、表格、图片） | 结构化文本 |
| 图片 | CDN 外链 / base64 嵌入 | 始终 URL 外链 |
| 文件大小 | ~100KB - 5MB | ~2KB - 20KB |

## 支持的平台

| 平台 | 状态 |
|------|------|
| 微信公众号 | 已测试 |
| 知乎 | 已测试 |
| 掘金 | 已测试 |
| CSDN | 已测试 |
| GitHub | 已测试 |
| 看雪论坛 | 已测试 |
| FreeBuf | 已测试 |
| 其他网页 | 基本支持 |

## 技术栈

- **Playwright-Core** — 无头浏览器，使用系统已安装的 Edge/Chrome
- **Node.js** — 运行时（>= 18）

## 项目结构

```
blog-saver/
├── src/
│   ├── index.cjs        # CLI 入口（参数解析 + 流程编排）
│   ├── scraper.cjs      # Playwright 抓取（HTML 提取 + DOM→MD 转换 + base64 图片嵌入）
│   └── generator.cjs    # HTML/Markdown 模板生成 + 文件保存
├── package.json
├── .gitignore
└── README.md
```

## License

MIT
