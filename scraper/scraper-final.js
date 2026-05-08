const puppeteer = require('puppeteer');
const fs = require('fs');

const TWOCAPTCHA_API_KEY = '4e824019b67d4139035c88714de4848c';
const SITEKEY = '0x4AAAAAAAKfN4HGN0ywrGGa';
const PAGE_URL = 'https://fantasy.trashtalk.co/login/';
const COOKIES_FILE = './cookies.json';
const MEMBERS_FILE = './members.json';
const CURRENT_CHAMPWEEK = '4';
const DELAY_BETWEEN_MEMBERS = 30000; // 30 secondes entre chaque membre

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

async function loginMember(browser, member) {
  console.log(`\n🔐 Connexion pour ${member.pseudo}...`);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  const client = await page.createCDPSession();
  await client.send('Network.clearBrowserCookies');

  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#email', { timeout: 15000 });

  await page.$eval('#email', el => el.value = '');
  await page.$eval('#password', el => el.value = '');
  await page.click('#email');
  await new Promise(r => setTimeout(r, 500));
  await page.type('#email', member.email, { delay: 80 });
  await page.click('#password');
  await new Promise(r => setTimeout(r, 500));
  await page.type('#password', member.password, { delay: 80 });

  const emailVal = await page.$eval('#email', el => el.value);
  console.log(`📝 Email saisi: ${emailVal}`);

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

  await new Promise(r => setTimeout(r, 2000));
  await page.goto(`https://fantasy.trashtalk.co/?champweek=${CURRENT_CHAMPWEEK}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#champweek', { timeout: 15000 }).catch(() => null);

  const currentWeek = await page.evaluate(() => document.querySelector('#champweek')?.value || null);
  console.log(`📅 champweek après login: ${currentWeek}`);

  let deck = null;
  if (currentWeek) {
    await page.waitForSelector('[id^="deck202"]', { timeout: 15000 }).catch(() => null);

    deck = await page.evaluate(() => {
      const champweek = document.querySelector('#champweek')?.value;
      const deckDivs = document.querySelectorAll('[id^="deck202"]');
      const picks = [];
      deckDivs.forEach(div => {
        const date = div.id.replace('deck', '');
        const labels = div.querySelectorAll('.counter-label');
        const joueurText = labels[0]?.innerText?.trim();
        const scoreEl = div.querySelector('[style*="Alfa Slab One"]');
        const score = scoreEl?.innerText?.trim() || null;
        const widgetContents = div.querySelectorAll('.widget-content');
        const widgetContent = widgetContents[1] || widgetContents[0];
        const bgColor = widgetContent?.style?.backgroundColor;
        const isPicked = joueurText &&
          !joueurText.toLowerCase().includes('choisir') &&
          !joueurText.toLowerCase().includes('joueur') &&
          joueurText !== '';
        picks.push({
          date,
          joueur: isPicked ? joueurText : null,
          score: score ? parseInt(score) : null,
          picked: isPicked,
          teamColor: isPicked ? bgColor : null,
        });
      });
      return { champweek, picks };
    });
    console.log(`📦 Deck scrapé: ${deck?.picks?.length || 0} jours, ${deck?.picks?.filter(p => p.picked).length || 0} picks`);
  }

  const cookies = await page.cookies();
  const sessionCookies = cookies.filter(c =>
    ['PHPSESSID', 'TTFLhash', 'TTFLemail'].includes(c.name)
  );

  await page.close();
  return { sessionCookies, deck };
}

async function scrapeWithCookies(browser, sessionCookies) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  await page.goto('https://fantasy.trashtalk.co/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.setCookie(...sessionCookies);

  // Tester si la session est valide en allant sur le deck
  await page.goto(`https://fantasy.trashtalk.co/?champweek=${CURRENT_CHAMPWEEK}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#champweek', { timeout: 15000 }).catch(() => null);

  const isLoggedIn = await page.evaluate(() => !!document.querySelector('#champweek'));
  if (!isLoggedIn) {
    await page.close();
    return { sessionValid: false, deck: null, historique: null };
  }

  // Scraper le deck
  await page.waitForSelector('[id^="deck202"]', { timeout: 15000 }).catch(() => null);
  const deck = await page.evaluate(() => {
    const champweek = document.querySelector('#champweek')?.value;
    const deckDivs = document.querySelectorAll('[id^="deck202"]');
    const picks = [];
    deckDivs.forEach(div => {
      const date = div.id.replace('deck', '');
      const labels = div.querySelectorAll('.counter-label');
      const joueurText = labels[0]?.innerText?.trim();
      const scoreEl = div.querySelector('[style*="Alfa Slab One"]');
      const score = scoreEl?.innerText?.trim() || null;
      const widgetContents = div.querySelectorAll('.widget-content');
      const widgetContent = widgetContents[1] || widgetContents[0];
      const bgColor = widgetContent?.style?.backgroundColor;
      const isPicked = joueurText &&
        !joueurText.toLowerCase().includes('choisir') &&
        !joueurText.toLowerCase().includes('joueur') &&
        joueurText !== '';
      picks.push({
        date,
        joueur: isPicked ? joueurText : null,
        score: score ? parseInt(score) : null,
        picked: isPicked,
        teamColor: isPicked ? bgColor : null,
      });
    });
    return { champweek, picks };
  });

  // Scraper l'historique
  await page.goto('https://fantasy.trashtalk.co/?tpl=historique', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#MuTabme', { timeout: 20000 }).catch(() => null);

  const historique = await page.evaluate(() => {
    const rows = document.querySelectorAll('#MuTabme tbody tr');
    const results = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length < 12) return;
      results.push({
        date:   cells[0].innerText.trim(),
        joueur: cells[1].innerText.trim(),
        pts:    parseInt(cells[2].innerText) || 0,
        reb:    parseInt(cells[3].innerText) || 0,
        ast:    parseInt(cells[4].innerText) || 0,
        stl:    parseInt(cells[5].innerText) || 0,
        blk:    parseInt(cells[6].innerText) || 0,
        ftm:    parseInt(cells[7].innerText) || 0,
        fgm:    parseInt(cells[8].innerText) || 0,
        fg3m:   parseInt(cells[9].innerText) || 0,
        malus:  parseInt(cells[10].innerText) || 0,
        score:  parseInt(cells[11].innerText) || 0,
        bonus:  cells[12]?.innerText?.trim().toLowerCase() === 'oui',
      });
    });
    return results;
  });

  await page.close();
  return { sessionValid: true, deck, historique };
}

function loadCookies() {
  if (fs.existsSync(COOKIES_FILE)) {
    const content = fs.readFileSync(COOKIES_FILE, 'utf8');
    if (!content || content.trim() === '') return {};
    try { return JSON.parse(content); } catch { return {}; }
  }
  return {};
}

function saveCookies(cache) {
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cache, null, 2));
}

function analyseBonus(allMembers) {
  const bonusParMembre = {};
  const bonusUtilisesGlobal = {};
  for (const [pseudo, data] of Object.entries(allMembers)) {
    const bonusUtilises = data.historique.filter(p => p.bonus).map(p => p.joueur);
    bonusParMembre[pseudo] = bonusUtilises;
    bonusUtilises.forEach(joueur => {
      bonusUtilisesGlobal[joueur] = (bonusUtilisesGlobal[joueur] || 0) + 1;
    });
  }
  const tousLesJoueurs = {};
  for (const data of Object.values(allMembers)) {
    data.historique.forEach(p => {
      if (!tousLesJoueurs[p.joueur]) tousLesJoueurs[p.joueur] = { total: 0, count: 0 };
      tousLesJoueurs[p.joueur].total += p.score;
      tousLesJoueurs[p.joueur].count += 1;
    });
  }
  const top10BonusDispo = Object.entries(tousLesJoueurs)
    .map(([joueur, stats]) => ({
      joueur,
      moyenneScore: Math.round(stats.total / stats.count),
      nbPicks: stats.count,
      utiliseEnBonus: !!bonusUtilisesGlobal[joueur],
    }))
    .filter(j => !j.utiliseEnBonus)
    .sort((a, b) => b.moyenneScore - a.moyenneScore)
    .slice(0, 10);
  return { bonusParMembre, top10BonusDispo };
}

async function main() {
  const members = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'));
  const cookieCache = loadCookies();
  const allMembers = {};

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1280,800'],
  });

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 Traitement de ${member.pseudo}`);

    try {
      let sessionCookies = cookieCache[member.pseudo];
      let deck = null;
      let historique = null;

      // Essayer d'abord avec les cookies existants
      if (sessionCookies && sessionCookies.length > 0) {
        console.log(`🍪 Test des cookies existants...`);
        const result = await scrapeWithCookies(browser, sessionCookies);
        
        if (result.sessionValid) {
          console.log(`✅ Cookies valides — pas besoin de relogin`);
          deck = result.deck;
          historique = result.historique;
        } else {
          console.log(`⚠️  Cookies expirés — login requis`);
          sessionCookies = null;
        }
      }

      // Si pas de cookies ou cookies invalides, login complet
      if (!sessionCookies || !historique) {
        const loginResult = await loginMember(browser, member);
        sessionCookies = loginResult.sessionCookies;
        deck = loginResult.deck;
        cookieCache[member.pseudo] = sessionCookies;
        saveCookies(cookieCache);

        // Récupérer historique après login
        const result = await scrapeWithCookies(browser, sessionCookies);
        historique = result.historique;
        if (!deck) deck = result.deck;
      }

      allMembers[member.pseudo] = {
        historique: historique || [],
        deck: deck || {},
        bonusUtilises: (historique || []).filter(p => p.bonus).map(p => ({ joueur: p.joueur, date: p.date, score: p.score })),
        joueursUtilises: [...new Set((historique || []).map(p => p.joueur))],
      };

      console.log(`✅ ${member.pseudo} : ${historique?.length || 0} picks, ${allMembers[member.pseudo].bonusUtilises.length} bonus`);

    } catch (err) {
      console.log(`❌ Erreur pour ${member.pseudo} : ${err.message}`);
      allMembers[member.pseudo] = { historique: [], deck: {}, bonusUtilises: [], joueursUtilises: [] };
    }

    // Attendre 30 secondes avant le prochain membre (sauf le dernier)
    if (i < members.length - 1) {
      console.log(`⏸️  Pause de ${DELAY_BETWEEN_MEMBERS / 1000}s avant le prochain membre...`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_MEMBERS));
    }
  }

  await browser.close();

  const { bonusParMembre, top10BonusDispo } = analyseBonus(allMembers);

  const result = {
    updatedAt: new Date().toISOString(),
    members: allMembers,
    bonusParMembre,
    top10BonusDispo,
  };

  fs.writeFileSync('./all_members.json', JSON.stringify(result, null, 2));
  console.log('\n🎉 Terminé ! Sauvegardé dans all_members.json');
  console.log('\n🏆 Top 10 joueurs pour le prochain bonus :');
  top10BonusDispo.forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.joueur} — moy. ${j.moyenneScore} pts (${j.nbPicks} picks)`);
  });
}

main();