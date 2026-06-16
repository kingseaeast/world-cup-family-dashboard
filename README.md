# World Cup Family Dashboard

Single-page static app for tracking the family World Cup sweepstakes:
- every 2026 World Cup fixture/result
- which family member owns each team
- quick filters for a specific family member or match status

## Data sources

- Family picks: `data/family-picks.json` (copied from the shared Google Sheet)
- Schedule/results: ESPN World Cup scoreboard JSON
- Championship probability models: `docs/championship-probability.md`

## Local use

```bash
npm run check
npm run serve
# open http://localhost:4173
```

## Deploy

Pushing to `main` triggers the GitHub Pages workflow in `.github/workflows/deploy.yml`.
