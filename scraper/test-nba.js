const https = require('https');

function nbaRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'stats.nba.com',
      path,
      method: 'GET',
      headers: {
        'Referer': 'https://www.nba.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://www.nba.com',
        'Connection': 'keep-alive',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function main() {
  console.log('Test gamelog SGA...');
  await new Promise(r => setTimeout(r, 2000));
  
  const data = await nbaRequest(
    '/stats/playergamelog?PlayerID=1628983&Season=2025-26&SeasonType=Playoffs'
  );

  const headers = data.resultSets[0].headers;
  const rows = data.resultSets[0].rowSet;

  console.log('Headers:', headers.join(', '));
  console.log(`\n${rows.length} matchs trouvés`);
  
  if (rows.length > 0) {
    const last = rows[0];
    const game = {};
    headers.forEach((h, i) => game[h] = last[i]);
    console.log('\nDernier match :');
    console.log('Date:', game.GAME_DATE);
    console.log('Adversaire:', game.MATCHUP);
    console.log('Pts:', game.PTS);
    console.log('Reb:', game.REB);
    console.log('Ast:', game.AST);
    console.log('Stl:', game.STL);
    console.log('Blk:', game.BLK);
    console.log('FTM:', game.FTM);
    console.log('FGA:', game.FGA);
    console.log('FGM:', game.FGM);
    console.log('FG3M:', game.FG3M);
    console.log('TOV:', game.TOV);
    
    // Calcul score TTFL
    const ttfl = game.PTS + game.REB + game.AST + game.STL + game.BLK 
      - game.TOV 
      - (game.FGA - game.FGM) 
      - (game.FTA - game.FTM);
    console.log('\nScore TTFL calculé:', ttfl);
  }
}

main().catch(console.error);