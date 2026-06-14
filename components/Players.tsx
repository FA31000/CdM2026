"use client";

import { useState } from "react";
import type { Match, PlayerStanding, TeamStanding } from "@/lib/standings";
import { PLAYER_COLOR, RANK_MEDAL } from "@/lib/ui";

// Short date label for an upcoming game, e.g. "sam. 14 juin 18:00".
function gameDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The next not-yet-finished games for a team, soonest first.
function upcomingForTeam(code: string, matches: Match[]): { opponent: string; date: string }[] {
  return matches
    .filter(
      (m) =>
        m.status !== "final" && (m.home.code === code || m.away.code === code),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((m) => ({
      opponent: m.home.code === code ? m.away.label : m.home.label,
      date: m.date,
    }));
}

export function Players({
  players,
  teams,
  matches,
}: {
  players: PlayerStanding[];
  teams: TeamStanding[];
  matches: Match[];
}) {
  const [open, setOpen] = useState<string | null>(players[0]?.name ?? null);

  return (
    <div className="flex flex-col gap-3">
      {players.map((p) => {
        const myTeams = teams
          .filter((t) => t.owners.includes(p.name))
          .sort((a, b) => b.points - a.points);
        const isOpen = open === p.name;
        return (
          <div
            key={p.name}
            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
          >
            <button
              onClick={() => setOpen(isOpen ? null : p.name)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span
                className="h-9 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PLAYER_COLOR[p.name] }}
              />
              <span className="flex-1 font-semibold text-gray-900">
                {RANK_MEDAL[p.rank] ?? `#${p.rank}`} {p.name}
              </span>
              <span className="text-lg font-extrabold text-emerald-700">
                {p.ppg.toFixed(2)}
              </span>
              <span className="text-xs uppercase text-gray-400">pts/match</span>
              <span className={`text-gray-300 transition ${isOpen ? "rotate-90" : ""}`}>
                ›
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100">
                {myTeams.map((t) => {
                  const upcoming = upcomingForTeam(t.code, matches);
                  const next = upcoming[0];
                  return (
                    <div
                      key={t.code}
                      className="px-4 py-2.5 text-sm odd:bg-gray-50/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800">
                          {t.label}
                          {t.owners.length > 1 && (
                            <span className="ml-1 text-xs text-gray-400">(partagé)</span>
                          )}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-gray-400">
                            {t.wins}V {t.draws}N {t.losses}D
                          </span>
                          <span className="w-8 text-right font-semibold text-emerald-700">
                            {t.points}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 text-xs">
                        {next ? (
                          <span className="text-gray-500">
                            ⚽ Prochain : {next.opponent} ·{" "}
                            <span className="text-gray-400">{gameDate(next.date)}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">Plus de matchs à venir</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
