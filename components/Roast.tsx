"use client";

import { useRoasts } from "@/lib/useRoasts";
import { PLAYER_COLOR } from "@/lib/ui";
import type { Player } from "@/lib/teams";

function colorFor(name: string): string | undefined {
  return (PLAYER_COLOR as Record<string, string>)[name as Player];
}

export function Roast({ active }: { active: boolean }) {
  const { data, isLoading, isFetching, isError, refetch } = useRoasts(active);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="self-center rounded-full bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
      >
        {isFetching ? "Claude réfléchit… 🔥" : "Roaste-les encore 🔥"}
      </button>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200/70" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl bg-white p-6 text-center text-gray-500 ring-1 ring-black/5">
          Le roast a échoué. Réessaie dans un instant.
        </div>
      )}

      {data?.roasts.map((r, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          style={{ borderLeft: `4px solid ${colorFor(r.player) ?? "#f97316"}` }}
        >
          {r.player && (
            <div className="mb-1 font-bold text-gray-900">{r.player}</div>
          )}
          <p className="text-gray-700">{r.text}</p>
        </div>
      ))}
    </div>
  );
}
