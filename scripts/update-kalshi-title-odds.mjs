import { mkdir, writeFile } from 'node:fs/promises';

const KALSHI_MARKETS_URL =
  'https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=KXMENWORLDCUP&limit=1000';
const OUTPUT_URL = new URL('../data/title-odds.json', import.meta.url);

const response = await fetch(KALSHI_MARKETS_URL);
if (!response.ok) {
  throw new Error(`Kalshi markets fetch failed: ${response.status}`);
}

const data = await response.json();
const markets = data.markets ?? [];
if (markets.length < 48) {
  throw new Error(`Expected at least 48 Kalshi World Cup winner markets, got ${markets.length}`);
}

const teams = markets
  .filter((market) => market.event_ticker === 'KXMENWORLDCUP-26')
  .map((market) => {
    const probability = calculateMarketProbability(market);

    return {
      team: market.yes_sub_title ?? extractTeamFromTitle(market.title),
      vendor: 'Kalshi',
      market: market.title,
      ticker: market.ticker,
      probability,
      yesBid: parseDollarPrice(market.yes_bid_dollars),
      yesAsk: parseDollarPrice(market.yes_ask_dollars),
      lastPrice: parseDollarPrice(market.last_price_dollars),
      updatedAt: market.updated_time,
    };
  })
  .filter((team) => team.team && team.probability > 0)
  .sort((a, b) => b.probability - a.probability || a.team.localeCompare(b.team));

if (teams.length !== 48) {
  throw new Error(`Expected 48 usable Kalshi title odds, got ${teams.length}`);
}

const updatedAt = teams
  .map((team) => team.updatedAt)
  .filter(Boolean)
  .sort()
  .at(-1);

const payload = {
  source: 'Kalshi KXMENWORLDCUP markets',
  sourceUrl: 'https://kalshi.com/markets/kxmenworldcup',
  apiUrl: KALSHI_MARKETS_URL,
  updatedAt,
  teams,
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(OUTPUT_URL, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Wrote ${teams.length} Kalshi title odds to ${OUTPUT_URL.pathname}`);

function calculateMarketProbability(market) {
  const bid = parseDollarPrice(market.yes_bid_dollars);
  const ask = parseDollarPrice(market.yes_ask_dollars);
  const last = parseDollarPrice(market.last_price_dollars);

  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  if (ask > 0) return ask / 2;
  if (bid > 0) return bid;
  if (last > 0) return last;

  return 0;
}

function parseDollarPrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractTeamFromTitle(title = '') {
  const match = title.match(/^Will (.+) win the 2026 Men's World Cup\?$/);
  return match?.[1] ?? '';
}
