"use client";

import { useMemo, useState } from "react";
import type { Match, MatchSide } from "@/lib/standings";
import { PLAYERS, type Player } from "@/lib/teams";
import { PLAYER_COLOR } from "@/lib/ui";

type MatchFilter = "future" | "past";
type PlayerFilter = Player | "all";

function statusOrder(m: Match): number {
  if (m.status === "live") return 0;
  if (m.status === "final") return 1;
  return 2;
}

function Side({ side, dim }: { side: MatchSide; dim: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${dim ? "opacity-50" : ""}`}>
      {side.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.logo} alt="" className="h-6 w-6 object-contain" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-gray-200" />
      )}
      <span className="truncate font-medium text-gray-900">{side.label}</span>
      {side.owners.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {side.owners.map((o) => (
            <span
              key={o}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: PLAYER_COLOR[o] }}
            >
              {o}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function MatchCard({ m }: { m: Match }) {
  const homeWon = m.status === "final" && (m.home.score ?? 0) > (m.away.score ?? 0);
  const awayWon = m.status === "final" && (m.away.score ?? 0) > (m.home.score ?? 0);
  const dateLabel = new Date(m.date).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {dateLabel}
          {m.round && (
            <span className="ml-2 text-gray-400">· {m.round}</span>
          )}
        </span>
        {m.status === "live" && (
          <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            EN DIRECT
          </span>
        )}
        {m.status === "final" && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
            Terminé
          </span>
        )}
        {m.status === "scheduled" && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-600">
            À venir
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Side side={m.home} dim={awayWon} />
        <ScoreBox m={m} highlightHome={homeWon} highlightAway={awayWon} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Side side={m.away} dim={homeWon} />
      </div>
    </div>
  );
}

function ScoreBox({
  m,
  highlightHome,
  highlightAway,
}: {
  m: Match;
  highlightHome: boolean;
  highlightAway: boolean;
}) {
  if (m.status === "scheduled") {
    return <span className="text-sm text-gray-300">—</span>;
  }
  return (
    <div className="flex flex-col items-end font-bold tabular-nums">
      <span className={highlightHome ? "text-emerald-700" : "text-gray-700"}>
        {m.home.score ?? 0}
      </span>
      <span className={highlightAway ? "text-emerald-700" : "text-gray-700"}>
        {m.away.score ?? 0}
      </span>
    </div>
  );
}

function PlayerChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-emerald-700 text-white"
          : "bg-white text-gray-600 ring-1 ring-black/5 hover:bg-gray-100"
      }`}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}

export function Matches({ matches }: { matches: Match[] }) {
  const [filter, setFilter] = useState<MatchFilter>("future");
  const [player, setPlayer] = useState<PlayerFilter>("all");

  const sorted = useMemo(() => {
    return [...matches]
      .filter((m) =>
        filter === "past" ? m.status === "final" : m.status !== "final"
      )
      .filter(
        (m) =>
          player === "all" ||
          m.home.owners.includes(player) ||
          m.away.owners.includes(player)
      )
      .sort((a, b) => {
        const so = statusOrder(a) - statusOrder(b);
        if (so !== 0) return so;
        // Finals: most recent first. Scheduled/live: soonest first.
        const at = new Date(a.date).getTime();
        const bt = new Date(b.date).getTime();
        return a.status === "final" ? bt - at : at - bt;
      });
  }, [matches, filter, player]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full bg-gray-200/70 p-1">
        <button
          onClick={() => setFilter("future")}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            filter === "future"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          À venir
        </button>
        <button
          onClick={() => setFilter("past")}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            filter === "past"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Passés
        </button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <PlayerChip
          label="Tous"
          active={player === "all"}
          onClick={() => setPlayer("all")}
        />
        {PLAYERS.map((p) => (
          <PlayerChip
            key={p}
            label={p}
            color={PLAYER_COLOR[p]}
            active={player === p}
            onClick={() => setPlayer(player === p ? "all" : p)}
          />
        ))}
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-gray-500 ring-1 ring-black/5">
          {filter === "past" ? "Aucun match terminé." : "Aucun match à venir."}
        </div>
      ) : (
        sorted.map((m) => <MatchCard key={m.id} m={m} />)
      )}
    </div>
  );
}
