const fs = require('fs');
const path = require('path');

// ---- Filename Utilities ----

function sanitizeFilename(name) {
  return (name || 'untitled')
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 150)
    .replace(/^-+|-+$/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function detectPlatform(url) {
  if (/mp\.weixin\.qq\.com/.test(url)) return '微信公众号';
  if (/zhihu\.com/.test(url)) return '知乎';
  if (/juejin\.cn/.test(url)) return '掘金';
  if (/csdn\.net/.test(url)) return 'CSDN';
  if (/bilibili\.com/.test(url)) return '哔哩哔哩';
  if (/github\.com/.test(url)) return 'GitHub';
  if (/kanxue\.com/.test(url)) return '看雪论坛';
  if (/freebuf\.com/.test(url)) return 'FreeBuf';
  if (/segfault\.fault\.cn/.test(url)) return '思否';
  return '网页';
}

// ---- HTML Template ----

function buildHtml(data, options) {
  const { title, author, content } = data;
  const { url, saveDate, tags } = options;
  const platform = detectPlatform(url);

  const sourceLine = author
    ? `${platform}「${author}」`
    : platform;

  let tagsHtml = '';
  if (tags) {
    const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagArr.length > 0) {
      tagsHtml = `<div class="tags">${tagArr.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
                   "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      line-height: 1.8; color: #333; background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 800px; margin: 0 auto; background: #fff;
      padding: 40px 48px; border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    @media (max-width: 640px) {
      .container { padding: 20px 16px; }
    }
    h1.article-title {
      font-size: 24px; line-height: 1.4; margin-bottom: 20px;
      color: #1a1a1a; word-break: break-word;
    }
    .meta {
      font-size: 14px; color: #888; margin-bottom: 12px;
      padding-bottom: 16px; border-bottom: 1px solid #eee;
    }
    .meta-item { margin-right: 20px; }
    .meta-link { color: #576b95; text-decoration: none; }
    .meta-link:hover { text-decoration: underline; }
    .tags { margin-bottom: 24px; }
    .tags span {
      display: inline-block; background: #f0f2f5; color: #666;
      padding: 2px 10px; border-radius: 3px; margin: 2px 4px 2px 0;
      font-size: 12px; line-height: 1.8;
    }
    .content { font-size: 16px; line-height: 1.8; word-break: break-word; }
    .content img {
      max-width: 100%; height: auto; border-radius: 4px; margin: 16px 0;
      display: block;
    }
    .content pre {
      background: #f6f8fa; padding: 16px 20px; border-radius: 6px;
      overflow-x: auto; font-size: 14px; line-height: 1.6;
      margin: 16px 0; border: 1px solid #eee;
    }
    .content code {
      font-family: "Fira Code", "Source Code Pro", Consolas, monospace;
      font-size: 0.9em;
    }
    .content p code {
      background: #f0f2f5; padding: 2px 6px; border-radius: 3px;
      font-size: 0.85em;
    }
    .content blockquote {
      border-left: 4px solid #ddd; padding: 8px 16px;
      color: #666; margin: 16px 0; background: #fafafa;
    }
    .content table {
      border-collapse: collapse; width: 100%; margin: 16px 0;
      font-size: 14px;
    }
    .content th, .content td {
      border: 1px solid #ddd; padding: 8px 12px; text-align: left;
    }
    .content th { background: #f5f5f5; font-weight: 600; }
    .content a { color: #576b95; text-decoration: none; }
    .content a:hover { text-decoration: underline; }
    .content h1, .content h2, .content h3,
    .content h4, .content h5, .content h6 {
      margin: 24px 0 12px; line-height: 1.4;
    }
    .content h1 { font-size: 22px; }
    .content h2 { font-size: 20px; }
    .content h3 { font-size: 18px; }
    .content ul, .content ol { padding-left: 24px; margin: 8px 0; }
    .content li { margin: 4px 0; }
    .content hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
    .footer {
      margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;
      font-size: 13px; color: #999; text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="article-title">${escapeHtml(title)}</h1>
    <div class="meta">
      <span class="meta-item">来源：${escapeHtml(sourceLine)}</span>
      <span class="meta-item">抓取时间：${saveDate}</span>
      <span class="meta-item"><a class="meta-link" href="${escapeHtml(url)}" target="_blank">原文链接</a></span>
    </div>
    ${tagsHtml}
    <div class="content">
${content}
    </div>
    <div class="footer">本文由 blog-saver 自动抓取保存，仅供个人学习参考。</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Markdown Template ----

function buildMarkdown(data, options) {
  const { title, author, pubDate, markdown: content } = data;
  const { url, saveDate, tags } = options;
  const platform = detectPlatform(url);

  const sourceLine = author
    ? `${platform}「${author}」`
    : platform;

  let header = `# ${title}\n\n`;
  header += `> 来源：${sourceLine}\n`;
  if (pubDate) header += `> 日期：${pubDate}\n`;
  header += `> 抓取时间：${saveDate}\n`;
  header += `> 链接：[${url}](${url})\n`;
  if (tags) header += `> 标签：${tags}\n`;

  header += '\n---\n\n';

  return header + (content || '');
}

// ---- Save to File ----

function saveHtml(data, options) {
  const { url, saveDate, outputDir, tags } = options;
  const safeTitle = sanitizeFilename(data.title);
  const filename = `${saveDate}_${safeTitle}`;
  const html = buildHtml(data, { url, saveDate, tags });
  const htmlPath = path.join(outputDir, filename + '.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  return { htmlPath, safeTitle: filename };
}

function saveMarkdown(data, options) {
  const { url, saveDate, outputDir, tags } = options;
  const safeTitle = sanitizeFilename(data.title);
  const filename = `${saveDate}_${safeTitle}`;
  const md = buildMarkdown(data, { url, saveDate, tags });
  const mdPath = path.join(outputDir, filename + '.md');
  fs.writeFileSync(mdPath, md, 'utf-8');
  return { mdPath, safeTitle: filename };
}

module.exports = { sanitizeFilename, detectPlatform, buildHtml, saveHtml, buildMarkdown, saveMarkdown };
