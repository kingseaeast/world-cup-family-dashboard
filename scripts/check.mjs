import { readFile } from 'node:fs/promises';

const PICKS_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=500';
const BUILD_VERSION = '__BUILD_VERSION__';

const NAME_ALIASES = {
  usa: 'united states',
  'bosnia and herzegovina': 'bosnia-herzegovina',
  'dr congo': 'congo dr',
  'côte d’ivoire': 'ivory coast',
  "cote d'ivoire": 'ivory coast',
  turkey: 'türkiye',
};

function normalizeTeamName(name) {
  return (NAME_ALIASES[name?.trim().toLowerCase()] ?? name?.trim().toLowerCase() ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

const picks = JSON.parse(await readFile(new URL('../data/family-picks.json', import.meta.url), 'utf8'));
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const titleOdds = JSON.parse(await readFile(new URL('../data/title-odds.json', import.meta.url), 'utf8'));
const response = await fetch(PICKS_URL);
if (!response.ok) {
  throw new Error(`Scoreboard fetch failed: ${response.status}`);
}
const scoreboard = await response.json();
const events = scoreboard.events ?? [];

if (events.length < 100) {
  throw new Error(`Expected a full tournament schedule, got ${events.length} events`);
}

const pickedTeams = new Set();
for (const group of picks.groups) {
  for (const team of Object.values(group.picks)) {
    pickedTeams.add(normalizeTeamName(team));
  }
}

const eventTeams = new Set();
for (const event of events) {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  for (const competitor of competitors) {
    eventTeams.add(normalizeTeamName(competitor.team.displayName));
  }
}

const missingTeams = [...pickedTeams].filter((team) => !eventTeams.has(team));
if (missingTeams.length) {
  throw new Error(`Missing picked teams from scoreboard feed: ${missingTeams.join(', ')}`);
}

const rankedTeams = new Set(Object.keys(picks.worldRankings?.teams ?? {}).map(normalizeTeamName));
const missingRankings = [...pickedTeams].filter((team) => !rankedTeams.has(team));
if (missingRankings.length) {
  throw new Error(`Missing world rankings for picked teams: ${missingRankings.join(', ')}`);
}

const titleOddsTeams = new Set((titleOdds.teams ?? []).map((team) => normalizeTeamName(team.team)));
const missingTitleOdds = [...pickedTeams].filter((team) => !titleOddsTeams.has(team));
if (missingTitleOdds.length) {
  throw new Error(`Missing Kalshi title odds for picked teams: ${missingTitleOdds.join(', ')}`);
}

for (const asset of ['styles.css', 'app.js']) {
  if (!index.includes(`./${asset}?v=${BUILD_VERSION}`)) {
    throw new Error(`${asset} must use the deployment build version to avoid mixed cached releases`);
  }
}

console.log(`check ok: ${events.length} matches loaded, ${pickedTeams.size} picked teams mapped`);
