// Fetches World Cup 2026 matches from ESPN's free public endpoint (no API key).

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300";

export type EspnCompetitor = {
  homeAway: "home" | "away";
  score: string;
  winner?: boolean;
  team: {
    abbreviation: string;
    displayName: string;
    logo?: string;
  };
};

// Betting odds block (DraftKings via ESPN). American moneylines.
export type EspnOdds = {
  drawOdds?: { moneyLine?: number };
  moneyline?: {
    home?: { open?: { odds?: string }; close?: { odds?: string } };
    away?: { open?: { odds?: string }; close?: { odds?: string } };
  };
};

export type EspnEvent = {
  id: string;
  date: string;
  name?: string;
  shortName?: string;
  status: {
    type: { state: string; completed: boolean; shortDetail: string };
  };
  competitions: { competitors: EspnCompetitor[]; odds?: EspnOdds[] }[];
};

export async function fetchEvents(): Promise<EspnEvent[]> {
  // Cache for 2 minutes so many visitors don't hammer ESPN.
  const res = await fetch(ESPN_URL, { next: { revalidate: 120 } });
  if (!res.ok) {
    throw new Error(`ESPN request failed: ${res.status}`);
  }
  const data = await res.json();
  return (data.events ?? []) as EspnEvent[];
}
