"use client";

import type { Match, MatchSide } from "@/lib/standings";
import { PLAYER_COLOR } from "@/lib/ui";

const ROUND_ORDER = [
  "Seizième de finale",
  "Huitième de finale",
  "Quart de finale",
  "Demi-finale",
  "Finale",
];

const ROUND_SHORT: Record<string, string> = {
  "Seizième de finale": "32e",
  "Huitième de finale": "16e",
  "Quart de finale": "Quarts",
  "Demi-finale": "Demis",
  "Finale": "Finale",
};

const CARD_H = 78;
const GAP = 8;
const SLOT = CARD_H + GAP;

type Positioned = { match: Match; centerSlot: number };

// Parse ESPN placeholder names like "Round of 32 3 Winner" → 3
function extractPrevMatchNum(label: string, prevRoundFr: string): number | null {
  const patterns: Record<string, RegExp> = {
    "Seizième de finale": /round[\s-]of[\s-]32\D*?(\d+)/i,
    "Huitième de finale": /round[\s-]of[\s-]16\D*?(\d+)/i,
    "Quart de finale":    /quarter[\s-]?final\D*?(\d+)/i,
    "Demi-finale":        /semi[\s-]?final\D*?(\d+)/i,
  };
  const re = patterns[prevRoundFr];
  if (!re) return null;
  const m = label.match(re);
  return m ? parseInt(m[1], 10) : null;
}

// Reorder prevRoundMatches so each consecutive pair [2i, 2i+1] feeds nextRound[i].
// This is necessary because FIFA 2026 uses cross-bracket seeding — match 1 plays
// match 3 in R16, not match 2 — so chronological or event-ID order is wrong.
function reorderByNextRound(
  prevSorted: Match[],
  nextSorted: Match[],
  prevRoundFr: string,
): Match[] {
  const reordered: Match[] = [];
  const placed = new Set<string>();

  const addSide = (side: MatchSide) => {
    const num = extractPrevMatchNum(side.label, prevRoundFr);
    let found: Match | undefined;
    if (num !== null && num >= 1 && num <= prevSorted.length) {
      found = prevSorted[num - 1];
    } else {
      // Real team (match already played): find by team code
      found = prevSorted.find(
        (m) => m.home.code === side.code || m.away.code === side.code,
      );
    }
    if (found && !placed.has(found.id)) {
      reordered.push(found);
      placed.add(found.id);
    }
  };

  for (const nextMatch of nextSorted) {
    addSide(nextMatch.home);
    addSide(nextMatch.away);
  }
  // Append anything not yet referenced (safety net)
  for (const m of prevSorted) {
    if (!placed.has(m.id)) reordered.push(m);
  }

  return reordered;
}

type Props = { matches: Match[] };

export function Brackets({ matches }: Props) {
  const knockout = matches.filter(
    (m) => m.isKnockout && m.round !== "Troisième place",
  );

  const byRound: Record<string, Match[]> = {};
  for (const m of knockout) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }
  // Base sort by ESPN event ID (this gives ESPN's internal match numbering 1..N)
  for (const r of Object.values(byRound)) {
    r.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  const rounds = ROUND_ORDER.filter((r) => byRound[r]?.length > 0);

  if (rounds.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-gray-500 ring-1 ring-black/5">
        Les matchs à élimination directe n&apos;ont pas encore commencé.
      </div>
    );
  }

  // Reorder each round so adjacent pairs feed the same next-round match.
  // We process left-to-right: R32 is reordered using R16 pairings, R16 using QF, etc.
  const ordered: Record<string, Match[]> = {};
  for (let i = 0; i < rounds.length; i++) {
    const cur = rounds[i];
    const next = rounds[i + 1];
    if (next) {
      ordered[cur] = reorderByNextRound(byRound[cur], byRound[next], cur);
    } else {
      ordered[cur] = byRound[cur]; // Final: no reordering needed
    }
  }

  // Position matches. Pairs are now adjacent so sequential math is exact.
  const positionedByRound: Record<string, Positioned[]> = {};
  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const ms = ordered[round];
    if (ri === 0) {
      positionedByRound[round] = ms.map((m, i) => ({ match: m, centerSlot: i + 0.5 }));
    } else {
      const prev = positionedByRound[rounds[ri - 1]];
      positionedByRound[round] = ms.map((m, i) => {
        const c1 = prev[i * 2]?.centerSlot ?? i * 2 + 0.5;
        const c2 = prev[i * 2 + 1]?.centerSlot ?? i * 2 + 1.5;
        return { match: m, centerSlot: (c1 + c2) / 2 };
      });
    }
  }

  const firstRoundIdx = ROUND_ORDER.indexOf(rounds[0]);
  const firstCount = ordered[rounds[0]].length;
  const totalSlots = firstCount * Math.pow(2, firstRoundIdx);
  const totalH = totalSlots * SLOT;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4">
      <div className="flex gap-3" style={{ width: "max-content" }}>
        {rounds.map((round) => {
          const positioned = positionedByRound[round];
          return (
            <div key={round} style={{ width: 152 }}>
              <div className="mb-2 rounded-full bg-emerald-700 py-1 text-center text-xs font-bold tracking-wide text-white">
                {ROUND_SHORT[round] ?? round}
              </div>
              <div className="relative" style={{ height: totalH }}>
                {positioned.map(({ match, centerSlot }) => (
                  <div
                    key={match.id}
                    className="absolute w-full"
                    style={{
                      top: Math.round(centerSlot * SLOT - CARD_H / 2),
                      height: CARD_H,
                    }}
                  >
                    <MatchCard match={match} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const hs = match.home.score;
  const as_ = match.away.score;
  const decided = match.status === "final" && hs !== null && as_ !== null;
  const homeWins = decided && hs! > as_!;
  const awayWins = decided && as_! > hs!;

  return (
    <div className="h-full overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
      <TeamRow side={match.home} winner={homeWins} />
      <div className="h-px bg-gray-100" />
      <TeamRow side={match.away} winner={awayWins} />
    </div>
  );
}

function isTbd(label: string): boolean {
  return (
    !label ||
    label === "TBD" ||
    /^(round|winner|loser|tbd|quarterfinal|semifinal|final)/i.test(label)
  );
}

function TeamRow({ side, winner }: { side: MatchSide; winner: boolean }) {
  const tbd = isTbd(side.label);
  const ownerColor = side.owners[0] ? PLAYER_COLOR[side.owners[0]] : undefined;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 ${winner ? "bg-emerald-50" : ""}`}>
      {side.logo && !tbd ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.logo} alt="" className="h-4 w-4 flex-shrink-0 object-contain" />
      ) : (
        <span className="h-4 w-4 flex-shrink-0 rounded-sm bg-gray-200" />
      )}

      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-xs font-semibold leading-tight ${tbd ? "italic text-gray-400" : "text-gray-800"}`}
          style={ownerColor && !tbd ? { color: ownerColor } : undefined}
        >
          {tbd ? "TBD" : side.label}
        </div>
        {!tbd && side.owners.length > 0 && (
          <div className="truncate text-[10px] leading-tight">
            {side.owners.map((o, i) => (
              <span key={o} style={{ color: PLAYER_COLOR[o] }}>
                {i > 0 ? " · " : ""}
                {o}
              </span>
            ))}
          </div>
        )}
        {!tbd && side.owners.length === 0 && (
          <div className="text-[10px] leading-tight text-gray-300">—</div>
        )}
      </div>

      {side.score !== null && (
        <span className={`flex-shrink-0 tabular-nums text-xs font-bold ${winner ? "text-emerald-700" : "text-gray-400"}`}>
          {side.score}
        </span>
      )}
    </div>
  );
}
