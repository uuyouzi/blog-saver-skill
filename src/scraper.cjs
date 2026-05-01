const { chromium } = require('playwright-core');
const fs = require('fs');
const { sanitizeFilename } = require('./generator.cjs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Browser Detection (cross-platform) ----

function findBrowser() {
  const candidates = [
    // Windows
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    // macOS
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Linux
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ---- Page Data Extraction ----

async function extractPageData(page) {
  return await page.evaluate(() => {
    const titleEl = document.querySelector('#activity-name')
      || document.querySelector('h1');

    const authorEl = document.querySelector('.rich_media_meta_nickname')
      || document.querySelector('#js_name')
      || document.querySelector('meta[name="author"]');

    const pubDateEl = document.querySelector('#publish_time')
      || document.querySelector('time');

    return {
      title: (titleEl && titleEl.textContent || '').trim() || document.title || '',
      author: authorEl ? (authorEl.textContent || authorEl.content || '').trim() : '',
      pubDate: (pubDateEl && pubDateEl.textContent || '').trim(),
    };
  });
}

// ---- Fix Lazy-Loaded Images & Extract HTML ----

async function extractContentHtml(page) {
  return await page.evaluate(() => {
    const container = document.querySelector('#js_content')
      || document.querySelector('article')
      || document.querySelector('.post-content')
      || document.querySelector('.entry-content')
      || document.querySelector('main')
      || document.body;

    // Swap data-src to src for lazy-loaded images
    container.querySelectorAll('img[data-src]').forEach(img => {
      if (img.dataset.src) img.src = img.dataset.src;
    });

    // Remove Weixin-specific non-content elements
    container.querySelectorAll('.rich_media_tool, .qr_code_pc, .profile_nickname_area').forEach(el => {
      el.remove();
    });

    return container.innerHTML;
  });
}

// ---- Embed Images as Base64 (offline mode) ----

async function embedImagesAsBase64(page) {
  return await page.evaluate(async () => {
    const container = document.querySelector('#js_content')
      || document.querySelector('article')
      || document.querySelector('.post-content')
      || document.querySelector('.entry-content')
      || document.querySelector('main')
      || document.body;
    if (!container) return { ok: 0, fail: 0 };

    const imgs = container.querySelectorAll('img');
    let ok = 0, fail = 0;

    for (const img of imgs) {
      let src = img.getAttribute('data-src') || img.src || '';
      if (!src || src.startsWith('data:')) continue;
      // Skip tiny images (both dimensions < 50px: icons, tracking pixels)
      if (img.offsetWidth < 50 && img.offsetHeight < 50) continue;
      // Skip hidden/invisible images
      if (img.offsetWidth === 0 && img.offsetHeight === 0) continue;
      // Skip weixin tracking pixels
      if (src.includes('mmbiz.qlogo.cn') && img.offsetWidth < 50) continue;

      try {
        const resp = await fetch(src);
        if (!resp.ok) { fail++; continue; }
        const blob = await resp.blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (base64 && base64.length > 50) {
          img.src = base64;
          img.setAttribute('data-src', base64);
          ok++;
        } else {
          fail++;
        }
      } catch (e) {
        fail++;
      }
    }

    return { ok, fail };
  });
}

// ---- Lazy Image Scrolling ----

async function scrollPage(page) {
  await page.evaluate(() => {
    return new Promise(resolve => {
      const step = 300;
      let pos = 0;
      let noGrowCount = 0;
      const interval = setInterval(() => {
        pos += step;
        window.scrollTo(0, pos);
        const height = document.documentElement.scrollHeight;
        if (pos >= height) {
          noGrowCount++;
          if (noGrowCount >= 3) {
            clearInterval(interval);
            window.scrollTo(0, 0);
            setTimeout(resolve, 1000);
          }
        } else {
          noGrowCount = 0;
        }
      }, 100);
    });
  });
  await sleep(3000);
}

// ---- Convert DOM to Markdown (runs in browser context) ----

async function extractContentMarkdown(page) {
  return await page.evaluate(() => {
    const container = document.querySelector('#js_content')
      || document.querySelector('article')
      || document.querySelector('.post-content')
      || document.querySelector('.entry-content')
      || document.querySelector('main')
      || document.body;

    // Non-content element selectors
    const skipSelector = '.rich_media_tool, .qr_code_pc, .profile_nickname_area, script, style';

    function convertNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();

      // Skip non-content elements
      if (node.matches && node.matches(skipSelector)) return '';

      switch (tag) {
        case 'h1': return '\n# ' + convertChildren(node).trim() + '\n';
        case 'h2': return '\n## ' + convertChildren(node).trim() + '\n';
        case 'h3': return '\n### ' + convertChildren(node).trim() + '\n';
        case 'h4': return '\n#### ' + convertChildren(node).trim() + '\n';
        case 'h5': return '\n##### ' + convertChildren(node).trim() + '\n';
        case 'h6': return '\n###### ' + convertChildren(node).trim() + '\n';

        case 'p': case 'section': case 'div': {
          if (tag !== 'p') {
            const hasBlockChildren = Array.from(node.children).some(c =>
              ['P', 'H1','H2','H3','H4','H5','H6','PRE','BLOCKQUOTE','UL','OL','TABLE','HR'].includes(c.tagName)
            );
            if (hasBlockChildren) return convertChildren(node);
          }
          const text = convertChildren(node).trim();
          return text ? '\n' + text + '\n' : '';
        }

        case 'br': return '\n';
        case 'hr': return '\n---\n';

        case 'strong': case 'b': {
          const inner = convertChildren(node).trim();
          return inner ? '**' + inner + '**' : '';
        }
        case 'em': case 'i': {
          const inner = convertChildren(node).trim();
          return inner ? '*' + inner + '*' : '';
        }

        case 'a': {
          const href = node.getAttribute('href') || '';
          const text = convertChildren(node).trim();
          return href ? `[${text}](${href})` : text;
        }

        case 'img': {
          const src = node.getAttribute('data-src') || node.getAttribute('src') || '';
          const alt = node.getAttribute('alt') || 'image';
          if (!src || src.startsWith('data:')) return '';
          return `\n![${alt}](${src})\n`;
        }

        case 'pre': {
          const codeEl = node.querySelector('code') || node;
          let code = codeEl.innerText || codeEl.textContent || '';
          code = code.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n').trim();
          return '\n```\n' + code + '\n```\n';
        }

        case 'code': {
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
            return node.textContent;
          }
          let code = node.textContent || '';
          code = code.replace(/`/g, '\\`');
          return '`' + code + '`';
        }

        case 'blockquote': {
          const inner = convertChildren(node).trim();
          if (!inner) return '';
          const lines = inner.split('\n');
          return '\n' + lines.map(l => l ? `> ${l}` : '>').join('\n') + '\n';
        }

        case 'ul': {
          const items = node.querySelectorAll(':scope > li');
          if (items.length === 0) return convertChildren(node);
          let result = '\n';
          items.forEach(li => {
            result += '- ' + convertChildren(li).trim().replace(/\n/g, '\n  ') + '\n';
          });
          return result;
        }

        case 'ol': {
          const items = node.querySelectorAll(':scope > li');
          if (items.length === 0) return convertChildren(node);
          let result = '\n';
          items.forEach((li, idx) => {
            result += (idx + 1) + '. ' + convertChildren(li).trim().replace(/\n/g, '\n   ') + '\n';
          });
          return result;
        }

        case 'li': return convertChildren(node);

        case 'table': {
          const rows = node.querySelectorAll('tr');
          if (rows.length === 0) return '';
          let result = '\n';
          rows.forEach((row, ri) => {
            const cells = row.querySelectorAll('th, td');
            const line = '| ' + Array.from(cells).map(c => c.textContent.trim().replace(/\n/g, ' ')).join(' | ') + ' |';
            result += line + '\n';
            if (ri === 0) {
              result += '| ' + Array.from(cells).map(() => '---').join(' | ') + ' |\n';
            }
          });
          return result;
        }

        case 'span': return convertChildren(node);

        default:
          return convertChildren(node);
      }
    }

    function convertChildren(node) {
      return Array.from(node.childNodes).map(convertNode).join('');
    }

    let md = convertChildren(container);
    md = md.replace(/\n{3,}/g, '\n\n');
    return md.trim();
  });
}

// ---- Main Scrape Function ----

async function scrape(url, options = {}) {
  const { images = false } = options;

  const browserPath = findBrowser();
  if (!browserPath) throw new Error('No browser found. Please install Microsoft Edge or Google Chrome.');

  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true
  });

  let data;
  try {
    const page = await browser.newPage();
    console.log('  Opening page...');
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.log('  (page still loading, continuing...)');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(2000);
    }
    await sleep(images ? 5000 : 3000);

    // 1. Extract metadata
    console.log('  Extracting metadata...');
    data = await extractPageData(page);

    // 2. Extract Markdown BEFORE image embedding (so MD gets original URLs, not base64)
    console.log('  Converting to Markdown...');
    data.markdown = await extractContentMarkdown(page);

    // 3. If images mode, scroll + embed as base64 (modifies DOM img.src)
    if (images) {
      console.log('  Scrolling for lazy images...');
      await scrollPage(page);
      console.log('  Embedding images as base64...');
      const { ok, fail } = await embedImagesAsBase64(page);
      console.log(`  Images: ${ok} embedded, ${fail} failed`);
    }

    // 4. Extract content HTML (after optional base64 embedding)
    console.log('  Extracting content HTML...');
    data.content = await extractContentHtml(page);

    return data;

  } finally {
    await browser.close();
  }
}

module.exports = { scrape, findBrowser };
