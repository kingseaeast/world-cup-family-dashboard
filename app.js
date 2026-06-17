const PICKS_URL = './data/family-picks.json';
const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=500';

const NAME_ALIASES = {
  usa: 'united states',
  'bosnia and herzegovina': 'bosnia-herzegovina',
  'dr congo': 'congo dr',
  'côte d’ivoire': 'ivory coast',
  "cote d'ivoire": 'ivory coast',
  curacao: 'curaçao',
  turkey: 'türkiye',
};

const TEAM_FLAG_CODES = {
  algeria: 'dz',
  argentina: 'ar',
  australia: 'au',
  austria: 'at',
  belgium: 'be',
  brazil: 'br',
  'bosnia and herzegovina': 'ba',
  canada: 'ca',
  'cape verde': 'cv',
  colombia: 'co',
  croatia: 'hr',
  curaçao: 'cw',
  czechia: 'cz',
  'dr congo': 'cd',
  ecuador: 'ec',
  egypt: 'eg',
  england: 'gb-eng',
  france: 'fr',
  germany: 'de',
  ghana: 'gh',
  haiti: 'ht',
  iran: 'ir',
  iraq: 'iq',
  'ivory coast': 'ci',
  japan: 'jp',
  jordan: 'jo',
  mexico: 'mx',
  morocco: 'ma',
  netherlands: 'nl',
  'new zealand': 'nz',
  norway: 'no',
  panama: 'pa',
  paraguay: 'py',
  portugal: 'pt',
  qatar: 'qa',
  'saudi arabia': 'sa',
  scotland: 'gb-sct',
  senegal: 'sn',
  'south africa': 'za',
  'south korea': 'kr',
  spain: 'es',
  sweden: 'se',
  switzerland: 'ch',
  tunisia: 'tn',
  türkiye: 'tr',
  turkey: 'tr',
  uruguay: 'uy',
  usa: 'us',
  uzbekistan: 'uz',
};

const DISPLAY_TIME_ZONE = 'America/Los_Angeles';
const FORECAST_METHODS = {
  MONTE_CARLO_LITE: 'monteCarloLite',
  FULL_MONTE_CARLO_BRACKET: 'fullMonteCarloBracket',
  API_ODDS: 'apiOdds',
};
const CHAMPIONSHIP_FORECAST_METHOD = FORECAST_METHODS.MONTE_CARLO_LITE;
const CHAMPIONSHIP_RANK_DECAY = 0.045;
const CHAMPIONSHIP_SIMULATION_RUNS = 2000;
const CHAMPIONSHIP_SIMULATION_SEED = 20260611;
const CHAMPIONSHIP_STRENGTH_POWER = 4;
const KNOCKOUT_MATCH_STRENGTH_POWER = 1.35;
const GROUP_DRAW_PROBABILITY = 0.24;
const TITLE_ODDS_URL = './data/title-odds.json';
const PATH_MULTIPLIERS = {
  groupWinner: 1,
  runnerUp: 0.72,
  thirdPlace: 0.46,
};
const KNOCKOUT_PATH_ORDER = {
  groupWinner: 0,
  runnerUp: 1,
  thirdPlace: 2,
};

const MEMBER_THUMBNAILS = {
  Nathan: './assets/family/nathan.jpg',
  Aria: './assets/family/aria.jpg',
  Andrea: './assets/family/andrea.jpg',
  Haidong: './assets/family/haidong.jpg',
};

const state = {
  memberFilter: 'All',
  statusFilter: 'all',
  members: [],
  groups: [],
  events: [],
  worldRankings: new Map(),
  championshipForecast: null,
  apiOddsForecast: null,
  titleOdds: null,
  loadedAt: null,
};

const els = {
  totalGames: document.querySelector('#total-games'),
  liveGames: document.querySelector('#live-games'),
  completedGames: document.querySelector('#completed-games'),
  memberFilters: document.querySelector('#member-filters'),
  statusFilters: document.querySelector('#status-filters'),
  memberSummary: document.querySelector('#member-summary'),
  standingsHead: document.querySelector('#standings-table thead'),
  standingsBody: document.querySelector('#standings-table tbody'),
  teamStandingsGroups: document.querySelector('#team-standings-groups'),
  teamPowerRankingsHead: document.querySelector('#team-power-rankings-table thead'),
  teamPowerRankingsBody: document.querySelector('#team-power-rankings-table tbody'),
  picksHead: document.querySelector('#picks-table thead'),
  picksBody: document.querySelector('#picks-table tbody'),
  spotlight: document.querySelector('#spotlight'),
  fixtures: document.querySelector('#fixtures'),
  fixturesCount: document.querySelector('#fixtures-count'),
  dataStatus: document.querySelector('#data-status'),
  template: document.querySelector('#match-card-template'),
};

init().catch((error) => {
  console.error(error);
  els.dataStatus.innerHTML = `<span class="error">Couldn’t load the dashboard: ${error.message}</span>`;
});

async function init() {
  const [picksResponse, scoreboardResponse] = await Promise.all([
    fetch(PICKS_URL),
    fetch(SCOREBOARD_URL),
  ]);

  if (!picksResponse.ok) {
    throw new Error('failed to load family picks');
  }

  if (!scoreboardResponse.ok) {
    throw new Error('failed to load World Cup schedule');
  }

  const picksData = await picksResponse.json();
  const scoreboardData = await scoreboardResponse.json();

  state.members = picksData.members;
  state.groups = picksData.groups;
  state.worldRankings = buildWorldRankings(picksData.worldRankings?.teams ?? {});
  state.events = buildEvents(scoreboardData.events ?? [], picksData.groups);
  state.titleOdds = await loadTitleOdds();
  state.apiOddsForecast = calculateApiOddsForecast(getPickedTeamRecords());
  state.championshipForecast = calculateChampionshipForecast();
  state.loadedAt = new Date();

  renderFilters();
  renderPicksTable();
  render();
}

async function loadTitleOdds() {
  try {
    const response = await fetch(TITLE_ODDS_URL);
    if (!response.ok) {
      console.warn(`Title odds unavailable: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.warn('Title odds unavailable', error);
    return null;
  }
}

function normalizeTeamName(name) {
  return (NAME_ALIASES[name?.trim().toLowerCase()] ?? name?.trim().toLowerCase() ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function buildOwnership(groups) {
  const ownership = new Map();

  for (const group of groups) {
    for (const [member, team] of Object.entries(group.picks)) {
      const key = normalizeTeamName(team);
      const current = ownership.get(key) ?? [];
      current.push({ member, group: group.group, team });
      ownership.set(key, current);
    }
  }

  return ownership;
}

function buildWorldRankings(rankings) {
  const mapped = new Map();

  for (const [team, rank] of Object.entries(rankings)) {
    mapped.set(normalizeTeamName(team), Number(rank));
  }

  return mapped;
}

function buildEvents(events, groups) {
  const ownership = buildOwnership(groups);

  return events
    .map((event) => {
      const competition = event.competitions?.[0];
      if (!competition) return null;

      const home = competition.competitors?.find((item) => item.homeAway === 'home');
      const away = competition.competitors?.find((item) => item.homeAway === 'away');
      if (!home || !away) return null;

      const homeOwners = ownership.get(normalizeTeamName(home.team.displayName)) ?? [];
      const awayOwners = ownership.get(normalizeTeamName(away.team.displayName)) ?? [];

      return {
        id: event.id,
        date: new Date(event.date),
        name: event.name,
        shortName: event.shortName,
        stage: event.season?.slug?.replaceAll('-', ' ') ?? 'match',
        stageSlug: event.season?.slug ?? 'match',
        venue: competition.venue?.fullName ?? 'TBD venue',
        city: competition.venue?.address?.city ?? '',
        status: competition.status?.type?.state ?? 'pre',
        statusLabel: competition.status?.type?.shortDetail ?? competition.status?.type?.description ?? 'Scheduled',
        statusDetail: competition.status?.type?.detail ?? '',
        completed: Boolean(competition.status?.type?.completed),
        home: {
          name: home.team.displayName,
          score: home.score,
          logo: home.team.logo,
          owners: homeOwners,
          winner: home.winner,
        },
        away: {
          name: away.team.displayName,
          score: away.score,
          logo: away.team.logo,
          owners: awayOwners,
          winner: away.winner,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function renderFilters() {
  const members = ['All', ...state.members];
  els.memberFilters.innerHTML = members
    .map(
      (member) =>
        `<button class="chip ${state.memberFilter === member ? 'active' : ''}" data-member="${member}">${member}</button>`,
    )
    .join('');

  const statuses = [
    ['all', 'All matches'],
    ['live', 'Live'],
    ['upcoming', 'Upcoming'],
    ['completed', 'Completed'],
  ];

  els.statusFilters.innerHTML = statuses
    .map(
      ([value, label]) =>
        `<button class="chip ${state.statusFilter === value ? 'active' : ''}" data-status="${value}">${label}</button>`,
    )
    .join('');

  els.memberFilters.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.memberFilter = button.dataset.member;
      renderFilters();
      render();
    });
  });

  els.statusFilters.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.statusFilter = button.dataset.status;
      renderFilters();
      render();
    });
  });
}

function renderPicksTable() {
  els.picksHead.innerHTML = `
    <tr>
      <th>Group</th>
      ${state.members.map((member) => `<th>${member}</th>`).join('')}
    </tr>
  `;

  els.picksBody.innerHTML = state.groups
    .map(
      (group) => `
        <tr>
          <td><strong>Group ${group.group}</strong></td>
          ${state.members
            .map((member) => {
              const team = group.picks[member];
              return `
                <td>
                  <div class="owner-pill owner-pill-team" title="${team}" aria-label="${team}">
                    ${renderFlag(team)}
                    <strong>${team}</strong>
                  </div>
                </td>
              `;
            })
            .join('')}
        </tr>
      `,
    )
    .join('');
}

function render() {
  const events = getFilteredEvents();
  const championshipForecast = state.championshipForecast;

  const liveCount = state.events.filter((event) => event.status === 'in').length;
  const completedCount = state.events.filter((event) => event.completed).length;

  els.totalGames.textContent = String(state.events.length);
  els.liveGames.textContent = String(liveCount);
  els.completedGames.textContent = String(completedCount);
  els.fixturesCount.textContent = `${events.length} matches shown`;

  els.dataStatus.textContent = `ESPN schedule/results • refreshed ${formatRefreshTime(state.loadedAt)}`;

  renderMemberSummary(championshipForecast);
  renderStandings();
  renderTeamStandings();
  renderTeamPowerRankings(championshipForecast);
  renderSpotlight(events);
  renderFixtures(events);
}

function renderStandings() {
  const standings = state.members
    .map((member) => calculateMemberStanding(member))
    .sort(compareStandings);

  els.standingsHead.innerHTML = `
    <tr>
      <th scope="col">Rank</th>
      <th scope="col">Family member</th>
      <th scope="col" title="Played">P</th>
      <th scope="col" title="Wins">W</th>
      <th scope="col" title="Draws">D</th>
      <th scope="col" title="Losses">L</th>
      <th scope="col" title="Goal difference">GD</th>
      <th scope="col" title="Points">Pts</th>
    </tr>
  `;

  els.standingsBody.innerHTML = standings
    .map(
      (standing, index) => `
        <tr>
          <td><strong class="standing-rank">${index + 1}</strong></td>
          <td>
            <div class="standing-member">
              ${renderMemberThumbnail(standing.member, 'standing-avatar')}
              <strong>${standing.member}</strong>
            </div>
          </td>
          <td>${standing.played}</td>
          <td>${standing.wins}</td>
          <td>${standing.draws}</td>
          <td>${standing.losses}</td>
          <td>${formatGoalDifference(standing.goalDifference)}</td>
          <td><strong class="standing-points">${standing.points}</strong></td>
        </tr>
      `,
    )
    .join('');
}

function calculateMemberStanding(member) {
  const standing = createStanding({ member });

  for (const event of state.events.filter((item) => item.completed)) {
    const memberOwnsHome = event.home.owners.some((owner) => owner.member === member);
    const memberOwnsAway = event.away.owners.some((owner) => owner.member === member);

    for (const [team, opponent] of [
      [event.home, event.away],
      [event.away, event.home],
    ]) {
      const ownsTeam = team === event.home ? memberOwnsHome : memberOwnsAway;
      if (!ownsTeam) continue;

      recordResult(standing, team, opponent);
    }
  }

  return standing;
}

function renderTeamStandings() {
  const standingsByGroup = calculateTeamStandings();

  els.teamStandingsGroups.innerHTML = standingsByGroup
    .map(
      ([group, standings]) => `
        <article class="team-standing-group">
          <h3>Group ${group}</h3>
          <div class="table-wrap">
            <table class="team-standings-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">Family member</th>
                  <th scope="col" title="Played">P</th>
                  <th scope="col" title="Goal difference">GD</th>
                  <th scope="col" title="Points">Pts</th>
                </tr>
              </thead>
              <tbody>
                ${standings
                  .map(
                    (standing, index) => `
                      <tr>
                        <td><strong class="standing-rank">${index + 1}</strong></td>
                        <td>
                          <div class="standing-member">
                            <img class="standing-team-logo" src="${standing.logo}" alt="${standing.team} logo" loading="lazy" />
                            <strong>${standing.team}</strong>
                          </div>
                        </td>
                        <td class="standing-owner">${standing.owners.map((owner) => owner.member).join(' · ')}</td>
                        <td>${standing.played}</td>
                        <td>${formatGoalDifference(standing.goalDifference)}</td>
                        <td><strong class="standing-points">${standing.points}</strong></td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </article>
      `,
    )
    .join('');
}

function calculateTeamStandings() {
  const standings = new Map();

  for (const event of state.events) {
    for (const team of [event.home, event.away]) {
      if (team.owners.length && !standings.has(team.name)) {
        standings.set(
          team.name,
          createStanding({
            team: team.name,
            logo: team.logo,
            owners: team.owners,
            group: team.owners[0].group,
          }),
        );
      }
    }

    if (!event.completed) continue;

    if (standings.has(event.home.name)) {
      recordResult(standings.get(event.home.name), event.home, event.away);
    }
    if (standings.has(event.away.name)) {
      recordResult(standings.get(event.away.name), event.away, event.home);
    }
  }

  return state.groups.map((group) => [
    group.group,
    [...standings.values()]
      .filter((standing) => standing.group === group.group)
      .sort(compareStandings),
  ]);
}

function renderTeamPowerRankings(championshipForecast) {
  const rows = getTeamPowerRankings(championshipForecast);

  els.teamPowerRankingsHead.innerHTML = `
    <tr>
      <th scope="col">World rank</th>
      <th scope="col">Team</th>
      <th scope="col">Title</th>
      <th scope="col">API odds</th>
      <th scope="col">Outlook</th>
      <th scope="col">Family member</th>
      <th scope="col">Group</th>
    </tr>
  `;

  els.teamPowerRankingsBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td><strong class="standing-rank">${formatWorldRank(row.rank)}</strong></td>
          <td>
            <div class="standing-member">
              ${row.logo ? `<img class="standing-team-logo" src="${row.logo}" alt="${row.team} logo" loading="lazy" />` : renderFlag(row.team)}
              <strong>${row.team}</strong>
            </div>
          </td>
          <td><strong class="standing-points">${formatTitleProbability(row.titleProbability)}</strong></td>
          <td><strong class="standing-points api-odds-value">${formatTitleProbability(row.apiTitleProbability)}</strong></td>
          <td class="standing-owner power-outlook">${row.reason}</td>
          <td class="standing-owner">${row.member}</td>
          <td><strong>Group ${row.group}</strong></td>
        </tr>
      `,
    )
    .join('');
}

function getTeamPowerRankings(championshipForecast) {
  return state.groups
    .flatMap((group) =>
      Object.entries(group.picks).map(([member, team]) => ({
        member,
        team,
        group: group.group,
        rank: state.worldRankings.get(normalizeTeamName(team)),
        logo: findTeamLogo(team),
        titleProbability: championshipForecast.teams.get(normalizeTeamName(team))?.probability ?? 0,
        apiTitleProbability: state.apiOddsForecast?.teams.get(normalizeTeamName(team))?.probability ?? 0,
        reason: championshipForecast.teams.get(normalizeTeamName(team))?.reason ?? 'No projection',
      })),
    )
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.team.localeCompare(b.team));
}

function findTeamLogo(teamName) {
  const key = normalizeTeamName(teamName);
  const event = state.events.find((item) =>
    [item.home, item.away].some((team) => normalizeTeamName(team.name) === key && team.logo),
  );
  const team = [event?.home, event?.away].find((item) => normalizeTeamName(item?.name) === key && item.logo);

  return team?.logo ?? '';
}

function createStanding(identity) {
  return {
    ...identity,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function recordResult(standing, team, opponent) {
  standing.played += 1;
  standing.goalsFor += Number(team.score) || 0;
  standing.goalsAgainst += Number(opponent.score) || 0;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;

  if (team.winner) {
    standing.wins += 1;
    standing.points += 3;
  } else if (opponent.winner) {
    standing.losses += 1;
  } else {
    standing.draws += 1;
    standing.points += 1;
  }
}

function compareStandings(a, b) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    (a.member ?? a.team).localeCompare(b.member ?? b.team)
  );
}

function formatGoalDifference(value) {
  return value > 0 ? `+${value}` : String(value);
}

function formatWorldRank(rank) {
  return rank ? `#${rank}` : '—';
}

function formatProbability(value) {
  if (value <= 0) return '0%';
  if (value < 0.005) return '<1%';

  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: value < 0.1 ? 1 : 0,
  }).format(value);
}

function formatTitleProbability(value) {
  if (value <= 0) return '0%';
  if (value < 0.001) return '<0.1%';

  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: value < 0.1 ? 1 : 0,
  }).format(value);
}

function formatPercentageWidth(value) {
  return `${Math.max(0, Math.min(100, value * 100))}%`;
}

function getFilteredEvents() {
  return state.events.filter((event) => {
    const matchesMember =
      state.memberFilter === 'All' ||
      [...event.home.owners, ...event.away.owners].some((owner) => owner.member === state.memberFilter);

    const matchesStatus =
      state.statusFilter === 'all' ||
      (state.statusFilter === 'live' && event.status === 'in') ||
      (state.statusFilter === 'upcoming' && event.status === 'pre') ||
      (state.statusFilter === 'completed' && event.completed);

    return matchesMember && matchesStatus;
  });
}

function renderMemberSummary(championshipForecast) {
  els.memberSummary.innerHTML = state.members
    .map((member) => {
      const forecast = championshipForecast.members.get(member);
      const games = state.events.filter((event) =>
        [...event.home.owners, ...event.away.owners].some((owner) => owner.member === member),
      );
      const nextGame = games.find((event) => !event.completed && event.date >= new Date()) ?? games.find((event) => !event.completed);
      const liveGames = games.filter((event) => event.status === 'in').length;
      const completedGames = games.filter((event) => event.completed).length;

      return `
        <article class="summary-card">
          <div class="summary-card-header">
            ${renderMemberThumbnail(member, 'summary-avatar')}
            <div>
              <p class="section-label">${member}</p>
              <h3>${member} overview</h3>
            </div>
          </div>
          <div class="stats">
            <div>
              <span class="muted">Teams</span>
              <strong>12</strong>
            </div>
            <div>
              <span class="muted">Live</span>
              <strong>${liveGames}</strong>
            </div>
            <div>
              <span class="muted">Played</span>
              <strong>${completedGames}</strong>
            </div>
            <div>
              <span class="muted">Title</span>
              <strong>${formatProbability(forecast.probability)}</strong>
            </div>
          </div>
          <div class="championship-forecast">
            <div class="forecast-bar" aria-label="${member} championship probability ${formatProbability(forecast.probability)}">
              <span style="width: ${formatPercentageWidth(forecast.probability)}"></span>
            </div>
            <p>${renderForecastNote(forecast)}</p>
          </div>
          <div class="next-game">
            <p class="muted">Next match</p>
            <strong>${nextGame ? `${nextGame.away.name} vs ${nextGame.home.name}` : 'Waiting for fixtures'}</strong>
            <p>${nextGame ? formatEventTime(nextGame.date) : '—'}</p>
          </div>
        </article>
      `;
    })
    .join('');
}

function calculateChampionshipForecast(method = CHAMPIONSHIP_FORECAST_METHOD) {
  const teamRecords = getPickedTeamRecords();
  const finalChampion = getCompletedFinalChampion();

  if (finalChampion) {
    return buildCompletedChampionshipForecast(teamRecords, finalChampion, method);
  }

  if (method === FORECAST_METHODS.FULL_MONTE_CARLO_BRACKET) {
    return calculateFullMonteCarloBracketForecast(teamRecords);
  }

  if (method === FORECAST_METHODS.API_ODDS) {
    return calculateApiOddsForecast(teamRecords);
  }

  return calculateMonteCarloLiteForecast(teamRecords);
}

function calculateMonteCarloLiteForecast(teamRecords) {
  const teamForecasts = initializeTeamForecasts(teamRecords);
  const knockoutEliminated = calculateCompletedKnockoutEliminations();
  const random = createSeededRandom(CHAMPIONSHIP_SIMULATION_SEED);

  for (let run = 0; run < CHAMPIONSHIP_SIMULATION_RUNS; run += 1) {
    const simulation = simulateGroupStage(random, teamRecords);
    const titleScores = new Map();
    let simulationTotalScore = 0;

    for (const qualifiedTeam of simulation.qualifiedTeams) {
      if (knockoutEliminated.has(qualifiedTeam.key)) continue;

      const titleScore = calculateTitleScore(qualifiedTeam.rank, qualifiedTeam.path);
      if (!titleScore) continue;

      titleScores.set(qualifiedTeam.key, titleScore);
      simulationTotalScore += titleScore;
      recordTeamPath(teamForecasts.get(qualifiedTeam.key), qualifiedTeam.path);
    }

    for (const forecast of teamForecasts.values()) {
      forecast.simulations += 1;
      const titleScore = titleScores.get(forecast.key) ?? 0;
      forecast.titleShare += simulationTotalScore > 0 ? titleScore / simulationTotalScore : 0;
    }
  }

  for (const forecast of teamForecasts.values()) {
    forecast.probability = forecast.simulations > 0 ? forecast.titleShare / forecast.simulations : 0;
    forecast.advanceProbability = forecast.simulations > 0 ? forecast.advanced / forecast.simulations : 0;
    forecast.reason = renderTeamForecastReason(forecast);
  }

  return buildChampionshipForecastResult(teamForecasts, FORECAST_METHODS.MONTE_CARLO_LITE);
}

function calculateFullMonteCarloBracketForecast(teamRecords) {
  const teamForecasts = initializeTeamForecasts(teamRecords);
  const knockoutEliminated = calculateCompletedKnockoutEliminations();
  const random = createSeededRandom(CHAMPIONSHIP_SIMULATION_SEED);

  for (let run = 0; run < CHAMPIONSHIP_SIMULATION_RUNS; run += 1) {
    const simulation = simulateGroupStage(random, teamRecords);
    const qualifiedTeams = simulation.qualifiedTeams.filter((team) => !knockoutEliminated.has(team.key));
    const champion = simulateKnockoutBracket(qualifiedTeams, random);

    for (const qualifiedTeam of qualifiedTeams) {
      recordTeamPath(teamForecasts.get(qualifiedTeam.key), qualifiedTeam.path);
    }

    for (const forecast of teamForecasts.values()) {
      forecast.simulations += 1;
    }

    if (champion) {
      teamForecasts.get(champion.key).titleShare += 1;
    }
  }

  for (const forecast of teamForecasts.values()) {
    forecast.probability = forecast.simulations > 0 ? forecast.titleShare / forecast.simulations : 0;
    forecast.advanceProbability = forecast.simulations > 0 ? forecast.advanced / forecast.simulations : 0;
    forecast.reason = renderTeamForecastReason(forecast);
  }

  return buildChampionshipForecastResult(teamForecasts, FORECAST_METHODS.FULL_MONTE_CARLO_BRACKET);
}

function calculateApiOddsForecast(teamRecords) {
  const teamForecasts = initializeTeamForecasts(teamRecords);
  const apiOdds = normalizeApiTitleOdds(state.titleOdds);
  const knockoutEliminated = calculateCompletedKnockoutEliminations();
  let totalLiveOdds = 0;

  for (const forecast of teamForecasts.values()) {
    forecast.simulations = 1;

    if (knockoutEliminated.has(forecast.key)) {
      forecast.reason = 'Eliminated';
      continue;
    }

    const odds = apiOdds.teams.get(forecast.key);
    forecast.apiOdds = odds;
    forecast.rawApiProbability = odds?.rawProbability ?? 0;
    totalLiveOdds += forecast.rawApiProbability;
  }

  for (const forecast of teamForecasts.values()) {
    forecast.probability = totalLiveOdds > 0 ? forecast.rawApiProbability / totalLiveOdds : 0;
    forecast.advanceProbability = forecast.probability > 0 ? 1 : 0;
    forecast.reason = renderApiTeamForecastReason(forecast, apiOdds);
  }

  return buildChampionshipForecastResult(teamForecasts, FORECAST_METHODS.API_ODDS, apiOdds.source);
}

function buildChampionshipForecastResult(teamForecasts, method, source = '') {
  return {
    method,
    source,
    teams: teamForecasts,
    members: buildMemberForecasts(teamForecasts),
  };
}

function calculateRankingStrength(rank) {
  if (!rank) return 0;

  return Math.exp(-CHAMPIONSHIP_RANK_DECAY * (rank - 1));
}

function calculateTitleScore(rank, path) {
  if (!rank) return 0;

  return (calculateRankingStrength(rank) ** CHAMPIONSHIP_STRENGTH_POWER) * PATH_MULTIPLIERS[path];
}

function calculateCompletedKnockoutEliminations() {
  const eliminated = new Set();

  for (const event of state.events) {
    if (!event.completed || !isChampionshipKnockoutStage(event.stageSlug)) continue;

    if (event.home.winner) eliminated.add(normalizeTeamName(event.away.name));
    if (event.away.winner) eliminated.add(normalizeTeamName(event.home.name));
  }

  return eliminated;
}

function getCompletedFinalChampion() {
  const final = state.events.find((event) => event.stageSlug === 'final' && event.completed);
  if (!final) return null;

  return final.home.winner ? final.home.name : final.away.winner ? final.away.name : null;
}

function getPickedTeamRecords() {
  return state.groups.flatMap((group) =>
    Object.entries(group.picks).map(([member, team]) => ({
      key: normalizeTeamName(team),
      team,
      member,
      group: group.group,
      rank: state.worldRankings.get(normalizeTeamName(team)),
      logo: findTeamLogo(team),
    })),
  );
}

function initializeTeamForecasts(teamRecords) {
  const forecasts = new Map();

  for (const record of teamRecords) {
    forecasts.set(record.key, {
      ...record,
      simulations: 0,
      titleShare: 0,
      probability: 0,
      advanced: 0,
      advanceProbability: 0,
      groupWinner: 0,
      runnerUp: 0,
      thirdPlace: 0,
      reason: '',
    });
  }

  return forecasts;
}

function buildCompletedChampionshipForecast(teamRecords, champion, method = CHAMPIONSHIP_FORECAST_METHOD) {
  const championKey = normalizeTeamName(champion);
  const teamForecasts = initializeTeamForecasts(teamRecords);

  for (const forecast of teamForecasts.values()) {
    forecast.simulations = 1;
    forecast.probability = forecast.key === championKey ? 1 : 0;
    forecast.advanceProbability = forecast.key === championKey ? 1 : 0;
    forecast.reason = forecast.key === championKey ? 'Champion' : 'Tournament complete';
  }

  return buildChampionshipForecastResult(teamForecasts, method);
}

function buildMemberForecasts(teamForecasts) {
  const forecasts = new Map();

  for (const member of state.members) {
    const teams = [...teamForecasts.values()].filter((forecast) => forecast.member === member);
    const probability = teams.reduce((sum, team) => sum + team.probability, 0);
    const topTeam = getTopChampionshipTeam(teams);

    forecasts.set(member, {
      member,
      teams,
      probability,
      topTeam,
      reason: topTeam ? renderMemberForecastReason(topTeam) : 'No teams left in the title race',
    });
  }

  return forecasts;
}

function isChampionshipKnockoutStage(stageSlug) {
  return ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', 'final'].includes(stageSlug);
}

function simulateGroupStage(random, teamRecords) {
  const recordsByTeam = new Map(teamRecords.map((record) => [record.key, record]));
  const standings = initializeSimulationStandings(teamRecords);

  for (const event of state.events.filter((item) => item.stageSlug === 'group-stage')) {
    const home = recordsByTeam.get(normalizeTeamName(event.home.name));
    const away = recordsByTeam.get(normalizeTeamName(event.away.name));
    if (!home || !away) continue;

    const result = event.completed ? getCompletedEventResult(event) : simulateGroupMatch(home, away, random);
    recordSimulatedResult(standings.get(home.key), result.home);
    recordSimulatedResult(standings.get(away.key), result.away);
  }

  return selectSimulationQualifiers(standings);
}

function initializeSimulationStandings(teamRecords) {
  const standings = new Map();

  for (const record of teamRecords) {
    standings.set(record.key, {
      ...record,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  return standings;
}

function getCompletedEventResult(event) {
  return {
    home: {
      goalsFor: Number(event.home.score) || 0,
      goalsAgainst: Number(event.away.score) || 0,
    },
    away: {
      goalsFor: Number(event.away.score) || 0,
      goalsAgainst: Number(event.home.score) || 0,
    },
  };
}

function simulateGroupMatch(home, away, random) {
  const homeStrength = calculateRankingStrength(home.rank);
  const awayStrength = calculateRankingStrength(away.rank);
  const homeWinShare = homeStrength / (homeStrength + awayStrength);
  const drawChance = GROUP_DRAW_PROBABILITY;
  const roll = random();

  if (roll < drawChance) {
    const goals = random() < 0.55 ? 1 : random() < 0.82 ? 0 : 2;
    return {
      home: { goalsFor: goals, goalsAgainst: goals },
      away: { goalsFor: goals, goalsAgainst: goals },
    };
  }

  const homeWins = (roll - drawChance) / (1 - drawChance) < homeWinShare;
  const margin = random() < 0.72 ? 1 : random() < 0.92 ? 2 : 3;
  const loserGoals = random() < 0.58 ? 0 : random() < 0.88 ? 1 : 2;
  const winnerGoals = loserGoals + margin;

  return {
    home: {
      goalsFor: homeWins ? winnerGoals : loserGoals,
      goalsAgainst: homeWins ? loserGoals : winnerGoals,
    },
    away: {
      goalsFor: homeWins ? loserGoals : winnerGoals,
      goalsAgainst: homeWins ? winnerGoals : loserGoals,
    },
  };
}

function recordSimulatedResult(standing, result) {
  standing.played += 1;
  standing.goalsFor += result.goalsFor;
  standing.goalsAgainst += result.goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;

  if (result.goalsFor > result.goalsAgainst) {
    standing.wins += 1;
    standing.points += 3;
  } else if (result.goalsFor < result.goalsAgainst) {
    standing.losses += 1;
  } else {
    standing.draws += 1;
    standing.points += 1;
  }
}

function selectSimulationQualifiers(standings) {
  const grouped = new Map();
  const qualifiedTeams = [];
  const thirdPlaceTeams = [];

  for (const standing of standings.values()) {
    const current = grouped.get(standing.group) ?? [];
    current.push(standing);
    grouped.set(standing.group, current);
  }

  for (const groupStandings of grouped.values()) {
    const sorted = [...groupStandings].sort(compareStandings);
    if (sorted[0]) qualifiedTeams.push({ ...sorted[0], path: 'groupWinner' });
    if (sorted[1]) qualifiedTeams.push({ ...sorted[1], path: 'runnerUp' });
    if (sorted[2]) thirdPlaceTeams.push(sorted[2]);
  }

  thirdPlaceTeams
    .sort(compareStandings)
    .slice(0, 8)
    .forEach((team) => qualifiedTeams.push({ ...team, path: 'thirdPlace' }));

  return { qualifiedTeams };
}

function simulateKnockoutBracket(teams, random) {
  if (!teams.length) return null;
  if (teams.length === 1) return teams[0];

  let pairs = buildInitialKnockoutPairs(teams);

  while (pairs.length) {
    const winners = pairs.map(([teamA, teamB]) => simulateKnockoutWinner(teamA, teamB, random)).filter(Boolean);
    if (winners.length <= 1) return winners[0] ?? null;
    pairs = pairAdjacentTeams(winners);
  }

  return null;
}

function buildInitialKnockoutPairs(teams) {
  const seeded = [...teams].sort(compareKnockoutSeeds);
  const pairs = [];

  for (let start = 0, end = seeded.length - 1; start <= end; start += 1, end -= 1) {
    pairs.push([seeded[start], start === end ? null : seeded[end]]);
  }

  return pairs;
}

function pairAdjacentTeams(teams) {
  const pairs = [];

  for (let index = 0; index < teams.length; index += 2) {
    pairs.push([teams[index], teams[index + 1] ?? null]);
  }

  return pairs;
}

function compareKnockoutSeeds(a, b) {
  return (
    KNOCKOUT_PATH_ORDER[a.path] - KNOCKOUT_PATH_ORDER[b.path] ||
    compareStandings(a, b) ||
    (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
    a.team.localeCompare(b.team)
  );
}

function simulateKnockoutWinner(teamA, teamB, random) {
  if (!teamA) return teamB;
  if (!teamB) return teamA;

  const teamAStrength = calculateKnockoutMatchStrength(teamA.rank);
  const teamBStrength = calculateKnockoutMatchStrength(teamB.rank);
  const totalStrength = teamAStrength + teamBStrength;
  const teamAWinProbability = totalStrength > 0 ? teamAStrength / totalStrength : 0.5;

  return random() < teamAWinProbability ? teamA : teamB;
}

function calculateKnockoutMatchStrength(rank) {
  return calculateRankingStrength(rank) ** KNOCKOUT_MATCH_STRENGTH_POWER;
}

function normalizeApiTitleOdds(oddsData) {
  const teams = new Map();
  const source = oddsData?.source ?? oddsData?.provider ?? 'External title odds';
  const updatedAt = oddsData?.updatedAt ?? oddsData?.lastUpdated ?? '';
  const entries = Array.isArray(oddsData?.teams)
    ? oddsData.teams
    : Object.entries(oddsData?.teams ?? {}).map(([team, value]) =>
        typeof value === 'number' ? { team, probability: value } : { team, ...value },
      );

  for (const entry of entries) {
    const teamName = entry.team ?? entry.name ?? entry.subject;
    if (!teamName) continue;

    const rawProbability = getApiRawProbability(entry);
    if (!rawProbability) continue;

    teams.set(normalizeTeamName(teamName), {
      team: teamName,
      vendor: entry.vendor ?? entry.bookmaker ?? entry.source ?? '',
      market: entry.market ?? entry.marketName ?? entry.market_type ?? '',
      updatedAt: entry.updatedAt ?? entry.updated_at ?? updatedAt,
      rawProbability,
    });
  }

  return { teams, source, updatedAt };
}

function getApiRawProbability(entry) {
  const explicitProbability = Number(entry.probability ?? entry.normalizedProbability ?? entry.impliedProbability);
  if (Number.isFinite(explicitProbability) && explicitProbability > 0) {
    return explicitProbability > 1 ? explicitProbability / 100 : explicitProbability;
  }

  const decimalOdds = Number(entry.decimalOdds ?? entry.decimal_odds);
  if (Number.isFinite(decimalOdds) && decimalOdds > 1) {
    return 1 / decimalOdds;
  }

  const americanOdds = Number(entry.americanOdds ?? entry.american_odds);
  if (Number.isFinite(americanOdds) && americanOdds !== 0) {
    return americanOdds > 0 ? 100 / (americanOdds + 100) : Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }

  return 0;
}

function recordTeamPath(forecast, path) {
  forecast.advanced += 1;
  forecast[path] += 1;
}

function getTopChampionshipTeam(teams) {
  return [...teams]
    .filter((team) => team.probability > 0)
    .sort((a, b) => b.probability - a.probability || a.team.localeCompare(b.team))[0];
}

function renderForecastNote(forecast) {
  if (!forecast.topTeam) {
    return 'No teams left in the title race';
  }

  return `<strong>${forecast.topTeam.team}</strong> leads · ${forecast.reason}`;
}

function renderMemberForecastReason(teamForecast) {
  return `${formatTitleProbability(teamForecast.probability)} title shot · ${teamForecast.reason}`;
}

function renderTeamForecastReason(forecast) {
  if (forecast.probability <= 0) return 'No live title path';

  const path = getMostLikelyPath(forecast);
  return `${formatTitleProbability(forecast.advanceProbability)} to advance · ${path.label}`;
}

function renderApiTeamForecastReason(forecast, apiOdds) {
  if (forecast.probability <= 0) {
    return forecast.reason || 'No external title odds';
  }

  const vendor = forecast.apiOdds?.vendor ? ` · ${forecast.apiOdds.vendor}` : '';
  const updatedAt = forecast.apiOdds?.updatedAt ?? apiOdds.updatedAt;
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const freshness =
    updatedDate && !Number.isNaN(updatedDate.valueOf()) ? ` · updated ${formatShortDate(updatedDate)}` : '';

  return `Market-implied title odds${vendor}${freshness}`;
}

function getMostLikelyPath(forecast) {
  const paths = [
    { key: 'groupWinner', label: `${formatTitleProbability(forecast.groupWinner / forecast.simulations)} group winner` },
    { key: 'runnerUp', label: `${formatTitleProbability(forecast.runnerUp / forecast.simulations)} runner-up` },
    { key: 'thirdPlace', label: `${formatTitleProbability(forecast.thirdPlace / forecast.simulations)} third-place path` },
  ];

  return paths.sort((a, b) => forecast[b.key] - forecast[a.key])[0];
}

function createSeededRandom(seed) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function renderSpotlight(events) {
  const spotlightGames = [...events]
    .filter((event) => state.statusFilter !== 'completed' ? !event.completed : true)
    .filter((event) => [...event.home.owners, ...event.away.owners].length)
    .sort((a, b) => scoreEvent(a) - scoreEvent(b))
    .slice(0, 3);

  if (!spotlightGames.length) {
    els.spotlight.innerHTML = '<div class="spotlight-card spotlight-empty"><p>No matches in this filter yet.</p></div>';
    return;
  }

  els.spotlight.innerHTML = spotlightGames
    .map((event, index) => {
      const time = formatSpotlightTime(event.date);

      return `
        <article class="spotlight-card ${index === 0 ? 'spotlight-card-next' : ''}">
          <div class="spotlight-time">
            <div>
              <span class="spotlight-kicker">${event.status === 'in' ? 'Live now' : event.completed ? 'Final' : index === 0 ? 'Next up' : time.relativeDay}</span>
              <strong>${time.clock}</strong>
            </div>
            <div class="spotlight-date">
              <strong>${time.weekday}</strong>
              <span>${time.date}</span>
            </div>
          </div>

          <div class="spotlight-matchup">
            ${renderSpotlightTeam(event.away)}
            <span class="spotlight-vs">vs</span>
            ${renderSpotlightTeam(event.home)}
          </div>

          <p class="spotlight-venue">${event.venue}${event.city ? ` · ${event.city}` : ''}</p>
        </article>
      `;
    })
    .join('');
}

function renderSpotlightTeam(team) {
  return `
    <div class="spotlight-team">
      <img src="${team.logo}" alt="${team.name} logo" loading="lazy" />
      <strong>${team.name}</strong>
      ${team.owners.length ? `<div class="spotlight-team-owners">${team.owners.map((owner) => renderSpotlightOwner(owner)).join('')}</div>` : ''}
    </div>
  `;
}

function renderSpotlightOwner(owner) {
  return `
    <div class="spotlight-owner">
      ${renderMemberThumbnail(owner.member, 'spotlight-owner-avatar')}
      <strong>${owner.member}</strong>
    </div>
  `;
}

function renderFixtures(events) {
  if (!events.length) {
    els.fixtures.innerHTML = '<p class="muted">No fixtures match this filter.</p>';
    return;
  }

  const groups = groupEventsByDate(events);
  const fragment = document.createDocumentFragment();

  for (const [dateLabel, dateEvents] of groups) {
    const section = document.createElement('section');
    section.className = 'fixture-date-group';

    const heading = document.createElement('div');
    heading.className = 'fixture-date-heading';
    heading.innerHTML = `
      <div class="fixture-date-badge">
        <span class="fixture-date-month">${dateLabel.month}</span>
        <strong class="fixture-date-day">${dateLabel.day}</strong>
      </div>
      <div class="fixture-date-copy">
        <p class="section-label">${dateLabel.label}</p>
        <h3>${dateLabel.subLabel}</h3>
      </div>
    `;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'fixtures-grid';

    for (const event of dateEvents) {
      const node = els.template.content.firstElementChild.cloneNode(true);
      const badge = node.querySelector('.status-badge');
      badge.textContent = labelForEvent(event);
      badge.classList.add(statusClass(event));

      node.querySelector('.match-stage').textContent = toTitleCase(event.stage);
      node.querySelector('.teams').innerHTML = renderTeamRows(event);
      node.querySelector('.match-meta').innerHTML = `
        <div>${formatEventTime(event.date, { withDate: false })}</div>
        <div>${event.venue}${event.city ? `, ${event.city}` : ''}</div>
        <div>${event.statusDetail}</div>
      `;

      const interestMarkup = renderInterest(event);
      if (interestMarkup) {
        node.querySelector('.interest-block').innerHTML = interestMarkup;
      } else {
        node.querySelector('.interest-block').remove();
      }

      grid.appendChild(node);
    }

    section.appendChild(grid);
    fragment.appendChild(section);
  }

  els.fixtures.innerHTML = '';
  els.fixtures.appendChild(fragment);
}

function renderTeamRows(event) {
  return [event.away, event.home]
    .map(
      (team) => `
        <div class="team-row ${team.winner ? 'winner' : ''}">
          <img src="${team.logo}" alt="${team.name} logo" loading="lazy" />
          <div>
            <strong>${team.name}</strong>
            <div class="team-subline">${team.owners.map((owner) => owner.member).join(' · ') || 'No family pick'}</div>
          </div>
          <span class="score">${event.completed || event.status === 'in' ? team.score : '—'}</span>
        </div>
      `,
    )
    .join('');
}

function renderInterest() {
  return '';
}

function renderFlag(team) {
  const flagCode = TEAM_FLAG_CODES[team.trim().toLowerCase()];

  if (!flagCode) {
    return `<strong class="flag-fallback">${team}</strong>`;
  }

  return `<img class="country-flag" src="https://flagcdn.com/h40/${flagCode}.png" alt="${team} flag" loading="lazy" />`;
}

function renderMemberThumbnail(member, className = 'member-avatar') {
  const src = MEMBER_THUMBNAILS[member];
  if (!src) return '';
  return `<img class="${className}" src="${src}" alt="${member}" loading="lazy" />`;
}

function formatEventTime(date, options = {}) {
  const { withDate = true } = options;

  return new Intl.DateTimeFormat(undefined, {
    timeZone: DISPLAY_TIME_ZONE,
    ...(withDate
      ? {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }
      : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatSpotlightTime(date) {
  const eventKey = formatEventDate(date).key;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const relativeDay =
    eventKey === formatEventDate(today).key
      ? 'Today'
      : eventKey === formatEventDate(tomorrow).key
        ? 'Tomorrow'
        : new Intl.DateTimeFormat(undefined, {
            timeZone: DISPLAY_TIME_ZONE,
            weekday: 'long',
          }).format(date);

  return {
    relativeDay,
    weekday: new Intl.DateTimeFormat(undefined, {
      timeZone: DISPLAY_TIME_ZONE,
      weekday: 'short',
    }).format(date),
    date: new Intl.DateTimeFormat(undefined, {
      timeZone: DISPLAY_TIME_ZONE,
      month: 'short',
      day: 'numeric',
    }).format(date),
    clock: `${new Intl.DateTimeFormat(undefined, {
      timeZone: DISPLAY_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)} PT`,
  };
}

function formatRefreshTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: DISPLAY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: DISPLAY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatEventDate(date) {
  return {
    key: new Intl.DateTimeFormat('en-CA', {
      timeZone: DISPLAY_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date),
    label: new Intl.DateTimeFormat(undefined, {
      timeZone: DISPLAY_TIME_ZONE,
      weekday: 'long',
    }).format(date),
    subLabel: new Intl.DateTimeFormat(undefined, {
      timeZone: DISPLAY_TIME_ZONE,
      month: 'long',
      day: 'numeric',
    }).format(date),
    month: new Intl.DateTimeFormat(undefined, {
      timeZone: DISPLAY_TIME_ZONE,
      month: 'short',
    }).format(date),
    day: new Intl.DateTimeFormat(undefined, {
      timeZone: DISPLAY_TIME_ZONE,
      day: 'numeric',
    }).format(date),
  };
}

function groupEventsByDate(events) {
  const grouped = new Map();

  for (const event of events) {
    const dateLabel = formatEventDate(event.date);
    const current = grouped.get(dateLabel.key);

    if (current) {
      current.events.push(event);
    } else {
      grouped.set(dateLabel.key, {
        label: dateLabel.label,
        subLabel: dateLabel.subLabel,
        month: dateLabel.month,
        day: dateLabel.day,
        events: [event],
      });
    }
  }

  return [...grouped.values()].map((group) => [
    { label: group.label, subLabel: group.subLabel, month: group.month, day: group.day },
    group.events,
  ]);
}

function labelForEvent(event) {
  if (event.status === 'in') return 'Live';
  if (event.completed) return 'Final';
  return 'Upcoming';
}

function statusClass(event) {
  if (event.status === 'in') return 'status-live';
  if (event.completed) return 'status-completed';
  return 'status-upcoming';
}

function toTitleCase(value) {
  return value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function scoreEvent(event) {
  if (event.status === 'in') return -1;
  if (!event.completed) return event.date.getTime();
  return event.date.getTime() + 10 ** 12;
}
