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
// Each TeamRow = py-1.5 (12px) + text-xs (14px) + text-[10px] owner (12px) = 38px
// Card = 38 + 1 (divider) + 38 = 77px → round to 78.
const CARD_H = 78;
const GAP = 8;
const SLOT = CARD_H + GAP;

// Given the effective round index (0 = first visible round) and match index,
// return the absolute top offset in px.
function cardTop(effectiveRound: number, matchIdx: number): number {
  if (effectiveRound === 0) return matchIdx * SLOT;
  const half = Math.pow(2, effectiveRound - 1);
  const full = Math.pow(2, effectiveRound);
  return (full * matchIdx + half) * SLOT - CARD_H / 2;
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
  // Sort each round by date so match ordering is stable
  for (const r of Object.values(byRound)) {
    r.sort((a, b) => a.date.localeCompare(b.date));
  }

  const rounds = ROUND_ORDER.filter((r) => byRound[r]?.length > 0);

  if (rounds.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-gray-500 ring-1 ring-black/5">
        Les matchs à élimination directe n&apos;ont pas encore commencé.
      </div>
    );
  }

  // The first visible round determines the total height.
  const firstRoundIdx = ROUND_ORDER.indexOf(rounds[0]);
  const firstCount = byRound[rounds[0]].length;
  const totalSlots = firstCount * Math.pow(2, firstRoundIdx);
  const totalH = totalSlots * SLOT;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4">
      <div className="flex gap-3" style={{ width: "max-content" }}>
        {rounds.map((round) => {
          const roundIdx = ROUND_ORDER.indexOf(round);
          const effectiveRound = roundIdx - firstRoundIdx;
          const ms = byRound[round];
          return (
            <div key={round} style={{ width: 152 }}>
              <div className="mb-2 rounded-full bg-emerald-700 py-1 text-center text-xs font-bold tracking-wide text-white">
                {ROUND_SHORT[round] ?? round}
              </div>
              <div className="relative" style={{ height: totalH }}>
                {ms.map((m, i) => (
                  <div
                    key={m.id}
                    className="absolute w-full"
                    style={{ top: cardTop(effectiveRound, i), height: CARD_H }}
                  >
                    <MatchCard match={m} />
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

function isTbdLabel(label: string): boolean {
  return (
    !label ||
    label === "TBD" ||
    /^(round|winner|loser|tbd|quarterfinal|semifinal|final)/i.test(label)
  );
}

function TeamRow({ side, winner }: { side: MatchSide; winner: boolean }) {
  const tbd = isTbdLabel(side.label);
  const ownerColor = side.owners[0] ? PLAYER_COLOR[side.owners[0]] : undefined;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 ${winner ? "bg-emerald-50" : ""}`}
    >
      {/* Flag */}
      {side.logo && !tbd ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={side.logo}
          alt=""
          className="h-4 w-4 flex-shrink-0 object-contain"
        />
      ) : (
        <span className="h-4 w-4 flex-shrink-0 rounded-sm bg-gray-200" />
      )}

      {/* Name + owner */}
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-xs font-semibold leading-tight ${tbd ? "italic text-gray-400" : "text-gray-800"}`}
          style={ownerColor && !tbd ? { color: ownerColor } : undefined}
        >
          {tbd ? "TBD" : side.label}
        </div>
        {!tbd && side.owners.length > 0 && (
          <div className="truncate text-[10px] leading-tight text-gray-400">
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

      {/* Score */}
      {side.score !== null && (
        <span
          className={`flex-shrink-0 tabular-nums text-xs font-bold ${winner ? "text-emerald-700" : "text-gray-400"}`}
        >
          {side.score}
        </span>
      )}
    </div>
  );
}
