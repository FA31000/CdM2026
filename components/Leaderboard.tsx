"use client";

import type { PlayerStanding } from "@/lib/standings";
import { PLAYER_COLOR, RANK_MEDAL } from "@/lib/ui";

export type SortMode = "ppg" | "points";

// Re-sort and re-rank the players for the chosen metric. Ties share a rank.
function rankBy(players: PlayerStanding[], mode: SortMode): PlayerStanding[] {
  const value = (p: PlayerStanding) => (mode === "ppg" ? p.ppg : p.points);
  const sorted = [...players].sort(
    (a, b) =>
      value(b) - value(a) ||
      b.ppg - a.ppg ||
      b.points - a.points ||
      b.wins - a.wins,
  );
  return sorted.map((p, i, arr) => ({
    ...p,
    rank: i === 0 ? 1 : value(arr[i - 1]) === value(p) ? arr[i - 1].rank : i + 1,
  }));
}

export function Leaderboard({
  players: rawPlayers,
  mode,
}: {
  players: PlayerStanding[];
  mode: SortMode;
}) {
  const players = rankBy(rawPlayers, mode);
  const lastRank = players.length ? players[players.length - 1].rank : 0;

  return (
    <div className="flex flex-col gap-3">
      {players.map((p) => {
        const medal = RANK_MEDAL[p.rank];
        const isLast = p.rank === lastRank && p.played >= 0 && players.length > 1;
        return (
          <div
            key={p.name}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <div className="flex w-10 shrink-0 items-center justify-center text-2xl font-bold text-gray-400">
              {medal ?? p.rank}
            </div>
            <div
              className="h-10 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: PLAYER_COLOR[p.name] }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                {p.name}
                {isLast && !medal && (
                  <span title="Bon dernier" className="text-base">
                    🥄
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {p.wins} V · {p.draws} N · {p.losses} D
                <span className="text-gray-300"> · </span>
                {p.played} match{p.played > 1 ? "s" : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {mode === "ppg" ? (
                <>
                  <div className="text-2xl font-extrabold text-emerald-700">
                    {p.ppg.toFixed(2)}
                  </div>
                  <div className="-mt-1 text-xs uppercase tracking-wide text-gray-400">
                    pts/match
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {p.points} pts au total
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-extrabold text-emerald-700">
                    {p.points}
                  </div>
                  <div className="-mt-1 text-xs uppercase tracking-wide text-gray-400">
                    pts
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {p.ppg.toFixed(2)} pts/match
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
