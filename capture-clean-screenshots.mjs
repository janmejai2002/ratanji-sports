import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Janmejai\\.gemini\\antigravity-cli\\brain\\a01e2244-29b3-4665-a9e2-d8d621871f2c';
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // 1. Mobile viewport in XLRI Light Theme (Match Center)
  console.log('Navigating to http://localhost:5173 (Mobile Light)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2000));

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-matchcenter.png'),
    fullPage: false,
  });
  console.log('Saved xlri-light-mobile-matchcenter.png');

  // 2. Desktop viewport in XLRI Light Theme (Match Center)
  console.log('Navigating to http://localhost:5173 (Desktop Light)...');
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'xlri-light-desktop-matchcenter.png'),
    fullPage: false,
  });
  console.log('Saved xlri-light-desktop-matchcenter.png');

  // 3. Mobile Standings Tab
  console.log('Switching to Standings tab...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.textContent && el.textContent.includes('Standings'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-standings.png'),
    fullPage: false,
  });
  console.log('Saved xlri-light-mobile-standings.png');

  // 4. Mobile Contingents Tab
  console.log('Switching to Contingents tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.textContent && el.textContent.includes('Contingents'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-contingents.png'),
    fullPage: false,
  });
  console.log('Saved xlri-light-mobile-contingents.png');

  // 5. Sports Committee Login & Portal
  console.log('Opening Sports Committee Portal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.textContent && (el.textContent.includes('Committee') || el.textContent.includes('Admin')));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-committee-login.png'),
    fullPage: false,
  });
  console.log('Saved xlri-light-mobile-committee-login.png');

  // Perform committee admin login
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const emailInput = inputs.find((i) => i.type === 'email' || i.placeholder?.includes('admin'));
    const passInput = inputs.find((i) => i.type === 'password');
    if (emailInput) {
      emailInput.value = 'admin@sports.xlridelhi.ac.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (passInput) {
      passInput.value = 'xlri-admin-2026';
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) => b.type === 'submit' || b.textContent?.includes('Sign In') || b.textContent?.includes('Access'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'xlri-light-mobile-admin-portal.png'),
    fullPage: false,
  });
  console.log('Saved xlri-light-mobile-admin-portal.png');

  // 6. Dark Theme
  console.log('Toggling Dark Theme...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate(() => {
    const themeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.title?.includes('Theme') || b.title?.includes('Mode') || b.textContent?.includes('Light') || b.textContent?.includes('Dark'));
    if (themeBtn) themeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'xlri-dark-mobile-matchcenter.png'),
    fullPage: false,
  });
  console.log('Saved xlri-dark-mobile-matchcenter.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
