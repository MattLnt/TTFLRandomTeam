const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeHistorique(page, sessionCookies) {
  await page.goto('https://fantasy.trashtalk.co/', { waitUntil: 'networkidle2' });
  await page.setCookie(...sessionCookies);
  await page.goto('https://fantasy.trashtalk.co/?tpl=historique', { waitUntil: 'networkidle2' });

  return await page.evaluate(() => {
    const rows = document.querySelectorAll('#MuTabme tbody tr');
    const picks = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length < 12) return;

      const bonus = cells[12]?.innerText?.trim().toLowerCase() === 'oui';

      picks.push({
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
        bonus,
      });
    });

    return picks;
  });
}

async function main() {
  const sessionCookies = [
    { name: 'PHPSESSID', value: 'ag5iaui8t790ue7ucaooh5bcc2', domain: 'fantasy.trashtalk.co', path: '/' },
    { name: 'TTFLhash', value: '6659ff2c92b31edd0f7f7a348cb51bcb097d6e624780d23d4c8192cda8f3ed11', domain: 'fantasy.trashtalk.co', path: '/' }
  ];

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const picks = await scrapeHistorique(page, sessionCookies);

  // Bonus utilisés
  const bonusUtilises = picks
    .filter(p => p.bonus)
    .map(p => ({ joueur: p.joueur, date: p.date, score: p.score }));

  console.log(`✅ ${picks.length} picks récupérés`);
  console.log(`🎯 ${bonusUtilises.length} bonus utilisés :`, bonusUtilises);

  fs.writeFileSync('historique.json', JSON.stringify(picks, null, 2));
  fs.writeFileSync('bonus.json', JSON.stringify(bonusUtilises, null, 2));
  console.log('💾 Sauvegardé dans historique.json et bonus.json');

  console.log('⏳ Fenêtre ouverte 120 secondes...');
  await new Promise(r => setTimeout(r, 120000));
  await browser.close();
}

main();