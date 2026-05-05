const API_KEY = '97c2744f-b82f-4112-b0b2-848d2e085c9a';
const BASE = 'https://api.balldontlie.io/nba/v1';

async function bdlRequest(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'Authorization': API_KEY }
  });
  return res.json();
}

async function main() {
  // Test stats SGA sur les derniers matchs
  console.log('=== Stats SGA 10 derniers matchs ===');
  const stats = await bdlRequest('/stats?player_ids[]=175&seasons[]=2025&per_page=10');
  console.log(JSON.stringify(stats, null, 2).substring(0, 3000));

  await new Promise(r => setTimeout(r, 2000));

  // Test stats d'un match précis
  console.log('\n=== Stats match précis ===');
  const gameStats = await bdlRequest('/stats?game_ids[]=21708299');
  console.log(JSON.stringify(gameStats, null, 2).substring(0, 2000));
}

main().catch(console.error);