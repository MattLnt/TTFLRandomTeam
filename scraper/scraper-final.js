const puppeteer = require('puppeteer');
const fs = require('fs');

const TWOCAPTCHA_API_KEY = '4e824019b67d4139035c88714de4848c';
const SITEKEY = '0x4AAAAAAAKfN4HGN0ywrGGa';
const PAGE_URL = 'https://fantasy.trashtalk.co/login/';
const COOKIES_FILE = './cookies.json';
const MEMBERS_FILE = './members.json';
const DELAY_BETWEEN_MEMBERS = 30000;
const MAX_RETRIES = 2;

// ⚠️ À METTRE À JOUR CHAQUE NOUVELLE SAISON
// Date du premier jour de la saison (samedi ou autre)
// Les champweeks changent chaque lundi
const SEASON_START_DATE = '2026-04-18'; // Playoffs 2026 — samedi
const SEASON_START_WEEKDAY = 6; // 0=dimanche, 1=lundi, ..., 6=samedi

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getCurrentChampweek() {
  const seasonStart = new Date(SEASON_START_DATE + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysSinceStart = Math.floor((today - seasonStart) / (1000 * 60 * 60 * 24));
  
  // Nombre de jours jusqu'au premier lundi suivant le début de saison
  // Si la saison commence un lundi (1), c'est 0. Si elle commence un samedi (6), c'est 2.
  const daysUntilFirstMonday = (8 - SEASON_START_WEEKDAY) % 7 || 0;
  
  if (daysSinceStart < daysUntilFirstMonday) {
    return 1; // Champweek 1 (partielle, jusqu'au premier lundi)
  }
  
  const daysSinceFirstMonday = daysSinceStart - daysUntilFirstMonday;
  const weekNumber = Math.floor(daysSinceFirstMonday / 7) + 2;
  
  return weekNumber;
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

async function loginAndGetTodayPick(browser, member, currentChampweek) {
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

  // Naviguer directement sur le champweek calculé
  await page.goto(`https://fantasy.trashtalk.co/?champweek=${currentChampweek}`, { 
    waitUntil: 'networkidle2', 
    timeout: 90000 
  });
  
  await page.waitForSelector(`#deck${today}`, { timeout: 30000 }).catch(() => {
    console.log(`⚠️  #deck${today} pas trouvé sur champweek=${currentChampweek}`);
  });

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

async function processWithRetry(browser, member, currentChampweek, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`🔁 Tentative ${attempt}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 5000));
      }
      return await loginAndGetTodayPick(browser, member, currentChampweek);
    } catch (err) {
      console.log(`❌ Tentative ${attempt} échouée: ${err.message}`);
      if (attempt === maxRetries) throw err;
    }
  }
}

async function main() {
  const members = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
  const today = getTodayDate();
  const currentChampweek = getCurrentChampweek();
  
  console.log(`📅 Date: ${today}`);
  console.log(`🏆 Champweek calculé: ${currentChampweek}`);

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
      const todayPick = await processWithRetry(browser, member, currentChampweek, MAX_RETRIES);

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
    currentChampweek,
  };

  fs.writeFileSync('./all_members.json', JSON.stringify(result, null, 2));
  console.log(`\n🎉 Terminé ! ${successCount}/${members.length} réussis, ${failCount} échecs`);
}

main();