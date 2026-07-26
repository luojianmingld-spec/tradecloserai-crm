// HTML-to-PDF via headless Chromium (zero npm deps, system chromium-browser)
// - Supports all languages (CJK/Arabic/Cyrillic/etc) via Noto fonts
// - Proper markdown table rendering, headings, lists
// - A4 page with header/footer
//
// Exports: generatePdf({ title, content, companyName, docType, lang }) => Promise<Buffer>

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const COMPANY = '海南金至晶国际贸易有限公司 · Hainan Jinzhijing International Trade Co., Ltd.';
const WORK_DIR = '/root/crm-pdf-tmp';

function ensureDir() {
  try { fs.mkdirSync(WORK_DIR, { recursive: true }); } catch(e) {}
}

// Minimal markdown → HTML converter (supports: headings, paragraphs, bold, italic, inline code, tables, lists, hr)
function mdToHtml(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let i = 0;
  const flushList = (type, items) => {
    if (!items.length) return '';
    const tag = type === 'ol' ? 'ol' : 'ul';
    return `<${tag}>` + items.map(it => `<li>${inlineFmt(it)}</li>`).join('') + `</${tag}>`;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hm = /^(#{1,4})\s+(.*)$/.exec(line);
    if (hm) {
      const lvl = hm[1].length;
      html += `<h${lvl}>${inlineFmt(hm[2].trim())}</h${lvl}>`;
      i++; continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += '<hr/>'; i++; continue;
    }

    // Table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i+1])) {
      const headers = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      html += '<table><thead><tr>' + headers.map(h => `<th>${inlineFmt(h)}</th>`).join('') + '</tr></thead><tbody>';
      for (const r of rows) {
        html += '<tr>' + r.map(c => `<td>${inlineFmt(c)}</td>`).join('') + '</tr>';
      }
      html += '</tbody></table>';
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+(.*)$/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, '').trim());
        i++;
      }
      html += flushList('ul', items);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+(.*)$/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      html += flushList('ol', items);
      continue;
    }

    // Empty line
    if (!line.trim()) { i++; continue; }

    // Paragraph (collect contiguous non-empty, non-special lines)
    let buf = line.trim();
    i++;
    while (i < lines.length && lines[i].trim()
      && !/^#{1,4}\s+/.test(lines[i])
      && !/^\s*[-*+]\s+/.test(lines[i])
      && !/^\s*\d+\.\s+/.test(lines[i])
      && !/^\s*\|.*\|\s*$/.test(lines[i])
      && !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      buf += ' ' + lines[i].trim();
      i++;
    }
    html += `<p>${inlineFmt(buf)}</p>`;
  }
  return html;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map(c => c.trim().replace(/\\\|/g, '|'));
}

function inlineFmt(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
}

function buildHtml({ title, content, companyName = COMPANY }) {
  const bodyHtml = mdToHtml(content);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${inlineFmt(title)}</title>
<style>
@page { size: A4; margin: 15mm; margin-top: 20mm; margin-bottom: 15mm; }
* { box-sizing: border-box; }
body {
  font-family: "Noto Sans CJK SC","Noto Sans","WenQuanYi Micro Hei","Microsoft YaHei",Arial,sans-serif;
  font-size: 10.5pt; color: #1a2329; line-height: 1.55; margin:0; padding:0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.doc-header {
  text-align: center; font-size: 9pt; color: #8696a0;
  border-bottom: 1px solid #d1d7db; padding-bottom: 6px; margin-bottom: 14px;
}
.doc-title {
  text-align: center; font-size: 19pt; font-weight: 700; color: #7c3aed;
  margin: 6px 0 16px 0; letter-spacing: 0.5px;
}
h1.doc-title-first {
  text-align: center; font-size: 19pt; font-weight: 700; color: #7c3aed;
  margin: 6px 0 16px 0; letter-spacing: 0.5px;
  padding-bottom: 8px; border-bottom: 2px solid #7c3aed;
}
body > h1:first-of-type { text-align: center; font-size: 19pt; font-weight: 700; color: #7c3aed; margin: 6px 0 18px 0; letter-spacing: 0.5px; padding-bottom: 10px; border-bottom: 2px solid #7c3aed; }
h1 { font-size: 16pt; color: #1a2329; margin: 18px 0 10px; padding-bottom:5px; border-bottom:2px solid #7c3aed; }
h2 { font-size: 13pt; color: #1a2329; margin: 16px 0 8px; }
h3 { font-size: 11.5pt; color: #3b4a54; margin: 12px 0 6px; }
h4 { font-size: 10.5pt; color: #3b4a54; margin: 10px 0 5px; }
p { margin: 6px 0; }
ul, ol { margin: 6px 0; padding-left: 22px; }
li { margin: 3px 0; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; page-break-inside: avoid; }
th { background: #7c3aed; color: #fff; padding: 7px 8px; text-align: left; font-weight: 600; border: 1px solid #6d28d9; }
td { border: 1px solid #d1d7db; padding: 6px 8px; vertical-align: top; }
tr:nth-child(even) td { background: #f7f5fc; }
code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-family: "Courier New", monospace; font-size: 9.5pt; }
hr { border: none; border-top: 1px solid #d1d7db; margin: 14px 0; }
b, strong { font-weight: 700; }
i { font-style: italic; }
.doc-footer {
  position: fixed; bottom: 8mm; left: 0; right: 0; text-align: center;
  font-size: 8pt; color: #8696a0;
}
@page { @bottom-center { content: "Page " counter(page) " / " counter(pages); font-size: 8pt; color: #8696a0; } }
</style></head>
<body>
<div class="doc-header">${companyName}</div>
${bodyHtml}
</body></html>`;
}

/**
 * Generate PDF buffer from markdown content using headless Chromium.
 * @param {{title:string, content:string, companyName?:string, docType?:string, lang?:string}} opts
 * @returns {Promise<Buffer>}
 */
export async function generatePdf(opts = {}) {
  const { title = 'Document', content = '', companyName = COMPANY } = opts;
  ensureDir();

  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const htmlPath = path.join(WORK_DIR, `doc_${id}.html`);
  const pdfPath = path.join(WORK_DIR, `doc_${id}.pdf`);

  const html = buildHtml({ title, content, companyName });
  fs.writeFileSync(htmlPath, html, 'utf8');

  try {
    await new Promise((resolve, reject) => {
      const args = [
        '--headless',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        `--print-to-pdf=${pdfPath}`,
        '--no-pdf-header-footer',
        `file://${htmlPath}`,
      ];
      const child = spawn('chromium-browser', args, {
        timeout: 45000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, HOME: '/root', DISPLAY: '' },
      });
      let stderr = '';
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0 && fs.existsSync(pdfPath)) resolve();
        else reject(new Error(`chromium exit ${code}: ${stderr.slice(-300)}`));
      });
    });

    const buf = fs.readFileSync(pdfPath);
    return buf;
  } finally {
    try { fs.unlinkSync(htmlPath); } catch(e) {}
    try { fs.unlinkSync(pdfPath); } catch(e) {}
  }
}

export default generatePdf;
