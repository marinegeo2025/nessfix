# NessFix (static)

A tiny static site that shows Ness FC standings + fixtures and a downloadable card.

## Commands

- `npm run scrape` — scrapes LHFA and writes `data/latest.json`
- `npm run build` — generates `public/index.html` + `public/nessfix.svg`
- `npm run all` — scrape then build
- `npm run dev` — serve `public/` locally at http://localhost:3000

## Deploying to Vercel (static)

1. Run `npm run all`.
2. Commit `data/latest.json`, `public/index.html`, `public/nessfix.svg`.
3. Push to GitHub.
4. Import the repo into Vercel. It reads `vercel.json` and deploys `public/`.

## Keeping it fresh (optional)

Use GitHub Actions to refresh daily:

- Settings → Actions → General → Allow GitHub Actions.
- Add `.github/workflows/refresh.yml`:

```yaml
name: Refresh NessFix
on:
  schedule: [ { cron: "0 7 * * *" } ]  # 07:00 UTC daily
  workflow_dispatch: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { persist-credentials: true }
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm ci
      - run: npm run all
      - name: Commit & push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --quiet && echo "No changes" || git commit -m "auto: refresh data & build"
          git push
