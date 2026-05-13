const puppeteer = require('puppeteer');
const fs = require('fs');

const TWOCAPTCHA_API_KEY = '4e824019b67d4139035c88714de4848c';
const SITEKEY = '0x4AAAAAAAKfN4HGN0ywrGGa';
const PAGE_URL = 'https://fantasy.trashtalk.co/login/';
const COOKIES_FILE = './cookies.json';
const MEMBERS_FILE = './members.json';
const DELAY_BETWEEN_MEMBERS = 30000;
const MAX_RETRIES = 2;

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
  for (let i = 0; i < 30; i++) {
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
  await page.setViewport({ width: 1280, height: 800 });

  const client = await page.createCDPSession();
  await client.send('Network.clearBrowserCookies');

  console.log(`🔐 Connexion pour ${member.pseudo}...`);
  
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForSelector('#email', { timeout: 30000 });
  await page.waitForSelector('#password', { timeout: 30000 });
  await page.waitForSelector('button[type="submit"]', { timeout: 30000 });
  
  await page.waitForSelector('[name="cf-turnstile-response"]', { timeout: 30000 }).catch(() => {
    console.log('⚠️  Turnstile pas trouvé, continue quand même...');
  });

  await new Promise(r => setTimeout(r, 1500));

  await page.click('#email');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#email', member.email, { delay: 100 });
  
  await page.click('#password');
  await new Promise(r => setTimeout(r, 300));
  await page.type('#password', member.password, { delay: 100 });

  const token = await solveTurnstile();
  
  await page.evaluate((token) => {
    let input = document.querySelector('[name="cf-turnstile-response"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'cf-turnstile-response';
      document.querySelector('form').appendChild(input);
    }
    input.value = token;
  }, token);

  await new Promise(r => setTimeout(r, 1500));

  await page.click('button[type="submit"]');

  try {
    await page.waitForFunction(
      () => !window.location.href.includes('/login'),
      { timeout: 120000, polling: 1000 }
    );
  } catch (err) {
    const currentUrl = page.url();
    console.log(`⚠️  Timeout, URL actuelle: ${currentUrl}`);
    if (currentUrl.includes('/login')) {
      throw new Error('Login échoué - reste sur /login');
    }
  }

  console.log(`✅ ${member.pseudo} connecté !`);
  await new Promise(r => setTimeout(r, 2000));

  // Aller sur la page principale et détecter le champweek courant
  await page.goto(`https://fantasy.trashtalk.co/`, { 
    waitUntil: 'networkidle2', 
    timeout: 90000 
  });
  await page.waitForSelector('#champweek', { timeout: 30000 });

  const currentChampweek = await page.evaluate(() => {
    return document.querySelector('#champweek')?.value;
  });
  console.log(`📅 Champweek détecté: ${currentChampweek}`);

  // Vérifier si le deck d'aujourd'hui est déjà présent
  let deckPresent = await page.evaluate((todayDate) => {
    return !!document.querySelector(`#deck${todayDate}`);
  }, today);

  // Si pas présent, naviguer explicitement sur le champweek courant
  if (!deckPresent && currentChampweek) {
    console.log(`🔄 Navigation vers champweek=${currentChampweek}...`);
    await page.goto(`https://fantasy.trashtalk.co/?champweek=${currentChampweek}`, { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    });
    await page.waitForSelector(`#deck${today}`, { timeout: 30000 }).catch(() => {
      console.log(`⚠️  #deck${today} pas trouvé`);
    });
  }

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

async function processWithRetry(browser, member, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`🔁 Tentative ${attempt}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 5000));
      }
      return await loginAndGetTodayPick(browser, member);
    } catch (err) {
      console.log(`❌ Tentative ${attempt} échouée: ${err.message}`);
      if (attempt === maxRetries) throw err;
    }
  }
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
  let successCount = 0;
  let failCount = 0;

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
  });

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 ${member.pseudo} (${i + 1}/${members.length})`);

    try {
      const todayPick = await processWithRetry(browser, member, MAX_RETRIES);

      const existingMember = allMembers[member.pseudo] || { 
        historique: [], 
        deck: { picks: [] }, 
        bonusUtilises: [], 
        joueursUtilises: [] 
      };

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

      successCount++;
      console.log(`✅ ${member.pseudo} OK`);

    } catch (err) {
      failCount++;
      console.log(`❌ ${member.pseudo} ÉCHEC après ${MAX_RETRIES} tentatives`);
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
  console.log(`\n🎉 Terminé ! ${successCount}/${members.length} réussis, ${failCount} échecs`);
}

main();