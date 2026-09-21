# CFB Schedule Outlook

A mobile-first college football schedule outlook built with Next.js App Router, TypeScript, React, and server-side CollegeFootballData (CFBD) integration. Source repository: https://github.com/richmatta/CFBSchedule.

## Run locally

Use Node.js 22+ and pnpm 11.19.0.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. Add your CFBD key to `.env.local` before starting, or leave it blank for the clearly labeled illustrative demo. `.env.local` is ignored by Git. Never use a `NEXT_PUBLIC_` prefix for the key. The supplied local key is not included in the repository.

## Configuration

| Variable | Value | Purpose |
| --- | --- | --- |
| `CFBD_API_KEY` | Your bearer token | Server-only CFBD access |
| `CFBD_SP_ENABLED` | `true` or `false` | Enable SP+ requests when your access permits it; default false |
| `RATING_MODEL` | `auto` or `elo` | `auto` prefers SP+ when enabled, falls back to Elo per matchup; `elo` skips SP+ |
| `DEMO_MODE` | `true` or `false` | Force illustrative demo mode; missing key also enables demo |

An invalid/expired key produces an error, never fake results disguised as live data. No database or login is needed; team/season preferences remain in the visitor's browser.

## Deploy to Vercel

1. Import `richmatta/CFBSchedule` into Vercel. Select Next.js, repository root, and Node.js 22 or newer. Keep the detected install and build settings (`pnpm install`, `pnpm build`).
2. Add `CFBD_API_KEY` as a sensitive server environment variable. Set `CFBD_SP_ENABLED=true` if your subscription and permitted use support SP+, `RATING_MODEL=auto`, and `DEMO_MODE=false`.
3. Deploy. Environment changes require a redeploy. Verify the setup screen has no demo label, choose a team, check Schedule and Scoreboard, and confirm the data-access notices.
4. Subsequent pushes to the production branch deploy automatically through Vercel's GitHub integration. Pull requests can receive preview deployments.

Do not upload `.env.local`, `.next`, or `node_modules`. Review CFBD quotas before broad public promotion; the application shares cached upstream requests, but it does not provide account-level rate limiting. Vercel Firewall rate limits can be configured for `/api/*` if traffic warrants them.

## Data sources and access

Primary provider: [CollegeFootballData](https://api.collegefootballdata.com/). Its authenticated, documented API supplies the app's real data. [Current access tiers](https://collegefootballdata.com/api-tiers) determine endpoint availability and usage limits; API access does not itself establish redistribution rights for third-party ratings. Confirm the intended published use with CFBD/SP+ rights holders as appropriate. Current-season SP+ uses the publicly readable ESPN article described below; no paywall bypass is implemented.

| Endpoint | Use | Shared upstream cache |
| --- | --- | --- |
| `/teams/fbs?year=…` | Season-specific FBS membership and names | 24 hours |
| `/games?year=…&team=…&seasonType=both` | Selected team's regular and announced postseason schedule/results | 5 minutes |
| `/games?year=…&week=…&seasonType=…` | Week's games across divisions, including FCS opponents | 5 minutes |
| `/records?year=…` | Opponent season records | 5 minutes |
| `/calendar?year=…` | Week boundaries, including postseason in January | 1 hour |
| `/ratings/sp?year=…` | Latest available selected-season SP+ | 1 hour |
| `/ratings/elo?year=…&seasonType=both` | Defensible alternate ratings | 1 hour |

Docs: [games, records and calendar](https://api.collegefootballdata.com/api/games), [ratings](https://api.collegefootballdata.com/api/ratings), [teams](https://api.collegefootballdata.com/api/teams).

The supplied key was verified on September 19, 2026: schedules, FBS directory, calendar, SP+, and Elo returned successfully. Live `/scoreboard` access requires a higher API tier and is intentionally disabled. The Opponent Scoreboard uses `/games`, so current results appear when that feed records them rather than as a live overlay. Refreshing the page does not bypass the provider cache.

The browser refreshes every 60 seconds while visible. “Retrieved” is the app retrieval time, not the provider's last scoring update. Scores may lag five minutes plus provider delay; ratings may lag one hour plus publication delay. API schema validation, timeouts, explicit errors, and optional-endpoint warnings prevent quiet failures.

## Probability methodology

For each uncompleted game:

- Prefer SP+ only when both teams have finite ratings. `margin = team SP+ − opponent SP+ + home adjustment`, where the adjustment is +2.5 at home, −2.5 away, and 0 at neutral sites. `P(win) = 1 / (1 + exp(−margin / 9))`.
- For a confirmed FBS-versus-lower-division game, if the lower-division team lacks SP+, assign 99% to the FBS team when it has SP+/Elo or belongs to a power conference (ACC, Big Ten, Big 12, SEC, or Pac-12). The reverse perspective is 1%. This user-requested assumption precedes Elo fallback, is labeled `99% assumption`, and contributes 0.99 expected wins. Unknown classifications and ordinary FBS rating gaps do not trigger it.
- Otherwise use both teams' Elo ratings. `difference = team Elo − opponent Elo + home adjustment`, with +55 at home, −55 away, and 0 neutral. `P(win) = 1 / (1 + 10^(−difference / 400))`.
- Never mix Elo and SP+ scales. Missing values stay unavailable rather than becoming 50% or 100%. Each prediction labels its model.

These home adjustments and probability conversions are transparent, **uncalibrated heuristics**, not official SP+ win probabilities. Calibrate against held-out historical pregame snapshots before claiming forecast accuracy.

Expected total wins = completed wins + the sum of remaining probabilities. Completed losses/ties contribute zero. In-progress scores never count as final. Canceled games are excluded when identified by the live feed. Announced postseason games are included; unannounced bowls/playoff games are not invented. A missing rating outside the explicit lower-division assumption leaves the full expected total unavailable and reports the count of missing predictions. On September 19, the expanded SRS endpoint returned no 2026 ratings, so it was not used as an invented FCS fallback.

Ratings always come from the selected season, never silently from last year. Season selection is limited to the previous and current calendar year. Saved or linked future seasons reset to the current year. Historical seasons show results with the latest ratings available for that season, not a point-in-time backtest. Calendar weeks default to the active week, the next week before/in gaps in the season, or the final week after the season; regular/postseason keys remain distinct and week zero is supported.

## Demo and UI

The demo's schedules, scores, records, and Elo inputs are generated fixtures, not real results. The offline picker is a 136-team 2025 membership snapshot from ESPN's public conference standings directory, retrieved September 19, 2026. The real-data picker uses CFBD membership for the chosen year (138 teams returned for 2026). No ESPN API is used in production data requests.

Routes: `/` setup, `/schedule`, `/scoreboard`. Team and year travel in links and persist locally. Star a selected team to add it to My Teams; saved teams appear as quick-switch buttons on setup, Schedule, and Scoreboard. Remove a favorite with its × button or the selected team’s star. Favorites persist in browser local storage (no cookies or account), and teams unavailable in a chosen season remain saved but disabled. Scoreboard includes all opponents found on the selected team's schedule and the selected team, deduplicates shared games, and lists teams without a game that week.

## Validation

```sh
pnpm test
pnpm typecheck
pnpm build
```

Tests cover neutral/home/away probabilities, Elo fallback, completion transitions, missing ratings, cancellations, calendar boundaries, postseason, week zero, FCS scoreboard inclusion, and deduplication. GitHub Actions runs the model tests and production build. Real provider calls were checked separately using the local key; CI works without credentials. Mobile and desktop layouts have been inspected in a browser.

Core files: `lib/cfbd.ts` provider adapter, `lib/model.ts` calculations, `components/outlook-app.tsx` interactive screens, `app/globals.css` responsive theme, `app/api/*` validated server routes.

The default brand color is Stanford Cardinal red (#8C1515). First-time visitors explicitly choose a team; returning visitors retain their saved selection. The schedule displays provider-supplied national overall, offensive, and defensive SP+ rankings, with compact opponent overall rankings. #1 is best; probabilities still use underlying rating values, not ranks. Missing ratings are shown as unavailable, never inferred from the 99% game assumption.


### ESPN SP+ publications

For the current 2026 season, ESPN SP+ is enabled by default. Set `ESPN_SP_ENABLED=false` to use the existing CFBD/Elo path. `RATING_MODEL=elo` overrides both SP+ sources. `CFBD_SP_ENABLED` controls only CFBD access; the CFBD key remains necessary for schedules and records. No new Vercel secret is needed.

The server reads the ESPN article hourly on demand, validates the season, explicit ratings publication date, every FBS team, unique ranks and numeric ratings, then caches the complete validated snapshot in Next's Data Cache. Validation failures never replace a successful cached snapshot. A checked-in September 20 snapshot also covers cold starts/cache loss; if that snapshot no longer matches the FBS directory, CFBD is the fallback. Historical seasons continue using CFBD. The UI shows the SP+ publication date separately from the outlook retrieval time and warns when that publication is over eight days old. A stale cached publication can remain available while background revalidation fails; its displayed date remains unchanged.

The adapter uses ESPN as the preferred current-season source, not an inferred comparison against CFBD's unknown publication date. It imports the predictive SP+ table (not résumé SP+), maps ESPN abbreviations to CFBD names, and uses numerical ratings for probabilities while displaying ranks. The source link accompanies the publication date. The pinned article URL and supported year in `lib/espn-sp.ts` / `lib/espn-source.ts` must be reviewed for a new season. This is an HTML integration; source layout/access changes may require maintenance. Published ratings refresh when the app is requested, not via a scheduled job.
