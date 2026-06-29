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

// Card height must be exact so absolute positioning aligns correctly.
const CARD_H = 78;
const GAP = 8;
const SLOT = CARD_H + GAP;

// Each match gets a "centerSlot" — its vertical center expressed in slot units.
// R32[0] → 0.5, R32[1] → 1.5, etc.  Total height = numR32Slots * SLOT.
type Positioned = { match: Match; centerSlot: number };

// Parse an ESPN placeholder label (e.g. "Round of 32 3 Winner") to extract the
// 1-indexed match number for a given previous round.
function extractPrevMatchNum(label: string, prevRoundFr: string): number | null {
  const byRound: Record<string, RegExp[]> = {
    "Seizième de finale": [/round[\s-]of[\s-]32\D*?(\d+)/i],
    "Huitième de finale": [/round[\s-]of[\s-]16\D*?(\d+)/i],
    "Quart de finale":    [/quarter[\s-]?final\D*?(\d+)/i],
    "Demi-finale":        [/semi[\s-]?final\D*?(\d+)/i],
  };
  for (const re of byRound[prevRoundFr] ?? []) {
    const m = label.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// Given a match side, find the centerSlot of the previous-round match that feeds
// into this slot — either by parsing the ESPN placeholder name, or by finding a
// real team in the previous round.
function getPrevCenterSlot(
  side: MatchSide,
  prevRoundFr: string,
  prev: Positioned[],
  fallback: number,
): number {
  const num = extractPrevMatchNum(side.label, prevRoundFr);
  if (num !== null && num >= 1 && num <= prev.length) {
    return prev[num - 1].centerSlot;
  }
  // Real team (match already played): find it in the previous round
  const found = prev.find(
    (p) => p.match.home.code === side.code || p.match.away.code === side.code,
  );
  if (found) return found.centerSlot;
  return fallback + 0.5; // sequential fallback
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
  // Sort by ESPN event ID — this is the bracket order ESPN assigns (match 1, 2, ..., 16)
  // which is NOT the same as chronological schedule order.
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

  // Compute vertical centerSlot for every match in every round.
  const positionedByRound: Record<string, Positioned[]> = {};

  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const ms = byRound[round];

    if (ri === 0) {
      positionedByRound[round] = ms.map((m, i) => ({ match: m, centerSlot: i + 0.5 }));
    } else {
      const prevRound = rounds[ri - 1];
      const prev = positionedByRound[prevRound];
      positionedByRound[round] = ms.map((m, i) => {
        const cs1 = getPrevCenterSlot(m.home, prevRound, prev, i * 2);
        const cs2 = getPrevCenterSlot(m.away, prevRound, prev, i * 2 + 1);
        return { match: m, centerSlot: (cs1 + cs2) / 2 };
      });
    }
  }

  // Total height: first round count × 2^(its index in ROUND_ORDER) slots
  const firstRoundIdx = ROUND_ORDER.indexOf(rounds[0]);
  const firstCount = byRound[rounds[0]].length;
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
