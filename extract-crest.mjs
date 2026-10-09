import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const inputPath = path.resolve('public/xlri-shield-logo.png');
const crestPngPath = path.resolve('public/xlri-crest.png');
const squareShieldPath = path.resolve('public/xlri-shield-square.png');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });
  const page = await browser.newPage();
  
  const imgBase64 = fs.readFileSync(inputPath).toString('base64');
  await page.setContent(`<!DOCTYPE html><html><body><img id="img" src="data:image/png;base64,${imgBase64}"></body></html>`);
  
  const result = await page.evaluate(() => {
    const img = document.getElementById('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    // Detect exact boundaries of the solid blue square
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < 540; y++) {
      for (let x = 0; x < 520; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
        // The blue square boundary
        if (a > 150 && b > 100 && r < 50 && g < 100) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // 1. Pure square shield
    const sqW = maxX - minX;
    const sqH = maxY - minY;
    const sqCanvas = document.createElement('canvas');
    sqCanvas.width = sqW;
    sqCanvas.height = sqH;
    const sqCtx = sqCanvas.getContext('2d');
    sqCtx.drawImage(canvas, minX, minY, sqW, sqH, 0, 0, sqW, sqH);

    // 2. Full crest including bottom "EXCELLENCE & INTEGRITY"
    let textMaxY = maxY;
    for (let y = maxY; y < 620; y++) {
      for (let x = 0; x < 520; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
        if (a > 150 && b > 100 && r < 50) {
          if (y > textMaxY) textMaxY = y;
        }
      }
    }

    const pad = 8;
    const crX = Math.max(0, minX - pad);
    const crY = Math.max(0, minY - pad);
    const crW = (maxX - minX) + (pad * 2);
    const crH = (textMaxY - minY) + (pad * 2);

    const crCanvas = document.createElement('canvas');
    crCanvas.width = crW;
    crCanvas.height = crH;
    const crCtx = crCanvas.getContext('2d');
    crCtx.drawImage(canvas, crX, crY, crW, crH, 0, 0, crW, crH);

    return {
      squareDataUrl: sqCanvas.toDataURL('image/png'),
      crestDataUrl: crCanvas.toDataURL('image/png'),
      sqBox: { minX, minY, maxX, maxY, sqW, sqH },
      crBox: { crX, crY, crW, crH }
    };
  });

  fs.writeFileSync(squareShieldPath, Buffer.from(result.squareDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  fs.writeFileSync(crestPngPath, Buffer.from(result.crestDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('Saved square shield:', squareShieldPath, result.sqBox);
  console.log('Saved full crest:', crestPngPath, result.crBox);

  await browser.close();
}

main().catch(console.error);
