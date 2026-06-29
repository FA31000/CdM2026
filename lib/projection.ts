// Projects the rest of the World Cup with a Monte Carlo simulation.
//
// - Known matchups (group stage) use real ESPN/DraftKings odds.
// - Known knockout matchups use real ESPN/DraftKings odds.
// - Hypothetical knockout matchups use free Elo strength ratings.
// We simulate the whole tournament thousands of times: play the groups, decide
// who advances (top 2 + 8 best 3rd places), seed the 32 survivors by strength
// and run the bracket. Averaging gives each team's expected points and how far
// they are expected to go; summing over owned teams gives each player's
// projected final total.

import { EspnEvent } from "./espn";
import { PLAYERS, Player, TEAM_BY_CODE } from "./teams";
import { seedElo, eloExpected, eloProbabilities, updateElo, DEFAULT_ELO } from "./elo";

const SIMULATIONS = 5000;

type Round = "r32" | "r16" | "qf" | "sf" | "third" | "final";
const KO_ROUNDS: Round[] = ["r32", "r16", "qf", "sf", "third", "final"];

// "Finish" buckets, deepest first, for the expected-finish label.
export type Finish =
  | "champion"
  | "final"
  | "sf"
  | "qf"
  | "r16"
  | "r32"
  | "groups";

export type TeamProjection = {
  code: string;
  label: string;
  owners: Player[];
  elo: number;
  pointsSoFar: number; // actual points earned already
  expectedSoFar: number; // points the odds said they "should" have earned
  luck: number; // pointsSoFar - expectedSoFar (+ = overperformed)
  expectedPoints: number; // mean total tournament points
  expectedGames: number; // mean matches played
  qualifyProb: number; // chance of reaching the knockout stage
  finishProbs: Record<Finish, number>;
  expectedFinish: Finish; // median finishing bucket
};

export type PlayerProjection = {
  name: Player;
  pointsSoFar: number;
  expectedSoFar: number;
  luck: number;
  expectedPoints: number; // projected final total
  expectedGames: number;
  expectedPpg: number; // projected points per game
  rank: number; // by expected ppg
};

export type TimelineSeries = {
  name: Player;
  values: number[]; // cumulative points at each checkpoint
  actualCount: number; // how many leading checkpoints are real (vs projected)
};

export type Timeline = {
  dates: string[]; // checkpoint dates, chronological
  labels: string[]; // short label per checkpoint
  series: TimelineSeries[];
};

export type Projection = {
  lastUpdated: string;
  simulations: number;
  players: PlayerProjection[];
  teams: TeamProjection[];
  timeline: Timeline;
};

// ---- odds helpers ---------------------------------------------------------

function americanToProb(odds: number): number {
  return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
}

type Probs = { homeWin: number; draw: number; awayWin: number };

// De-vig the three moneylines (home / draw / away) into real probabilities.
function oddsProbs(ev: EspnEvent): Probs | null {
  const o = ev.competitions?.[0]?.odds?.[0];
  if (!o) return null;
  const hRaw = o.moneyline?.home?.close?.odds ?? o.moneyline?.home?.open?.odds;
  const aRaw = o.moneyline?.away?.close?.odds ?? o.moneyline?.away?.open?.odds;
  const dRaw = o.drawOdds?.moneyLine;
  if (hRaw == null || aRaw == null || dRaw == null) return null;
  const h = americanToProb(Number(hRaw));
  const a = americanToProb(Number(aRaw));
  const d = americanToProb(Number(dRaw));
  if (![h, a, d].every(Number.isFinite)) return null;
  const s = h + a + d;
  if (s <= 0) return null;
  return { homeWin: h / s, draw: d / s, awayWin: a / s };
}

// ---- match parsing --------------------------------------------------------

type GroupMatch = {
  home: string;
  away: string;
  date: string;
  completed: boolean;
  // For completed: actual points each side earned. For future: probabilities.
  homePts?: number;
  awayPts?: number;
  probs?: Probs; // home perspective
};

type KnockoutMatch = {
  home: string;
  away: string;
  round: Round;
  completed: boolean;
  winner?: string; // set when completed
  probs?: Probs;   // set when pending (from ESPN odds or Elo)
};

function competitorIsReal(name: string, abbr: string): boolean {
  if (!abbr || abbr.length > 3) return false;
  return !/(Winner|Loser|Place|Group)/.test(name);
}

// Classify a knockout event into its round from the competitor labels.
function knockoutRound(names: string[]): Round {
  const joined = names.join(" ");
  if (/Semifinal.*Winner/.test(joined)) return "final";
  if (/Semifinal.*Loser/.test(joined)) return "third";
  if (/Quarterfinal/.test(joined)) return "sf";
  if (/Round of 16/.test(joined)) return "qf";
  if (/Round of 32/.test(joined)) return "r16";
  return "r32"; // group-placement labels feed the Round of 32
}

// ---- main -----------------------------------------------------------------

export function computeProjection(events: EspnEvent[]): Projection {
  const elo: Record<string, number> = {};

  // ---- Pass 1: seed Elo, build opponent map, collect placeholder KO dates ---
  const allOpponents: Record<string, Set<string>> = {};
  const knockoutDates: Record<Round, string[]> = {
    r32: [], r16: [], qf: [], sf: [], third: [], final: [],
  };

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    // Seed Elo for every real team in the event.
    for (const c of comp.competitors) {
      const ab = c.team.abbreviation;
      if (competitorIsReal(c.team.displayName, ab) && elo[ab] == null) {
        elo[ab] = seedElo(ab);
      }
    }
    if (comp.competitors.length < 2) continue;
    const homeC = comp.competitors.find((c) => c.homeAway === "home") ?? comp.competitors[0];
    const awayC = comp.competitors.find((c) => c.homeAway === "away") ?? comp.competitors[1];
    const homeReal = competitorIsReal(homeC.team.displayName, homeC.team.abbreviation);
    const awayReal = competitorIsReal(awayC.team.displayName, awayC.team.abbreviation);

    if (homeReal && awayReal) {
      // Both teams known: build the opponent map for group detection.
      const h = homeC.team.abbreviation;
      const a = awayC.team.abbreviation;
      (allOpponents[h] ??= new Set()).add(a);
      (allOpponents[a] ??= new Set()).add(h);
    } else {
      // At least one placeholder: record the round date.
      const names = comp.competitors.map((c) => c.team.displayName);
      knockoutDates[knockoutRound(names)].push(ev.date);
    }
  }

  // Two teams are in the same group if they share a common opponent (3-team round-robin).
  const sameGroup = (h: string, a: string): boolean => {
    const ho = allOpponents[h] ?? new Set<string>();
    const ao = allOpponents[a] ?? new Set<string>();
    for (const o of ho) if (ao.has(o)) return true;
    return false;
  };

  // Infer the knockout round of a real-team match from its date relative to
  // the placeholder round date ranges collected above.
  const roundOrder: Round[] = ["r32", "r16", "qf", "sf", "third", "final"];
  const roundMinDate: Partial<Record<Round, string>> = {};
  for (const r of roundOrder) {
    const sorted = knockoutDates[r].map((d) => d.slice(0, 10)).sort();
    if (sorted.length > 0) roundMinDate[r] = sorted[0];
  }
  function inferRound(date: string): Round {
    const day = date.slice(0, 10);
    let result: Round = "r32";
    for (const r of roundOrder) {
      const min = roundMinDate[r];
      if (min && day >= min) result = r;
    }
    return result;
  }

  // ---- Pass 2: classify and record all matches -----------------------------
  const groupMatches: GroupMatch[] = [];
  const knockoutMatches: KnockoutMatch[] = [];
  const actualSoFar: Record<string, number> = {};
  const expectedSoFar: Record<string, number> = {};

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp || comp.competitors.length < 2) continue;
    const homeC = comp.competitors.find((c) => c.homeAway === "home") ?? comp.competitors[0];
    const awayC = comp.competitors.find((c) => c.homeAway === "away") ?? comp.competitors[1];
    const homeReal = competitorIsReal(homeC.team.displayName, homeC.team.abbreviation);
    const awayReal = competitorIsReal(awayC.team.displayName, awayC.team.abbreviation);

    if (!homeReal || !awayReal) continue; // placeholder — dates already collected

    const home = homeC.team.abbreviation;
    const away = awayC.team.abbreviation;
    const completed = ev.status?.type?.completed === true;
    const probs = oddsProbs(ev);

    if (sameGroup(home, away)) {
      // ---- Group stage match ----
      if (completed) {
        const hs = Number(homeC.score);
        const as = Number(awayC.score);
        let homePts: number, awayPts: number, scoreA: number;
        if (homeC.winner === true || (!awayC.winner && hs > as)) {
          homePts = 3; awayPts = 0; scoreA = 1;
        } else if (awayC.winner === true || as > hs) {
          homePts = 0; awayPts = 3; scoreA = 0;
        } else {
          homePts = 1; awayPts = 1; scoreA = 0.5;
        }
        updateElo(elo, home, away, scoreA);
        groupMatches.push({ home, away, date: ev.date, completed: true, homePts, awayPts });
        actualSoFar[home] = (actualSoFar[home] ?? 0) + homePts;
        actualSoFar[away] = (actualSoFar[away] ?? 0) + awayPts;
        const p = probs ?? eloToProbs(elo, home, away);
        expectedSoFar[home] = (expectedSoFar[home] ?? 0) + 3 * p.homeWin + p.draw;
        expectedSoFar[away] = (expectedSoFar[away] ?? 0) + 3 * p.awayWin + p.draw;
      } else {
        const p = probs ?? eloToProbs(elo, home, away);
        groupMatches.push({ home, away, date: ev.date, completed: false, probs: p });
      }
    } else {
      // ---- Knockout match with real teams ----
      const round = inferRound(ev.date);
      if (completed) {
        const hs = Number(homeC.score);
        const as = Number(awayC.score);
        let scoreA: number;
        if (homeC.winner === true || hs > as) scoreA = 1;
        else if (awayC.winner === true || as > hs) scoreA = 0;
        else scoreA = 0.5;
        const winner = homeC.winner === true ? home : away;
        updateElo(elo, home, away, scoreA);
        knockoutMatches.push({ home, away, round, completed: true, winner });
        // Count knockout win points for the actual winner.
        actualSoFar[winner] = (actualSoFar[winner] ?? 0) + 3;
        const p = probs ?? eloToProbs(elo, home, away);
        const expWinner = winner === home
          ? 3 * p.homeWin + p.draw
          : 3 * p.awayWin + p.draw;
        expectedSoFar[winner] = (expectedSoFar[winner] ?? 0) + expWinner;
      } else {
        // Use ESPN odds if available; fall back to Elo.
        const p = probs ?? eloToProbs(elo, home, away);
        knockoutMatches.push({ home, away, round, completed: false, probs: p });
      }
    }
  }

  // Group the real teams into their groups (connected components of group-stage matches).
  const groups = deriveGroups(groupMatches);

  // ---- Monte Carlo --------------------------------------------------------
  const codes = Object.keys(elo);
  const totalPointsSum: Record<string, number> = zero(codes);
  const gamesSum: Record<string, number> = zero(codes);
  const roundPointsSum: Record<Round, Record<string, number>> = {
    r32: zero(codes), r16: zero(codes), qf: zero(codes),
    sf: zero(codes), third: zero(codes), final: zero(codes),
  };
  const qualifyCount: Record<string, number> = zero(codes);
  const finishCount: Record<string, Record<Finish, number>> = {};
  for (const c of codes) {
    finishCount[c] = { champion: 0, final: 0, sf: 0, qf: 0, r16: 0, r32: 0, groups: 0 };
  }

  for (let s = 0; s < SIMULATIONS; s++) {
    simulateOnce(
      groups, groupMatches, knockoutMatches, elo,
      totalPointsSum, gamesSum, roundPointsSum, qualifyCount, finishCount,
    );
  }

  const N = SIMULATIONS;
  const mean = (v: number) => v / N;

  // ---- team projections ---------------------------------------------------
  const FINISH_ORDER: Finish[] = ["groups", "r32", "r16", "qf", "sf", "final", "champion"];

  const teams: TeamProjection[] = codes
    .map((code) => {
      const owned = TEAM_BY_CODE[code];
      const finishProbs = {} as Record<Finish, number>;
      (Object.keys(finishCount[code]) as Finish[]).forEach((f) => {
        finishProbs[f] = finishCount[code][f] / N;
      });
      // Use median finish (50th percentile) — more representative than mode for strong teams.
      const expectedFinish = (() => {
        let cum = 0;
        for (const f of FINISH_ORDER) {
          cum += finishProbs[f];
          if (cum >= 0.5) return f;
        }
        return "champion" as Finish;
      })();
      const ps = actualSoFar[code] ?? 0;
      const es = expectedSoFar[code] ?? 0;
      return {
        code,
        label: owned ? owned.label : code,
        owners: owned ? owned.owners : [],
        elo: Math.round(elo[code]),
        pointsSoFar: ps,
        expectedSoFar: round1(es),
        luck: round1(ps - es),
        expectedPoints: round1(mean(totalPointsSum[code])),
        expectedGames: round1(mean(gamesSum[code])),
        qualifyProb: mean(qualifyCount[code]),
        finishProbs,
        expectedFinish,
      };
    })
    .sort((a, b) => b.expectedPoints - a.expectedPoints);

  // ---- player projections -------------------------------------------------
  const players: PlayerProjection[] = PLAYERS.map((name) => {
    const owned = teams.filter((t) => t.owners.includes(name));
    const expectedPoints = sum(owned.map((t) => mean(totalPointsSum[t.code])));
    const expectedGames = sum(owned.map((t) => mean(gamesSum[t.code])));
    const pointsSoFar = sum(owned.map((t) => t.pointsSoFar));
    const exSoFar = sum(owned.map((t) => t.expectedSoFar));
    return {
      name,
      pointsSoFar,
      expectedSoFar: round1(exSoFar),
      luck: round1(pointsSoFar - exSoFar),
      expectedPoints: round1(expectedPoints),
      expectedGames: round1(expectedGames),
      expectedPpg: expectedGames > 0 ? round2(expectedPoints / expectedGames) : 0,
      rank: 0,
    };
  }).sort(
    (a, b) => b.expectedPpg - a.expectedPpg || b.expectedPoints - a.expectedPoints,
  );
  players.forEach((p, i) => {
    p.rank =
      i === 0 ? 1 : players[i - 1].expectedPpg === p.expectedPpg ? players[i - 1].rank : i + 1;
  });

  // ---- timeline -----------------------------------------------------------
  const timeline = buildTimeline(groupMatches, knockoutDates, roundPointsSum, mean);

  return {
    lastUpdated: new Date().toISOString(),
    simulations: SIMULATIONS,
    players,
    teams,
    timeline,
  };
}

// One full-tournament simulation, folding its results into the accumulators.
function simulateOnce(
  groups: string[][],
  groupMatches: GroupMatch[],
  knockoutMatches: KnockoutMatch[],
  baseElo: Record<string, number>,
  totalPointsSum: Record<string, number>,
  gamesSum: Record<string, number>,
  roundPointsSum: Record<Round, Record<string, number>>,
  qualifyCount: Record<string, number>,
  finishCount: Record<string, Record<Finish, number>>,
) {
  const pts: Record<string, number> = {};
  const games: Record<string, number> = {};
  for (const g of groups) for (const c of g) { pts[c] = 0; games[c] = 0; }

  // Group games.
  for (const m of groupMatches) {
    games[m.home] = (games[m.home] ?? 0) + 1;
    games[m.away] = (games[m.away] ?? 0) + 1;
    if (m.completed) {
      pts[m.home] += m.homePts!;
      pts[m.away] += m.awayPts!;
    } else {
      const r = Math.random();
      const p = m.probs!;
      if (r < p.homeWin) pts[m.home] += 3;
      else if (r < p.homeWin + p.draw) { pts[m.home] += 1; pts[m.away] += 1; }
      else pts[m.away] += 3;
    }
  }

  // Rank each group; collect top 2 and the 3rd-placed teams.
  const qualifiers: string[] = [];
  const thirds: string[] = [];
  for (const g of groups) {
    const ranked = [...g].sort(
      (a, b) => pts[b] - pts[a] || baseElo[b] - baseElo[a],
    );
    qualifiers.push(ranked[0], ranked[1]);
    if (ranked[2] != null) thirds.push(ranked[2]);
  }
  thirds.sort((a, b) => pts[b] - pts[a] || baseElo[b] - baseElo[a]);
  qualifiers.push(...thirds.slice(0, 8));

  for (const c of qualifiers) qualifyCount[c] += 1;

  // Knockout rounds: use real ESPN odds for known matchups, Elo for the rest.
  const alive = new Set(qualifiers);
  const bracketRounds = ["r32", "r16", "qf", "sf"] as const;
  let semiLosers: string[] = [];

  for (const round of bracketRounds) {
    const roundLosers: string[] = [];
    const handledTeams = new Set<string>();

    // Apply known matchups first (completed or with real odds).
    for (const m of knockoutMatches) {
      if (m.round !== round) continue;
      if (!alive.has(m.home) || !alive.has(m.away)) continue;

      games[m.home] = (games[m.home] ?? 0) + 1;
      games[m.away] = (games[m.away] ?? 0) + 1;

      let winner: string, loser: string;
      if (m.completed) {
        winner = m.winner!;
        loser = winner === m.home ? m.away : m.home;
      } else {
        // Real odds from ESPN; no draws in knockout — normalise to win/loss.
        const p = m.probs!;
        const homeWinProb = p.homeWin / (p.homeWin + p.awayWin);
        if (Math.random() < homeWinProb) {
          winner = m.home; loser = m.away;
        } else {
          winner = m.away; loser = m.home;
        }
      }

      pts[winner] += 3;
      roundPointsSum[round][winner] += 3;
      finishCount[loser][round as Finish] += 1;
      alive.delete(loser);
      handledTeams.add(m.home);
      handledTeams.add(m.away);
      roundLosers.push(loser);
    }

    // Elo-seed the remaining teams whose matchups aren't known yet.
    const remaining = [...alive]
      .filter((t) => !handledTeams.has(t))
      .sort((a, b) => baseElo[b] - baseElo[a]);

    for (let i = 0, j = remaining.length - 1; i < j; i++, j--) {
      const a = remaining[i];
      const b = remaining[j];
      games[a] = (games[a] ?? 0) + 1;
      games[b] = (games[b] ?? 0) + 1;
      const aWins = Math.random() < eloExpected(baseElo[a], baseElo[b]);
      const w = aWins ? a : b;
      const l = aWins ? b : a;
      pts[w] += 3;
      roundPointsSum[round][w] += 3;
      finishCount[l][round as Finish] += 1;
      alive.delete(l);
      roundLosers.push(l);
    }

    if (round === "sf") semiLosers = roundLosers;
  }

  // Third-place match between the two semifinal losers.
  if (semiLosers.length === 2) {
    const [a, b] = semiLosers;
    games[a] = (games[a] ?? 0) + 1;
    games[b] = (games[b] ?? 0) + 1;
    const aWins = Math.random() < eloExpected(baseElo[a], baseElo[b]);
    pts[aWins ? a : b] += 3;
    roundPointsSum.third[aWins ? a : b] += 3;
  }

  // Final between the two remaining teams.
  const finalists = [...alive];
  if (finalists.length === 2) {
    const [a, b] = finalists;
    games[a] = (games[a] ?? 0) + 1;
    games[b] = (games[b] ?? 0) + 1;
    const aWins = Math.random() < eloExpected(baseElo[a], baseElo[b]);
    const champ = aWins ? a : b;
    const runner = aWins ? b : a;
    pts[champ] += 3;
    roundPointsSum.final[champ] += 3;
    finishCount[champ].champion += 1;
    finishCount[runner].final += 1;
  }

  // Teams that never qualified finish in the group stage.
  for (const g of groups) for (const c of g) {
    if (!qualifiers.includes(c)) finishCount[c].groups += 1;
    totalPointsSum[c] += pts[c];
    gamesSum[c] += games[c];
  }
}

// ---- helpers --------------------------------------------------------------

function eloToProbs(elo: Record<string, number>, home: string, away: string): Probs {
  const p = eloProbabilities(elo[home] ?? DEFAULT_ELO, elo[away] ?? DEFAULT_ELO);
  return { homeWin: p.win, draw: p.draw, awayWin: p.loss };
}

function deriveGroups(matches: GroupMatch[]): string[][] {
  const adj: Record<string, Set<string>> = {};
  for (const m of matches) {
    (adj[m.home] ??= new Set()).add(m.away);
    (adj[m.away] ??= new Set()).add(m.home);
  }
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const start of Object.keys(adj)) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const stack = [start];
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      comp.push(n);
      for (const nb of adj[n]) if (!seen.has(nb)) stack.push(nb);
    }
    groups.push(comp);
  }
  return groups;
}

function buildTimeline(
  groupMatches: GroupMatch[],
  knockoutDates: Record<Round, string[]>,
  roundPointsSum: Record<Round, Record<string, number>>,
  mean: (v: number) => number,
): Timeline {
  type Checkpoint = { date: string; label: string; projected: boolean; inc: Record<Player, number> };
  const byDate = new Map<string, Checkpoint>();

  const ensure = (date: string, label: string): Checkpoint => {
    let cp = byDate.get(date);
    if (!cp) {
      cp = { date, label, projected: false, inc: blankInc() };
      byDate.set(date, cp);
    }
    return cp;
  };

  // Group matches: add each side's points (actual or expected) to its owners.
  for (const m of groupMatches) {
    const day = m.date.slice(0, 10);
    const cp = ensure(day, day.slice(5));
    let homePts: number, awayPts: number;
    if (m.completed) {
      homePts = m.homePts!;
      awayPts = m.awayPts!;
    } else {
      cp.projected = true;
      homePts = 3 * m.probs!.homeWin + m.probs!.draw;
      awayPts = 3 * m.probs!.awayWin + m.probs!.draw;
    }
    addToOwners(cp.inc, m.home, homePts);
    addToOwners(cp.inc, m.away, awayPts);
  }

  // Knockout rounds: one checkpoint per round, on the round's last date.
  const roundLabel: Record<Round, string> = {
    r32: "8es*", r16: "8es", qf: "Quarts", sf: "Demis", third: "3e place", final: "Finale",
  };
  for (const round of KO_ROUNDS) {
    const dates = knockoutDates[round];
    if (!dates.length) continue;
    const day = dates.slice().sort()[dates.length - 1].slice(0, 10);
    const cp = ensure(day, roundLabel[round]);
    cp.projected = true;
    for (const code of Object.keys(roundPointsSum[round])) {
      const expected = mean(roundPointsSum[round][code]);
      if (expected > 0) addToOwners(cp.inc, code, expected);
    }
  }

  const checkpoints = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const series: TimelineSeries[] = PLAYERS.map((name) => {
    let cum = 0;
    const values = checkpoints.map((cp) => {
      cum += cp.inc[name];
      return round1(cum);
    });
    let actualCount = 0;
    for (const cp of checkpoints) {
      if (cp.projected) break;
      actualCount++;
    }
    return { name, values, actualCount };
  });

  return {
    dates: checkpoints.map((c) => c.date),
    labels: checkpoints.map((c) => c.label),
    series,
  };
}

function addToOwners(inc: Record<Player, number>, code: string, points: number) {
  const owned = TEAM_BY_CODE[code];
  if (!owned) return;
  for (const o of owned.owners) inc[o] += points;
}

function blankInc(): Record<Player, number> {
  return Object.fromEntries(PLAYERS.map((p) => [p, 0])) as Record<Player, number>;
}

function zero(codes: string[]): Record<string, number> {
  return Object.fromEntries(codes.map((c) => [c, 0]));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
