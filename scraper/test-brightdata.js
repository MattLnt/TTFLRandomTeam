const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BRIGHTDATA_WS = 'wss://brd-customer-hl_eeb38ba7-zone-ttfl_scraper:wv66ajtut2ll@brd.superproxy.io:9222';
const TWOCAPTCHA_API_KEY = '4e824019b67d4139035c88714de4848c';
const SITEKEY = '0x4AAAAAAAKfN4HGN0ywrGGa';

async function solveTurnstile() {
  const submitRes = await fetch(
    `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}&method=turnstile&sitekey=${SITEKEY}&pageurl=https://fantasy.trashtalk.co/login/&json=1`
  );
  const submitData = await submitRes.json();
  const captchaId = submitData.request;
  console.log('Captcha ID:', captchaId);
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const resultRes = await fetch(
      `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`
    );
    const resultData = await resultRes.json();
    if (resultData.status === 1) return resultData.request;
    console.log(`En attente... (${(i + 1) * 5}s)`);
  }
}

async function test() {
  console.log('Connexion à Bright Data...');
  const browser = await puppeteer.connect({
    browserWSEndpoint: BRIGHTDATA_WS,
  });
  
  console.log('Connecté !');
  const page = await browser.newPage();
  
  console.log('Chargement de la page login...');
  await page.goto('https://fantasy.trashtalk.co/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  await page.type('#email', 'Caribbean', { delay: 80 });
  await page.type('#password', 'RandomPotiron2026', { delay: 80 });
  
  console.log('Résolution du captcha...');
  const token = await solveTurnstile();
  
  await page.evaluate((token) => {
    const input = document.querySelector('[name="cf-turnstile-response"]');
    if (input) input.value = token;
  }, token);
  
  console.log('Submit...');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('URL après login:', page.url());
  console.log('Connecté:', !page.url().includes('/login'));
  
  if (!page.url().includes('/login')) {
    console.log('Chargement du deck...');
    await page.goto('https://fantasy.trashtalk.co/?champweek=4', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[id^="deck202"]', { timeout: 30000 }).catch(() => null);
    
    const picks = await page.evaluate(() => {
      const decks = document.querySelectorAll('[id^="deck202"]');
      return Array.from(decks).map(d => ({
        date: d.id.replace('deck',''),
        joueur: d.querySelector('.counter-label')?.innerText?.trim().substring(0, 50)
      }));
    });
    console.log(picks);
  }
  
  await browser.close();
}

test().catch(console.error);