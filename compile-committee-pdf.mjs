import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Janmejai\\.gemini\\antigravity-cli\\brain\\a01e2244-29b3-4665-a9e2-d8d621871f2c';
const MD_FILE = path.join(ARTIFACT_DIR, 'sports-committee-guide.md');
const PDF_FILE = path.join(ARTIFACT_DIR, 'sports-committee-guide.pdf');
const PUBLIC_DOCS_DIR = 'C:\\Users\\Janmejai\\adj\\ratanji_sports\\public\\docs';
const PUBLIC_PDF_FILE = path.join(PUBLIC_DOCS_DIR, 'sports-committee-guide.pdf');

async function compilePdf() {
  console.log('Reading sports-committee-guide.md...');
  let md = fs.readFileSync(MD_FILE, 'utf-8');

  // Convert image references to base64 data URIs
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  md = md.replace(imgRegex, (match, alt, imgPath) => {
    let cleanPath = imgPath.replace(/^file:\/\/\/?/, '');
    if (cleanPath.startsWith('/') && process.platform === 'win32') {
      cleanPath = cleanPath.slice(1);
    }
    cleanPath = path.normalize(cleanPath);

    if (fs.existsSync(cleanPath)) {
      const ext = path.extname(cleanPath).replace('.', '') || 'png';
      const b64 = fs.readFileSync(cleanPath).toString('base64');
      return `\n<div class="phone-mockup-wrapper"><img src="data:image/${ext};base64,${b64}" alt="${alt}" class="phone-mockup" /><p class="caption">Figure: ${alt}</p></div>\n`;
    }
    return match;
  });

  // Handle mermaid diagrams into styled code/diagram representations
  md = md.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    return `\n<div class="diagram-box"><div class="diagram-header">Workflow Architecture</div><pre class="mermaid-code">${code.trim()}</pre></div>\n`;
  });

  const bodyHtml = marked.parse(md);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>XLRI Delhi • Ratanjee 2026 - Sports Committee Operational Manual</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 8pt;
      color: #64748b;
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    line-height: 1.55;
    font-size: 10pt;
    margin: 0;
    padding: 0;
  }
  .header-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #013B83;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .header-brand h1 {
    font-size: 20pt;
    font-weight: 900;
    color: #013B83;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: -0.5px;
  }
  .header-brand .badge {
    background-color: #013B83;
    color: #ffffff;
    font-size: 8pt;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  h1 {
    font-size: 20pt;
    font-weight: 900;
    color: #013B83;
    border-bottom: 2.5px solid #013B83;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
  }
  h2 {
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    font-weight: 700;
    color: #1e3a8a;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h4 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #334155;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }
  p {
    margin: 0 0 10px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }
  th, td {
    padding: 8px 10px;
    text-align: left;
    border: 1px solid #cbd5e1;
  }
  th {
    background-color: #013B83;
    color: #ffffff;
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  tr:nth-child(even) {
    background-color: #f8fafc;
  }
  code {
    background-color: #f1f5f9;
    padding: 2px 5px;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 8.5pt;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }
  pre {
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 12px;
    font-size: 8pt;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  blockquote {
    border-left: 4px solid #013B83;
    margin: 12px 0;
    padding: 8px 16px;
    background-color: #f0f7ff;
    color: #1e3a8a;
    font-style: italic;
    page-break-inside: avoid;
  }
  .phone-mockup-wrapper {
    text-align: center;
    margin: 18px 0;
    page-break-inside: avoid;
  }
  .phone-mockup {
    max-width: 260px;
    max-height: 440px;
    width: auto;
    height: auto;
    border-radius: 18px;
    border: 4px solid #0f172a;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
    background-color: #ffffff;
    display: inline-block;
  }
  .caption {
    font-size: 8pt;
    font-weight: 700;
    color: #64748b;
    margin-top: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .diagram-box {
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    margin: 14px 0;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .diagram-header {
    background-color: #e2e8f0;
    color: #334155;
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 6px 12px;
    border-bottom: 1px solid #cbd5e1;
  }
  .mermaid-code {
    margin: 0;
    padding: 10px 14px;
    font-size: 8pt;
    line-height: 1.4;
    color: #1e293b;
    background-color: #f8fafc;
    border: none;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }
  ul, ol {
    margin: 0 0 12px 0;
    padding-left: 22px;
  }
  li {
    margin-bottom: 4px;
  }
</style>
</head>
<body>
  <div class="header-brand">
    <div>
      <h1 style="border:none;margin:0;padding:0;font-size:18pt;">XLRI DELHI • RATANJEE 2026</h1>
      <p style="margin:2px 0 0 0;font-size:9pt;color:#64748b;font-weight:600;">Sports Committee Operational Manual & Master Guide</p>
    </div>
    <div class="badge">Official Committee Document</div>
  </div>
  ${bodyHtml}
</body>
</html>`;

  console.log('Launching headless Chrome to render PDF...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1000));

  console.log(`Generating PDF at: ${PDF_FILE}`);
  await page.pdf({
    path: PDF_FILE,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '16mm',
      bottom: '16mm',
      left: '14mm',
      right: '14mm',
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width: 100%; font-size: 8pt; color: #64748b; display: flex; justify-content: space-between; padding: 0 14mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <span>XLRI Delhi • Ratanjee 2026 — Sports Committee Operational Manual</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
  });

  // Copy to public/docs for live web hosting
  if (!fs.existsSync(PUBLIC_DOCS_DIR)) {
    fs.mkdirSync(PUBLIC_DOCS_DIR, { recursive: true });
  }
  fs.copyFileSync(PDF_FILE, PUBLIC_PDF_FILE);
  console.log(`Copied PDF to web directory: ${PUBLIC_PDF_FILE}`);

  await browser.close();
  console.log('PDF compilation completed successfully!');
}

compilePdf().catch((err) => {
  console.error('PDF generation error:', err);
  process.exit(1);
});
