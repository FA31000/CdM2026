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

type Outcome = "win" | "draw" | "loss";

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

    matches.push({
      id: ev.id,
      date: ev.date,
      status,
      statusDetail: ev.status?.type?.shortDetail ?? "",
      home,
      away,
    });

    if (!completed) continue;

    // Decide the result: trust ESPN's winner flag first (handles penalty
    // shootouts in knockouts), otherwise fall back to comparing scores.
    let homeOutcome: Outcome;
    let awayOutcome: Outcome;
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

    applyOutcome(home, homeOutcome, players, teams);
    applyOutcome(away, awayOutcome, players, teams);
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

function applyOutcome(
  side: MatchSide,
  outcome: Outcome,
  players: Map<Player, PlayerStanding>,
  teams: Map<string, TeamStanding>,
) {
  const points = outcome === "win" ? 3 : outcome === "draw" ? 1 : 0;
  const team = teams.get(side.code);
  if (team) {
    team.played += 1;
    team.points += points;
    if (outcome === "win") team.wins += 1;
    else if (outcome === "draw") team.draws += 1;
    else team.losses += 1;
  }
  for (const owner of side.owners) {
    const p = players.get(owner);
    if (!p) continue;
    p.played += 1;
    p.points += points;
    if (outcome === "win") p.wins += 1;
    else if (outcome === "draw") p.draws += 1;
    else p.losses += 1;
  }
}
