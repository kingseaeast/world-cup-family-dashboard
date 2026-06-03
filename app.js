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

const state = {
  memberFilter: 'All',
  statusFilter: 'all',
  members: [],
  groups: [],
  events: [],
  loadedAt: null,
};

const els = {
  totalGames: document.querySelector('#total-games'),
  liveGames: document.querySelector('#live-games'),
  completedGames: document.querySelector('#completed-games'),
  memberFilters: document.querySelector('#member-filters'),
  statusFilters: document.querySelector('#status-filters'),
  memberSummary: document.querySelector('#member-summary'),
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
  state.events = buildEvents(scoreboardData.events ?? [], picksData.groups);
  state.loadedAt = new Date();

  renderFilters();
  renderPicksTable();
  render();
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

  const liveCount = state.events.filter((event) => event.status === 'in').length;
  const completedCount = state.events.filter((event) => event.completed).length;

  els.totalGames.textContent = String(state.events.length);
  els.liveGames.textContent = String(liveCount);
  els.completedGames.textContent = String(completedCount);
  els.fixturesCount.textContent = `${events.length} matches shown`;

  els.dataStatus.textContent = `ESPN schedule/results • refreshed ${formatRefreshTime(state.loadedAt)}`;

  renderMemberSummary();
  renderSpotlight(events);
  renderFixtures(events);
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

function renderMemberSummary() {
  els.memberSummary.innerHTML = state.members
    .map((member) => {
      const games = state.events.filter((event) =>
        [...event.home.owners, ...event.away.owners].some((owner) => owner.member === member),
      );
      const nextGame = games.find((event) => !event.completed && event.date >= new Date()) ?? games.find((event) => !event.completed);
      const liveGames = games.filter((event) => event.status === 'in').length;
      const completedGames = games.filter((event) => event.completed).length;

      return `
        <article class="summary-card">
          <p class="section-label">${member}</p>
          <h3>${member} overview</h3>
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

function renderSpotlight(events) {
  const spotlightGames = [...events]
    .filter((event) => state.statusFilter !== 'completed' ? !event.completed : true)
    .sort((a, b) => scoreEvent(a) - scoreEvent(b))
    .slice(0, 3);

  if (!spotlightGames.length) {
    els.spotlight.innerHTML = '<div class="spotlight-card"><p>No matches in this filter yet.</p></div>';
    return;
  }

  els.spotlight.innerHTML = spotlightGames
    .map((event) => {
      const family = [...event.home.owners, ...event.away.owners]
        .map((owner) => `${owner.member} • ${owner.team}`)
        .join(' · ');

      return `
        <article class="spotlight-card">
          <p class="section-label">${labelForEvent(event)}</p>
          <h3>${event.away.name} vs ${event.home.name}</h3>
          <p>${formatEventTime(event.date)} · ${event.venue}${event.city ? `, ${event.city}` : ''}</p>
          <p>${family}</p>
        </article>
      `;
    })
    .join('');
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

function formatRefreshTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: DISPLAY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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
