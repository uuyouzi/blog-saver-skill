const { scrape } = require('./scraper.cjs');
const { saveHtml, saveMarkdown } = require('./generator.cjs');
const fs = require('fs');
const path = require('path');

// Default output: current directory's "output" subfolder
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'output');

// ---- Argument Parsing ----

function parseArgs(argv) {
  const args = argv.slice(2);
  const url = args.find(a => a.startsWith('http'));

  const flags = {
    images: args.includes('--images') || args.includes('-i'),
    help: args.includes('--help') || args.includes('-h'),
  };

  const outputIdx = Math.max(args.indexOf('--output'), args.indexOf('-o'));
  flags.outputDir = outputIdx !== -1 && args[outputIdx + 1]
    ? args[outputIdx + 1]
    : DEFAULT_OUTPUT_DIR;

  const tagsIdx = Math.max(args.indexOf('--tags'), args.indexOf('-t'));
  flags.tags = tagsIdx !== -1 && args[tagsIdx + 1]
    ? args[tagsIdx + 1]
    : '';

  return { url, ...flags };
}

// ---- File Size Helper ----

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

// ---- Main ----

async function main() {
  const { url, images, help, outputDir, tags } = parseArgs(process.argv);

  if (!url || help) {
    console.error('Usage: blog-saver <url> [--images] [--output <dir>] [--tags "tag1, tag2"]');
    console.error('');
    console.error('Options:');
    console.error('  --images, -i     Embed images as base64 in HTML (offline-capable, larger HTML file)');
    console.error('                   Without this: images use CDN URLs (smaller, needs internet)');
    console.error('  --output, -o     Output directory (default: ./output)');
    console.error('  --tags, -t       Comma-separated tags (e.g. "CVE, Windows, privilege-escalation")');
    console.error('  --help, -h       Show this help message');
    console.error('');
    console.error('Output: Saves both .html (for reading) and .md (for AI) simultaneously.');
    process.exit(help ? 0 : 1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const saveDate = new Date().toISOString().split('T')[0];

  console.log(`[1/3] Scraping: ${url}`);

  const data = await scrape(url, { images, outputDir });

  if (!data.title) {
    console.error('[ERROR] Failed to extract article title. Page may not have loaded correctly.');
    process.exit(1);
  }

  console.log(`  Title: ${data.title}`);
  if (data.author) console.log(`  Author: ${data.author}`);
  if (data.pubDate) console.log(`  Date: ${data.pubDate}`);
  console.log(`  HTML content: ${(data.content.length / 1024).toFixed(1)}KB`);
  console.log(`  Markdown content: ${(data.markdown.length / 1024).toFixed(1)}KB`);
  if (tags) console.log(`  Tags: ${tags}`);

  console.log('[2/3] Generating HTML...');
  const { htmlPath } = saveHtml(data, { url, saveDate, outputDir, tags });

  console.log('[3/3] Generating Markdown...');
  const { mdPath } = saveMarkdown(data, { url, saveDate, outputDir, tags });

  // Report results
  const htmlSize = fs.statSync(htmlPath).size;
  const mdSize = fs.statSync(mdPath).size;
  const imgNote = images ? ' (images embedded)' : ' (images via CDN)';

  console.log(`\n[DONE] Saved 2 files:`);
  console.log(`  HTML:  ${htmlPath}  (${formatSize(htmlSize)}${imgNote})`);
  console.log(`  MD:    ${mdPath}  (${formatSize(mdSize)})`);
}

main().catch(err => {
  console.error(`\n[ERROR] ${err?.message || err}`);
  process.exit(1);
});
