// Turns raw ESPN matches into league standings using the ownership rules.
// Win = 3 points, Draw = 1, Loss = 0 — awarded to every owner of the team.

import { EspnEvent } from "./espn";
import { PLAYERS, Player, TEAM_BY_CODE } from "./teams";

export type MatchSide = {
  code: string;
  label: string; // French label if owned, else ESPN name
  logo?: string;
  score: number | null;
  owners: Player[];
};

export type Match = {
  id: string;
  date: string;
  status: "final" | "live" | "scheduled";
  statusDetail: string;
  round: string;
  isKnockout: boolean;
  knockoutResult: "regular" | "aet" | "penalties" | null;
  home: MatchSide;
  away: MatchSide;
};

export type PlayerStanding = {
  name: Player;
  points: number;
  ppg: number; // points per game — the ranking metric
  wins: number;
  draws: number;
  losses: number;
  played: number;
  rank: number;
};

export type TeamStanding = {
  code: string;
  label: string;
  owners: Player[];
  points: number;
  wins: number;
  draws: number;
  losses: number;
  played: number;
};

export type Standings = {
  lastUpdated: string;
  players: PlayerStanding[];
  teams: TeamStanding[];
  matches: Match[];
};

function sideFrom(c: { team: { abbreviation: string; displayName: string; logo?: string }; score: string }): MatchSide {
  const code = c.team.abbreviation;
  const owned = TEAM_BY_CODE[code];
  const score = c.score === "" || c.score == null ? null : Number(c.score);
  return {
    code,
    label: owned ? owned.label : c.team.displayName,
    logo: c.team.logo,
    score: Number.isNaN(score as number) ? null : score,
    owners: owned ? owned.owners : [],
  };
}

export function computeStandings(events: EspnEvent[]): Standings {
  // Seed every player at zero.
  const players = new Map<Player, PlayerStanding>(
    PLAYERS.map((name) => [
      name,
      { name, points: 0, ppg: 0, wins: 0, draws: 0, losses: 0, played: 0, rank: 0 },
    ]),
  );

  // Seed every owned team at zero.
  const teams = new Map<string, TeamStanding>();
  for (const code of Object.keys(TEAM_BY_CODE)) {
    const t = TEAM_BY_CODE[code];
    teams.set(code, {
      code,
      label: t.label,
      owners: t.owners,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      played: 0,
    });
  }

  const matches: Match[] = [];

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp || !comp.competitors || comp.competitors.length < 2) continue;

    const homeC = comp.competitors.find((c) => c.homeAway === "home") ?? comp.competitors[0];
    const awayC = comp.competitors.find((c) => c.homeAway === "away") ?? comp.competitors[1];

    const home = sideFrom(homeC);
    const away = sideFrom(awayC);
    const completed = ev.status?.type?.completed === true;
    const state = ev.status?.type?.state; // "pre" | "in" | "post"
    const status: Match["status"] = completed ? "final" : state === "in" ? "live" : "scheduled";

    const noteHeadline = comp.notes?.[0]?.headline ?? "";
    const compSlug = comp.type?.slug ?? "";
    const isKnockout = compSlug !== "" && compSlug !== "group-stage";
    const statusName = ev.status?.type?.name ?? "";
    const shortDetail = ev.status?.type?.shortDetail ?? "";
    const knockoutResult = isKnockout && completed ? detectKnockoutResult(statusName, shortDetail) : null;

    matches.push({
      id: ev.id,
      date: ev.date,
      status,
      statusDetail: shortDetail,
      round: toFrenchRound(noteHeadline, compSlug),
      isKnockout,
      knockoutResult,
      home,
      away,
    });

    if (!completed) continue;

    // Decide the result: trust ESPN's winner flag first (handles penalty
    // shootouts in knockouts), otherwise fall back to comparing scores.
    let homeOutcome: "win" | "draw" | "loss";
    let awayOutcome: "win" | "draw" | "loss";
    if (homeC.winner === true) {
      homeOutcome = "win";
      awayOutcome = "loss";
    } else if (awayC.winner === true) {
      homeOutcome = "loss";
      awayOutcome = "win";
    } else if ((home.score ?? 0) > (away.score ?? 0)) {
      homeOutcome = "win";
      awayOutcome = "loss";
    } else if ((away.score ?? 0) > (home.score ?? 0)) {
      homeOutcome = "loss";
      awayOutcome = "win";
    } else {
      homeOutcome = "draw";
      awayOutcome = "draw";
    }

    if (isKnockout && knockoutResult === "penalties") {
      // Penalty shootout: 1 point each, regardless of who wins
      applyPoints(home, 1, "draw", players, teams);
      applyPoints(away, 1, "draw", players, teams);
    } else if (isKnockout && knockoutResult === "aet") {
      // Extra time win: winner 2, loser 1
      const homeWon = homeC.winner === true;
      applyPoints(home, homeWon ? 2 : 1, homeWon ? "win" : "loss", players, teams);
      applyPoints(away, homeWon ? 1 : 2, homeWon ? "loss" : "win", players, teams);
    } else {
      // Group stage or regular-time knockout win: 3/1/0
      const homePoints = homeOutcome === "win" ? 3 : homeOutcome === "draw" ? 1 : 0;
      const awayPoints = awayOutcome === "win" ? 3 : awayOutcome === "draw" ? 1 : 0;
      applyPoints(home, homePoints, homeOutcome, players, teams);
      applyPoints(away, awayPoints, awayOutcome, players, teams);
    }
  }

  // Points per game is fairer than total points: on any given day players have
  // a different number of games played. A player with no games yet sits at 0.
  for (const p of players.values()) {
    p.ppg = p.played > 0 ? p.points / p.played : 0;
  }

  // Rank players: points per game, then total points, then wins.
  const playerList = [...players.values()].sort(
    (a, b) => b.ppg - a.ppg || b.points - a.points || b.wins - a.wins,
  );
  playerList.forEach((p, i) => {
    p.rank = i === 0 ? 1 : playerList[i - 1].ppg === p.ppg ? playerList[i - 1].rank : i + 1;
  });

  const teamList = [...teams.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins,
  );

  return {
    lastUpdated: new Date().toISOString(),
    players: playerList,
    teams: teamList,
    matches,
  };
}

function toFrenchRound(headline: string, slug = ""): string {
  const src = headline || slug;
  if (!src) return "";
  const h = src.toLowerCase();
  if (h.includes("group")) return headline ? headline.replace(/group/i, "Groupe") : "Phase de groupes";
  if (h.includes("round-of-32") || h.includes("round of 32")) return "Seizième de finale";
  if (h.includes("round of 16") || h.includes("round of sixteen") || h.includes("round-of-16")) return "Huitième de finale";
  if (h.includes("quarterfinal") || h.includes("quarter-final") || h.includes("quarter-finals")) return "Quart de finale";
  if (h.includes("semifinal") || h.includes("semi-final") || h.includes("semi-finals")) return "Demi-finale";
  if (h.includes("third place") || h.includes("3rd place")) return "Troisième place";
  if (h.includes("final")) return "Finale";
  return headline || slug;
}

function applyPoints(
  side: MatchSide,
  points: number,
  stat: "win" | "draw" | "loss",
  players: Map<Player, PlayerStanding>,
  teams: Map<string, TeamStanding>,
) {
  const team = teams.get(side.code);
  if (team) {
    team.played += 1;
    team.points += points;
    if (stat === "win") team.wins += 1;
    else if (stat === "draw") team.draws += 1;
    else team.losses += 1;
  }
  for (const owner of side.owners) {
    const p = players.get(owner);
    if (!p) continue;
    p.played += 1;
    p.points += points;
    if (stat === "win") p.wins += 1;
    else if (stat === "draw") p.draws += 1;
    else p.losses += 1;
  }
}

function detectKnockoutResult(name: string, shortDetail: string): "regular" | "aet" | "penalties" {
  const n = name.toLowerCase();
  const s = shortDetail.toLowerCase();
  if (n.includes("pen") || s.includes("pen") || s.includes("pks")) return "penalties";
  if (n.includes("aet") || s.includes("et") || s.includes("extra")) return "aet";
  return "regular";
}
