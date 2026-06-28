# World Cup 2026 — Friends League

A small website where 7 friends track a betting game on the FIFA World Cup 2026.
Each person owns 7 national teams. A team winning a match scores **3 points** for its
owner(s); a draw scores **1 point**. Results are pulled automatically from a free
online source — no manual entry, no logins.

## Tech stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- @tanstack/react-query (data fetching / auto-refresh)
- @anthropic-ai/sdk (live AI roasts)
- Deployed to Vercel
- Results source: ESPN free endpoint `soccer/fifa.world/scoreboard` (no API key)

## Scoring rules
- **Group stage**: Win = 3, Draw = 1, Loss = 0.
- **Knockout games** (Round of 32 onwards):
  - Regular-time win: winner 3, loser 0.
  - Extra-time win: winner 2, loser 1.
  - Penalty shootout: 1 point each, regardless of who wins the shootout.
- A team can be owned by several players; all its owners score when it wins/draws.
- Unowned teams (Haiti, Curaçao, Iraq, …) award no points.
- Detected automatically from ESPN's `status.type` field (`FT`, `FT-ET`, `FT-Pens`).
- **Ranking is by points per game (PPG = total points ÷ matches played) by default**,
  fairer because players have different numbers of games played on any given day.
  Tiebreakers: total points, then wins. A player with 0 games sits at 0.
- The Classement tab has a toggle to switch the ranking between **Points / match**
  (default) and **Points totaux**; the list re-sorts, re-ranks, and swaps which figure
  is the headline number.

## Players & teams (the 7×7 grid)
- **Franzou**: Spain, Norway, Senegal, Sweden, Paraguay, Tunisia, Saudi Arabia
- **Marion**: France, Switzerland, Ivory Coast, Türkiye, South Africa, Panama, Cape Verde
- **Riton**: Portugal, Belgium, Colombia, Czechia, Ghana, Qatar, Saudi Arabia
- **Jean-Marc**: Argentina, Brazil, South Korea, Algeria, Scotland, Uzbekistan, Cape Verde
- **Gustave**: Netherlands, Croatia, Egypt, Uruguay, Australia, DR Congo, Saudi Arabia
- **Pierrick**: England, USA, Mexico, Canada, Austria, Bosnia & Herzegovina, Jordan
- **Nadir**: Germany, Japan, Morocco, Ecuador, Iran, New Zealand, Cape Verde

## Features (status)
### Built
- **Phase 1 — Scaffold**: Next.js + Tailwind project, running locally on port 3100.
  Light pitch-green theme (`app/globals.css` simplified — no dark-mode flip).
- **Phase 2 — Ownership config** (`lib/teams.ts`): static team→owner(s) map keyed by
  ESPN/FIFA 3-letter code. `PLAYERS`, `TEAMS`, `TEAM_BY_CODE`, `teamsForPlayer()`.
  Verified: each player owns exactly 7 teams (49 slots, 45 distinct).
- **Phase 3 — Standings engine**:
  - `lib/espn.ts` — `fetchEvents()` pulls the full tournament from ESPN (cached 2 min).
  - `lib/standings.ts` — `computeStandings()` applies group-stage scoring (3/1/0) and
    knockout scoring (3/0 regular, 2/1 AET, 1/1 penalties), detected from ESPN's status
    field. Builds player + team standings and a match list.
    Players are ranked by points per game (`ppg`), then total points, then wins.
  - `app/api/standings/route.ts` — GET endpoint returning the computed standings JSON.
  - Verified against the Excel: 5/7 players match exactly; the 2 differences are
    data-entry errors in the Excel (Scotland win not credited to Jean-Marc; Riton
    double-counted a draw). The app is correct.
- **Phase 4 — UI** (mobile-first, French):
  - `app/providers.tsx` — react-query provider (auto-refresh every 2 min).
  - `lib/useStandings.ts` — `useStandings()` hook.
  - `lib/ui.ts` — per-player accent colours, rank medals, date formatting.
  - `components/Leaderboard.tsx` — ranked players, medals, 🥄 for last, V/N/D. Takes a
    `mode` prop ("ppg" | "points"), re-sorts/re-ranks accordingly, and shows the chosen
    metric as the headline with the other metric underneath. Toggle lives in `app/page.tsx`.
  - `components/Matches.tsx` — match cards with flags, scores, winner highlight, and owner
    labels (coloured pills showing each owner's name directly next to the team, so the name
    is visible on mobile without needing a hover tooltip).
    Has an inner toggle (À venir / Passés) like the Classement toggle: "À venir" shows
    upcoming + live games (soonest first), "Passés" shows finished games (most recent first).
    Defaults to "À venir". Shows an empty-state message when a side has no games.
    Also has a player filter (chips: Tous + one per player, colour-coded): selecting a player
    shows only games where that player owns one of the two teams. Combines with the
    À venir / Passés toggle. Defaults to "Tous"; tapping the active player chip clears it.
  - `components/Players.tsx` — expandable per-player team breakdown. Each team row also
    shows that team's **next upcoming game** (opponent + date), so you can quickly see
    which games are coming up for each team of each player. Shows "Plus de matchs à venir"
    when a team has no scheduled games left. Takes a `matches` prop from the standings.
  - `app/page.tsx` — header with refresh + "last updated", 4 tabs (Classement, Matchs,
    Joueurs, Roast). Roast tab is a placeholder until Phase 5.

- **Phase 5 — AI roasts**:
  - `app/api/roast/route.ts` — computes standings, prompts Claude (Haiku 4.5) for short
    French roasts, returns a JSON array `[{player, text}]`. Key read from `ANTHROPIC_API_KEY`.
    Tone is harsh/savage (no longer good-natured) — brutal, sarcastic jabs targeting
    especially the leader (arrogant) and the last place (disastrous).
  - `lib/useRoasts.ts` — `useRoasts()` hook (generates on demand, not auto-refreshed).
  - `components/Roast.tsx` — colour-coded roast cards + "Roaste-les encore 🔥" button.
  - Wired into the Roast tab in `app/page.tsx`.
  - `ANTHROPIC_API_KEY` stored in `worldcup-26/.env.local` (git-ignored).

- **Phase 7 — Projection page** (a 5th tab, "📈 Projection"):
  - `lib/elo.ts` — approximate World Football Elo seeds for the 48 teams, an
    Elo→win/draw/loss probability model, and an Elo update from finished games.
  - `lib/espn.ts` — types extended to expose ESPN's betting `odds` (DraftKings
    moneylines) plus event `name`/`shortName`.
  - `lib/projection.ts` — `computeProjection()`:
    - Known matchups (group stage) use **real bookmaker odds** (home/draw/away
      moneylines de-vigged into probabilities); hypothetical knockout matchups
      use **Elo** strength.
    - **Monte Carlo** (5 000 runs): plays the groups, qualifies the top 2 of each
      of the 12 groups + the 8 best 3rd-placed teams (Round of 32), then seeds the
      32 survivors by Elo and runs a re-seeded knockout bracket incl. the 3rd-place
      match. Averages give each team's expected points, qualify %, finish
      distribution, and each player's projected final total + PPG.
    - **Over/under**: actual points earned so far vs. what the odds implied
      ("luck"), per team and per player.
    - **Timeline**: per-player cumulative points across the tournament dates —
      actual for played games, expected (dotted) for future ones.
  - `app/api/projection/route.ts` — GET endpoint (cached 2 min).
  - `lib/useProjection.ts` — `useProjection()` hook.
  - `components/Projection.tsx` — methodology note, hand-drawn **SVG line chart**
    (one line per player, solid→dotted at the projection boundary), projected
    final standings cards, and a per-team projection list.
  - Wired into the new Projection tab in `app/page.tsx`.

- **Phase 8 — Brackets tab** ("🏆 Tableau"):
  - `components/Brackets.tsx` — horizontal knockout bracket. Filters `isKnockout` matches
    from the standings data (no extra API call), groups by round, and displays as scrollable
    columns left-to-right: 32e → 16e → Quarts → Demis → Finale.
  - Team names are coloured by owner (same `PLAYER_COLOR` palette as the rest of the app).
    Winner is highlighted in emerald; AET/penalties shown as a small label under the match.
    TBD shown in italic gray for slots not yet determined.
  - Tab bar updated to scrollable (overflow-x-auto + flex-shrink-0 buttons) to fit 5 tabs.
  - Fixed `toFrenchRound` in `lib/standings.ts`: Round of 32 now correctly maps to
    "Seizième de finale" (was incorrectly "Huitième de finale").

### Planned (not yet built)
- **Phase 6 — Deploy** to Vercel with `ANTHROPIC_API_KEY` set in the project's env vars.
