const cookies = require('./cookies.json');
const c = cookies['Caribbean'].map(x => x.name+'='+x.value).join('; ');
fetch('https://fantasy.trashtalk.co/ajax_liste_deck.php?champweek=4', {
  headers: { 'Cookie': c, 'X-Requested-With': 'XMLHttpRequest' }
}).then(r => r.text()).then(html => {
  console.log(html.includes('deck202') ? 'OK fonctionne' : 'NON bloque');
});