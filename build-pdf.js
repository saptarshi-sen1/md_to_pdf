#!/usr/bin/env node
/*
 * markdown -> PDF with rendered mermaid diagrams.
 *
 * Why a custom tool? off-the-shelf markdown->PDF converters (md-to-pdf,
 * pandoc, etc.) print ```mermaid blocks as literal code. This script:
 *   1. parses the markdown into HTML (marked + highlight.js),
 *   2. turns every ```mermaid fence into a renderable <pre class="mermaid">,
 *   3. loads the page in headless Chromium (puppeteer),
 *   4. lets mermaid draw every diagram (flowchart / sequence / mindmap),
 *   5. prints to PDF with break-inside:avoid so diagrams never split across pages.
 *
 * Usage:
 *   node build-pdf.js <input.md> [output.pdf]
 *
 *   input.md    markdown file to convert (required unless being run from the
 *               USC KIIT repo, where it defaults to ../UiPath_Handbook.md)
 *   output.pdf  optional; defaults to the input path with a .pdf extension
 *
 * Examples:
 *   node build-pdf.js report.md                 -> report.pdf
 *   node build-pdf.js ../Handbook.md out.pdf    -> explicit output
 *
 * Run:  npm install   then   node build-pdf.js <input.md> [output.pdf]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const puppeteer = require('puppeteer');

/* --- CLI args ------------------------------------------------ */

const args = process.argv.slice(2);

function resolveFromCwd(p) {
  return path.resolve(process.cwd(), p);
}

let INPUT;
let OUTPUT;

if (args.length > 0) {
  INPUT = resolveFromCwd(args[0]);
  OUTPUT = args[1]
    ? resolveFromCwd(args[1])
    : INPUT.replace(/\.md$/i, '.pdf');
} else {
  // Compatibility default when run from inside the USC KIIT repo.
  INPUT = path.resolve(__dirname, '..', 'UiPath_Handbook.md');
  OUTPUT = path.join(path.dirname(INPUT), 'UiPath_Handbook.pdf');
}

if (!path.extname(OUTPUT)) OUTPUT += '.pdf';

if (!fs.existsSync(INPUT)) {
  console.error('Input file not found: ' + INPUT);
  console.error('Usage: node build-pdf.js <input.md> [output.pdf]');
  process.exit(1);
}

function readNodeModule(...segments) {
  return fs.readFileSync(path.join(__dirname, 'node_modules', ...segments), 'utf8');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* --- markdown -> HTML ------------------------------------------------ */

const renderer = new marked.Renderer();

renderer.code = function (code, infostring) {
  const lang = String(infostring || '').split(/\s+/)[0].toLowerCase();

  if (lang === 'mermaid') {
    return '<pre class="mermaid">' + escapeHtml(code).trim() + '</pre>';
  }

  if (lang && hljs.getLanguage(lang)) {
    try {
      return '<pre><code class="hljs language-' + lang + '">' +
        hljs.highlight(code, { language: lang }).value + '</code></pre>';
    } catch (_) { /* fall through to plain */ }
  }

  return '<pre><code class="hljs">' + escapeHtml(code) + '</code></pre>';
};

marked.setOptions({ renderer, gfm: true, breaks: false, headerIds: false, mangle: false });

const css =
  fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8') +
  fs.readFileSync(path.join(__dirname, 'node_modules', 'highlight.js', 'styles', 'github.css'), 'utf8');

const mermaidApi = readNodeModule('mermaid', 'dist', 'mermaid.min.js');
const docTitle = path.basename(INPUT).replace(/\.md$/i, '');

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><title>${docTitle}</title><style>${css}</style></head>
<body>
<article class="markdown-body">${marked.parse(fs.readFileSync(INPUT, 'utf8'))}</article>
<script>${mermaidApi}
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'default',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  flowchart: { htmlLabels: true, curve: 'basis' },
  sequence:  { useMaxWidth: true },
  mindmap:   { useMaxWidth: true }
});
window.__render = function () {
  const blocks = Array.from(document.querySelectorAll('pre.mermaid'));
  if (blocks.length === 0) return Promise.resolve({ total: 0, rendered: 0, failed: [] });
  return mermaid.run({ nodes: blocks }).catch(function (e) {
    window.__mermaidError = e && e.message ? e.message : String(e);
  }).then(function () {
    const failed = blocks
      .filter(function (p) { return !p.querySelector('svg'); })
      .map(function (p) { return (p.textContent.match(/^\\s*([^\\n]+)/) || ['?'])[0]; });
    return { total: blocks.length, rendered: blocks.length - failed.length, failed: failed };
  });
};
</script>
</body>
</html>`;

/* --- headless Chromium -> PDF --------------------------------------- */

(async () => {
  console.log('Input :', INPUT);
  console.log('Output:', OUTPUT);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction('typeof mermaid !== "undefined"', { timeout: 60000 });

    const report = await page.evaluate(() => window.__render());
    console.log(`Diagrams: ${report.total} total, ${report.rendered} rendered`);
    if (report.failed.length > 0) {
      console.warn('WARNING - ' + report.failed.length + ' diagram(s) did not render:');
      report.failed.forEach((f) => console.warn('  - ' + f.slice(0, 100)));
    }

    const debugHtml = path.join(os.tmpdir(), 'handbook-pdf-debug.html');
    fs.writeFileSync(debugHtml, html);
    console.log('Debug HTML:', debugHtml);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      margin: { top: '13mm', bottom: '13mm', left: '12mm', right: '12mm' },
    });

    fs.writeFileSync(OUTPUT, pdf);
    console.log('PDF written:', OUTPUT, '(' + (pdf.length / 1024 / 1024).toFixed(2) + ' MB)');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});