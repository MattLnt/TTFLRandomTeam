const puppeteer = require('puppeteer');
const fs = require('fs');

async function test() {
  const cookies = JSON.parse(fs.readFileSync('./cookies.json'));
  const c = cookies['Caribbean'];
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://fantasy.trashtalk.co/');
  await page.setCookie(...c);
  await page.goto('https://fantasy.trashtalk.co/?champweek=4', { waitUntil: 'domcontentloaded' });
  
  await page.waitForSelector('[id^="deck202"]', { timeout: 10000 }).catch(() => null);
  
  const found = await page.evaluate(() => !!document.querySelector('[id^="deck202"]'));
  console.log(found ? 'OK deck trouvé' : 'NON bloque');
  
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
}

test().catch(console.error);