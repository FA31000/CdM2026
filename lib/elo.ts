// Free, public-style World Football Elo ratings for the 48 teams, used to
// estimate win/draw probabilities for matchups we have no bookmaker odds for
// (i.e. hypothetical knockout games where the opponents aren't known yet).
// Seeds are approximate tournament-start values; they are nudged by real
// results before the projection runs, so they stay roughly current.

// Approximate Elo by ESPN/FIFA 3-letter code. Any team not listed defaults
// to 1700 (a mid-table international side).
export const ELO_SEED: Record<string, number> = {
  ARG: 2090, ESP: 2070, FRA: 2055, BRA: 2030, ENG: 2010, POR: 2000, NED: 2000,
  GER: 1965, BEL: 1935, CRO: 1920, COL: 1900, URU: 1895, MAR: 1880, NOR: 1840,
  JPN: 1840, SUI: 1850, SEN: 1820, ECU: 1820, SWE: 1810, USA: 1810, MEX: 1810,
  TUR: 1810, AUT: 1800, IRN: 1800, KOR: 1790, ALG: 1780, CZE: 1775, CAN: 1780,
  CIV: 1760,
  EGY: 1760, PAR: 1760, SCO: 1760, AUS: 1740, GHA: 1720, BIH: 1720, COD: 1700,
  RSA: 1700, QAT: 1690, TUN: 1690, KSA: 1680, UZB: 1680, PAN: 1660, IRQ: 1650,
  JOR: 1620, CPV: 1610, CUW: 1540, HAI: 1520, NZL: 1500,
};

export const DEFAULT_ELO = 1700;

export function seedElo(code: string): number {
  return ELO_SEED[code] ?? DEFAULT_ELO;
}

// Probability the first team beats-or-draws the second, ignoring draws.
// Standard Elo expected score (0..1), 0.5 means evenly matched.
export function eloExpected(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// Split an Elo matchup into win / draw / loss probabilities for team A.
// Draws are most likely when teams are evenly matched and fade as the gap
// grows; the win/loss split is anchored to the Elo expected score so the
// expected points stay consistent.
export function eloProbabilities(
  eloA: number,
  eloB: number,
): { win: number; draw: number; loss: number } {
  const we = eloExpected(eloA, eloB); // expected score for A (0..1)
  const margin = Math.abs(we - 0.5); // 0 = even, 0.5 = total mismatch
  // Draw share: ~28% for an even game, shrinking towards ~8% for blowouts.
  const draw = Math.max(0.08, 0.28 - 0.4 * margin);
  let win = we - draw / 2;
  let loss = 1 - draw - win;
  // Guard against tiny negatives from the approximation.
  if (win < 0) { loss += win; win = 0; }
  if (loss < 0) { win += loss; loss = 0; }
  return { win, draw, loss };
}

// Update Elo ratings in place from a finished match (W=1, draw=0.5, L=0).
// K=40 is the usual World Cup weighting.
export function updateElo(
  elo: Record<string, number>,
  codeA: string,
  codeB: string,
  scoreA: number, // 1, 0.5 or 0
): void {
  const ra = elo[codeA] ?? DEFAULT_ELO;
  const rb = elo[codeB] ?? DEFAULT_ELO;
  const ea = eloExpected(ra, rb);
  const k = 40;
  elo[codeA] = ra + k * (scoreA - ea);
  elo[codeB] = rb + k * (1 - scoreA - (1 - ea));
}
