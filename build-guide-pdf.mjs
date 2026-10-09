import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Janmejai\\.gemini\\antigravity-cli\\brain\\a01e2244-29b3-4665-a9e2-d8d621871f2c';
const MD_FILE = path.join(ARTIFACT_DIR, 'mobile-user-guide.md');
const PDF_FILE = path.join(ARTIFACT_DIR, 'mobile-user-guide.pdf');

async function buildPdf() {
  console.log('Reading markdown guide...');
  let md = fs.readFileSync(MD_FILE, 'utf-8');

  // Convert image references to base64 data URIs
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  md = md.replace(imgRegex, (match, alt, imgPath) => {
    let cleanPath = imgPath.replace(/^\//, ''); // strip leading slash if /C:/...
    if (!fs.existsSync(cleanPath)) {
      cleanPath = path.resolve(cleanPath);
    }
    if (fs.existsSync(cleanPath)) {
      const ext = path.extname(cleanPath).replace('.', '') || 'png';
      const b64 = fs.readFileSync(cleanPath).toString('base64');
      return `\n<div class="phone-mockup-wrapper"><img src="data:image/${ext};base64,${b64}" alt="${alt}" class="phone-mockup" /><p class="caption">${alt}</p></div>\n`;
    }
    return match;
  });

  // Handle carousel syntax if present
  md = md.replace(/````carousel/g, '<div class="carousel-grid">');
  md = md.replace(/<!-- slide -->/g, '');
  md = md.replace(/````/g, '</div>');

  // Parse markdown to HTML
  const bodyHtml = marked.parse(md);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ratanjee '26 - Mobile User Guide</title>
<style>
  @page {
    size: A4;
    margin: 15mm;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    line-height: 1.5;
    font-size: 11pt;
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 22pt;
    font-weight: 900;
    color: #0f172a;
    border-bottom: 3px solid #f59e0b;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: -0.5px;
  }
  h2 {
    font-size: 15pt;
    font-weight: 800;
    color: #1e293b;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 13pt;
    font-weight: 800;
    color: #334155;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h4 {
    font-size: 11pt;
    font-weight: 700;
    color: #475569;
    margin-top: 12px;
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
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 7px 10px;
    text-align: left;
  }
  th {
    background-color: #f1f5f9;
    font-weight: 800;
    color: #0f172a;
  }
  tr:nth-child(even) {
    background-color: #f8fafc;
  }
  ul, ol {
    margin: 0 0 12px 0;
    padding-left: 24px;
  }
  li {
    margin-bottom: 4px;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 9pt;
    background: #f1f5f9;
    color: #0f172a;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }
  pre {
    background: #0f172a;
    color: #f8fafc;
    padding: 12px;
    border-radius: 8px;
    font-size: 8.5pt;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code {
    background: transparent;
    color: inherit;
    border: none;
    padding: 0;
  }
  .phone-mockup-wrapper {
    text-align: center;
    margin: 16px auto;
    page-break-inside: avoid;
  }
  .phone-mockup {
    max-width: 250px;
    height: auto;
    border: 3px solid #1e293b;
    border-radius: 20px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    display: inline-block;
  }
  .caption {
    font-size: 9pt;
    color: #64748b;
    font-weight: 600;
    margin-top: 6px;
    font-style: italic;
  }
  .carousel-grid {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 14px 0;
    page-break-inside: avoid;
  }
  .carousel-grid .phone-mockup-wrapper {
    margin: 0;
  }
  .carousel-grid .phone-mockup {
    max-width: 230px;
  }
  hr {
    border: 0;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 8pt;
    font-weight: 800;
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }
</style>
</head>
<body>
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
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');

  console.log('Printing to PDF:', PDF_FILE);
  await page.pdf({
    path: PDF_FILE,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '15mm',
      right: '15mm',
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size: 8pt; color: #94a3b8; width: 100%; text-align: center; font-family: sans-serif;">XLRI Delhi • Ratanjee Memorial Trophy 2026 — Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });

  await browser.close();
  console.log('PDF generation complete!');
}

buildPdf().catch((err) => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
