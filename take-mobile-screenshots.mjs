import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_DIR = 'C:\\Users\\Janmejai\\.gemini\\antigravity-cli\\brain\\a01e2244-29b3-4665-a9e2-d8d621871f2c\\screenshots';
const BASE_URL = 'http://localhost:5173';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  console.log('1. Navigating to Match Center...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(TARGET_DIR, '01-mobile-match-center.png'),
    fullPage: false,
  });
  console.log('Saved 01-mobile-match-center.png');

  console.log('2. Navigating to Contingents Tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.innerText.includes('Contingents'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({
    path: path.join(TARGET_DIR, '02-mobile-contingents.png'),
    fullPage: false,
  });
  console.log('Saved 02-mobile-contingents.png');

  console.log('3. Opening Login Modal (Referee View)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.innerText.includes('Referee Access') || el.innerText.includes('Sign In'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({
    path: path.join(TARGET_DIR, '03a-mobile-login-referee.png'),
    fullPage: false,
  });
  console.log('Saved 03a-mobile-login-referee.png');

  console.log('4. Switching to Committee Admin Login View...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const committeeTab = btns.find((el) => el.innerText.includes('Sports Committee Admin'));
    if (committeeTab) committeeTab.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({
    path: path.join(TARGET_DIR, '03b-mobile-login-committee.png'),
    fullPage: false,
  });
  console.log('Saved 03b-mobile-login-committee.png');

  console.log('5. Authenticating as Committee Admin...');
  const textInput = await page.$('input[placeholder="admin@xlri.edu"]');
  if (textInput) {
    await textInput.click({ clickCount: 3 });
    await page.keyboard.type('admin@sports.xlridelhi.ac.in');
  }
  const passInput = await page.$('input[type="password"]');
  if (passInput) {
    await passInput.click({ clickCount: 3 });
    await page.keyboard.type('xlri-admin-2026');
  }

  await page.evaluate(() => {
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Sign In with Committee Credentials'));
    if (submitBtn) submitBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1600));

  // If Admin tab is not open, switch to Admin
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const adminBtn = btns.find((el) => el.innerText.includes('Admin') || el.innerText.includes('Committee'));
    if (adminBtn) adminBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  await page.screenshot({
    path: path.join(TARGET_DIR, '04-mobile-admin-portal.png'),
    fullPage: false,
  });
  console.log('Saved 04-mobile-admin-portal.png');

  console.log('6. Navigating to Referee Pad...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const refBtn = btns.find((el) => el.innerText.includes('Referee Pad') || el.innerText.includes('Ref Access'));
    if (refBtn) refBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({
    path: path.join(TARGET_DIR, '05-mobile-referee-console.png'),
    fullPage: false,
  });
  console.log('Saved 05-mobile-referee-console.png');

  console.log('7. Navigating to Standings Sub-Tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const matchesTab = btns.find((el) => el.innerText.includes('Matches'));
    if (matchesTab) matchesTab.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const standingsSubTab = btns.find((el) => el.innerText.includes('Standings'));
    if (standingsSubTab) standingsSubTab.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(TARGET_DIR, '06-mobile-standings.png'),
    fullPage: false,
  });
  console.log('Saved 06-mobile-standings.png');

  await browser.close();
  console.log('All 7 mobile screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error generating screenshots:', err);
  process.exit(1);
});
