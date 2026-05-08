const puppeteer = require('puppeteer');
const fs = require('fs');

const TWOCAPTCHA_API_KEY = '4e824019b67d4139035c88714de4848c';
const SITEKEY = '0x4AAAAAAAKfN4HGN0ywrGGa';
const PAGE_URL = 'https://fantasy.trashtalk.co/login/';
const COOKIES_FILE = './cookies.json';
const MEMBERS_FILE = './members.json';
const CURRENT_CHAMPWEEK = '4';
const DELAY_BETWEEN_MEMBERS = 30000;

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function solveTurnstile() {
  console.log('🔄 Envoi du captcha à 2captcha...');
  const submitRes = await fetch(
    `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}&method=turnstile&sitekey=${SITEKEY}&pageurl=${PAGE_URL}&json=1`
  );
  const submitData = await submitRes.json();
  if (submitData.status !== 1) throw new Error(`2captcha erreur: ${submitData.request}`);
  const captchaId = submitData.request;
  console.log(`📨 Captcha soumis, ID: ${captchaId}`);
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const resultRes = await fetch(
      `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`
    );
    const resultData = await resultRes.json();
    if (resultData.status === 1) { console.log('✅ Captcha résolu !'); return resultData.request; }
    if (resultData.request !== 'CAPCHA_NOT_READY') throw new Error(`2captcha erreur: ${resultData.request}`);
    console.log(`⏳ En attente... (${(i + 1) * 5}s)`);
  }
  throw new Error('Timeout captcha');
}

async function loginAndGetTodayPick(browser, member) {
  const today = getTodayDate();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  const client = await page.createCDPSession();
  await client.send('Network.clearBrowserCookies');

  console.log(`🔐 Connexion pour ${member.pseudo}...`);
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#email', { timeout: 15000 });

  await page.type('#email', member.email, { delay: 80 });
  await page.type('#password', member.password, { delay: 80 });

  const token = await solveTurnstile();
  await page.evaluate((token) => {
    const input = document.querySelector('[name="cf-turnstile-response"]');
    if (input) input.value = token;
  }, token);

  await page.click('button[type="submit"]');

  await page.waitForFunction(
    () => !window.location.href.includes('/login'),
    { timeout: 60000 }
  );

  console.log(`✅ ${member.pseudo} connecté !`);

  await page.goto(`https://fantasy.trashtalk.co/?champweek=${CURRENT_CHAMPWEEK}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector(`#deck${today}`, { timeout: 15000 }).catch(() => null);

  const todayPick = await page.evaluate((todayDate) => {
    const div = document.querySelector(`#deck${todayDate}`);
    if (!div) return null;

    const labels = div.querySelectorAll('.counter-label');
    const joueurText = labels[0]?.innerText?.trim();
    const scoreEl = div.querySelector('[style*="Alfa Slab One"]');
    const score = scoreEl?.innerText?.trim() || null;
    const widgetContents = div.querySelectorAll('.widget-content');
    const widgetContent = widgetContents[1] || widgetContents[0];
    const bgColor = widgetContent?.style?.backgroundColor;
    const bonusDiv = div.querySelector('.widget-content.padding-5');
    const hasBonus = bonusDiv && bonusDiv.getAttribute('hidden') === null;
    const isPicked = joueurText &&
      !joueurText.toLowerCase().includes('choisir') &&
      !joueurText.toLowerCase().includes('joueur') &&
      joueurText !== '';

    return {
      date: todayDate,
      joueur: isPicked ? joueurText : null,
      score: score ? parseInt(score) : null,
      picked: !!isPicked,
      teamColor: isPicked ? bgColor : null,
      bonus: !!hasBonus && !!isPicked,
    };
  }, today);

  console.log(`📦 Pick: ${todayPick?.joueur || 'pas encore pické'}`);

  await page.close();
  return todayPick;
}

async function main() {
  const members = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
  const today = getTodayDate();

  let existing = { members: {} };
  if (fs.existsSync('./all_members.json')) {
    try {
      existing = JSON.parse(fs.readFileSync('./all_members.json', 'utf8'));
    } catch {}
  }

  const allMembers = { ...existing.members };

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1280,800'],
  });

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 ${member.pseudo}`);

    try {
      const todayPick = await loginAndGetTodayPick(browser, member);

      const existingMember = allMembers[member.pseudo] || { historique: [], deck: { picks: [] }, bonusUtilises: [], joueursUtilises: [] };

      let deckPicks = existingMember.deck?.picks || [];
      const existingTodayIndex = deckPicks.findIndex(p => p.date === today);
      if (existingTodayIndex >= 0) {
        deckPicks[existingTodayIndex] = todayPick || deckPicks[existingTodayIndex];
      } else if (todayPick) {
        deckPicks.push(todayPick);
      }

      allMembers[member.pseudo] = {
        ...existingMember,
        deck: { ...existingMember.deck, picks: deckPicks },
      };

      console.log(`✅ ${member.pseudo} OK`);

    } catch (err) {
      console.log(`❌ Erreur pour ${member.pseudo} : ${err.message}`);
    }

    if (i < members.length - 1) {
      console.log(`⏸️  Pause ${DELAY_BETWEEN_MEMBERS / 1000}s...`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_MEMBERS));
    }
  }

  await browser.close();

  const result = {
    ...existing,
    updatedAt: new Date().toISOString(),
    members: allMembers,
  };

  fs.writeFileSync('./all_members.json', JSON.stringify(result, null, 2));
  console.log('\n🎉 Terminé !');
}

main();