# Championship Probability Algorithms

This dashboard can calculate championship probabilities with three approaches:

1. Monte Carlo lite, the current production model.
2. Full Monte Carlo bracket simulation, implemented but not currently active.
3. API-based market odds, implemented as a static JSON input for future use.

The active strategy is controlled in `app.js`:

```js
const CHAMPIONSHIP_FORECAST_METHOD = FORECAST_METHODS.MONTE_CARLO_LITE;
```

Change that constant to `FORECAST_METHODS.FULL_MONTE_CARLO_BRACKET` or `FORECAST_METHODS.API_ODDS` to switch strategies.

## Shared Inputs

All strategies use the same base tournament data:

- Drafted teams and family owners from `data/family-picks.json`.
- FIFA/Coca-Cola Men's World Ranking from `data/family-picks.json`.
- ESPN schedule/results from the World Cup scoreboard feed.
- Completed match scores and winners from ESPN.

If the final is complete, every strategy short-circuits: the champion gets `100%` and every other team gets `0%`.

Family probability is always the sum of that family member's owned team probabilities:

```text
family probability = sum(team championship probabilities for owned teams)
```

The family overview highlights the owned team with the highest individual title probability and keeps the reason visible.

## Current Production: Monte Carlo Lite

Monte Carlo lite is active in production because it is fast, deterministic, and reacts to every group-stage result without needing external odds.

### Constants

```text
simulation runs: 2000
seed: 20260611
ranking decay: 0.045
ranking strength power: 4
group draw probability: 24%
group winner path multiplier: 1.00
runner-up path multiplier: 0.72
third-place path multiplier: 0.46
```

The fixed seed makes the output stable. Given the same schedule, scores, and rankings, the dashboard shows the same probabilities on every load.

### Team Strength

Each team starts with a strength score derived from world rank:

```text
strength = exp(-0.045 * (rank - 1))
```

Rank 1 has strength `1.0`. Lower-ranked teams decay smoothly rather than falling off a cliff.

For title odds, Monte Carlo lite raises this strength to the fourth power:

```text
title strength = strength ^ 4
```

This reflects the reality that winning the title requires surviving multiple knockout rounds. Small ranking advantages compound across the tournament.

### Group Simulation

For each simulation run:

1. Start every drafted team at zero group points, goals for, and goals against.
2. Apply completed group-stage matches exactly as played.
3. Simulate each unplayed group match.
4. Sort each group by points, goal difference, goals for, then team name.
5. Advance the top two teams from each group.
6. Advance the best eight third-place teams across all groups.

For each unplayed group match:

```text
p(team A win share) = strengthA / (strengthA + strengthB)
draw chance = 24%
p(A win) = 76% * A win share
p(B win) = 76% * B win share
```

The simulation also generates a small plausible scoreline so goal difference and goals-for tiebreakers can move as games are played.

### Knockout Path Approximation

Monte Carlo lite does not simulate the exact knockout bracket. Instead, it assigns a path quality multiplier based on simulated group finish:

```text
group winner: 1.00
runner-up: 0.72
third-place qualifier: 0.46
```

This captures the main intuition: winning a group usually creates a better path, finishing second is still viable but weaker, and qualifying through third place is usually the hardest road.

For each simulated qualifier:

```text
path-adjusted title score = title strength * path multiplier
```

Within that simulation, the team's championship share is:

```text
team simulation title share =
  team path-adjusted title score /
  sum(path-adjusted title scores for all non-eliminated qualifiers)
```

The displayed team championship probability is the average title share across all simulations.

### Completed Knockout Matches

Once knockout matches are completed, losing teams contribute zero title score in future simulations.

## Implemented Upgrade: Full Monte Carlo Bracket

The full bracket strategy uses the same group simulation as Monte Carlo lite, then simulates knockout matches directly and counts actual simulated champions.

For each simulation run:

1. Apply completed group matches.
2. Simulate unplayed group matches.
3. Select the top two teams from each group and the best eight third-place teams.
4. Remove teams already eliminated by completed knockout matches.
5. Seed the knockout field by group path, simulated group record, world ranking, then team name.
6. Pair high seeds against low seeds for the first knockout round.
7. Simulate each knockout match using rank-derived match strength.
8. Advance winners round by round until one simulated champion remains.
9. Add one title count to the simulated champion.

Knockout match strength is:

```text
match strength = ranking strength ^ 1.35
```

The chance that team A beats team B is:

```text
p(A wins) = matchStrengthA / (matchStrengthA + matchStrengthB)
```

The displayed team championship probability is:

```text
team probability = simulated championships / simulation runs
```

This approach is more direct than Monte Carlo lite because teams win or lose simulated knockout matches instead of receiving a title-share allocation. It is still not using the official FIFA bracket slot map yet; the current implementation uses deterministic high-seed-vs-low-seed pairing so it can be switched on safely before the exact bracket-placement rules are encoded.

## Implemented Future Option: API-Based Odds

The API strategy is designed for market-implied title probabilities. It is intentionally implemented as a static JSON reader rather than a browser-side API call because this app is deployed on GitHub Pages and should not expose API keys.

Recommended production flow:

1. A scheduled GitHub Action or local script fetches futures odds from a provider.
2. The script converts odds into normalized `data/title-odds.json`.
3. The frontend reads that static file when `CHAMPIONSHIP_FORECAST_METHOD` is `FORECAST_METHODS.API_ODDS`.

Good candidate sources:

- [BALLDONTLIE FIFA World Cup futures odds](https://fifa.balldontlie.io/) exposes World Cup futures odds, including tournament winner odds, with sportsbook vendors such as DraftKings and FanDuel.
- [The Odds API](https://the-odds-api.com/sports-odds-data/sports-apis.html) lists `soccer_fifa_world_cup_winner` for World Cup winner markets and supports decimal or American odds through its odds API.

### Static Odds Contract

The dashboard accepts either an object keyed by team name:

```json
{
  "source": "BALLDONTLIE futures odds",
  "updatedAt": "2026-06-15T12:00:00Z",
  "teams": {
    "Argentina": {
      "vendor": "FanDuel",
      "decimalOdds": 6.5,
      "updatedAt": "2026-06-15T12:00:00Z"
    }
  }
}
```

Or an array:

```json
{
  "source": "The Odds API",
  "updatedAt": "2026-06-15T12:00:00Z",
  "teams": [
    {
      "team": "Argentina",
      "vendor": "DraftKings",
      "americanOdds": 550,
      "updatedAt": "2026-06-15T12:00:00Z"
    }
  ]
}
```

Accepted probability fields:

- `probability`, `normalizedProbability`, or `impliedProbability`
- `decimalOdds` or `decimal_odds`
- `americanOdds` or `american_odds`

If odds are supplied, the dashboard converts them to implied probabilities:

```text
decimal odds probability = 1 / decimalOdds
positive American odds probability = 100 / (americanOdds + 100)
negative American odds probability = abs(americanOdds) / (abs(americanOdds) + 100)
```

The API strategy removes teams already eliminated by completed knockout matches, then normalizes the remaining raw implied probabilities:

```text
team probability =
  team raw implied probability /
  sum(raw implied probabilities for all non-eliminated teams)
```

This normalization removes sportsbook overround and makes the team probabilities sum to `100%` across the live field represented in the odds file.

## Displayed Reasons

Monte Carlo strategies show:

- Championship probability.
- Estimated chance to advance from the group.
- Most likely path: group winner, runner-up, or third-place qualifier.

Example:

```text
7.4% title shot · 91% to advance · 44% group winner
```

The API strategy shows that the number is market-implied, including vendor and update date when present.

The power rankings table shows each team's individual title probability and outlook. Family overview cards show the family member's leading team and why it is driving their odds.

## Runtime Behavior

The forecast is calculated once after the picks, rankings, scoreboard, and optional odds data load. Filter changes reuse the stored forecast instead of rerunning simulations.

This keeps production responsive with Monte Carlo lite and makes heavier future strategies easier to adopt.

## Known Limitations

- Monte Carlo lite approximates the knockout bracket with path multipliers rather than simulating slot-by-slot.
- The full bracket strategy currently uses deterministic seed pairing, not the exact official FIFA bracket slot map.
- Rank-based models do not include injuries, travel, rest, tactics, betting markets, or recent form beyond completed World Cup results.
- Goal simulation is only used for group tiebreakers and is deliberately simple.
- API odds are only as good and as fresh as the generated static odds file.
- The model is designed for family-dashboard intuition, not wagering or professional forecasting.
