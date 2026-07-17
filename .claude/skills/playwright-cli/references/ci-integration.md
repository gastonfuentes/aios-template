# CI integration — GitHub Actions + Vercel previews

## GitHub Actions workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install deps
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build app
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Run E2E tests
        run: npx playwright test
        env:
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

## Tests contra Vercel preview deployments

Cuando un PR genera preview, Vercel postea status con la URL. Correr tests contra esa URL en lugar de localhost:

```yaml
- name: Wait for Vercel preview
  uses: patrickedqvist/wait-for-vercel-preview@v1
  id: vercel
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    max_timeout: 600

- name: Run E2E against preview
  run: npx playwright test
  env:
    BASE_URL: ${{ steps.vercel.outputs.url }}
```

`playwright.config.ts` lee `BASE_URL`:

```ts
use: {
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
}
```

## Sharding paralelo

Si la suite es grande (>50 tests), dividir entre runners:

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

Reduce tiempo total de N minutos a N/4 minutos al costo de 4x runners.

## Reporte aggregado de shards

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: blob-report-${{ matrix.shard }}
    path: blob-report/

# Job separado que junta los blob reports y genera HTML unificado:
merge-reports:
  needs: test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
      with: { pattern: blob-report-* }
    - run: npx playwright merge-reports --reporter html ./all-blob-reports
    - uses: actions/upload-artifact@v4
      with: { name: html-report, path: playwright-report/ }
```

## Visual regression en CI

Issue: el rendering Linux CI difiere de tu Mac dev. Solucion: snapshots especificos por OS:

```ts
expect(page).toHaveScreenshot('dashboard.png'); // genera dashboard-chromium-linux.png en CI
```

Playwright detecta OS automatico. Commitear baselines de Linux desde la primera run en CI.

## Notification al fallar

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    fields: repo,message,commit,author
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

Util para suites criticas que corren scheduled.
