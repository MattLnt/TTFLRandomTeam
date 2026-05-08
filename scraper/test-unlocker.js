const fs = require('fs');

const API_KEY = '9fd095fe-41bc-41ed-92b0-47280b626dd6';
const ZONE = 'ttfl_scraper_unlocker';

async function test() {
  const cookies = JSON.parse(fs.readFileSync('./cookies.json'));
  const c = cookies['Caribbean'];
  const cookieString = c.map(x => `${x.name}=${x.value}`).join('; ');

  console.log('Requête vers TTFL via Bright Data Web Unlocker...');

  const response = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      zone: ZONE,
      url: 'https://fantasy.trashtalk.co/ajax_liste_deck.php?champweek=4',
      format: 'raw',
      headers: {
        'Cookie': cookieString,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://fantasy.trashtalk.co/?champweek=4',
      },
    }),
  });

  const html = await response.text();
  console.log('Status:', response.status);
  console.log('Contient deck202:', html.includes('deck202') ? '✅ OUI' : '❌ NON');
  console.log('Premiers 500 caractères:');
  console.log(html.substring(0, 500));
}

test().catch(console.error);