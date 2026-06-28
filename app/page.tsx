"use client";

import { useState } from "react";
import { useStandings } from "@/lib/useStandings";
import { Leaderboard } from "@/components/Leaderboard";
import { Matches } from "@/components/Matches";
import { Players } from "@/components/Players";
import { Projection } from "@/components/Projection";
import { Brackets } from "@/components/Brackets";
import { formatUpdated } from "@/lib/ui";

type Tab = "classement" | "matchs" | "joueurs" | "tableau" | "projection";

const TABS: { id: Tab; label: string }[] = [
  { id: "classement", label: "Classement" },
  { id: "matchs", label: "Matchs" },
  { id: "joueurs", label: "Joueurs" },
  { id: "tableau", label: "🏆 Tableau" },
  { id: "projection", label: "📈 Projection" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("classement");
  const { data, isLoading, isError, isFetching, refetch } = useStandings();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pb-5 pt-7 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl">⚽</div>
            <h1 className="text-xl font-extrabold leading-tight">
              Coupe du Monde 2026
            </h1>
            <p className="text-sm text-emerald-100/80">La ligue des potes</p>
          </div>
          <button
            onClick={() => refetch()}
            className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur transition hover:bg-white/25"
          >
            {isFetching ? "…" : "↻ Actualiser"}
          </button>
        </div>
        {data && (
          <p className="mt-3 text-xs text-emerald-100/70">
            Mis à jour {formatUpdated(data.lastUpdated)}
          </p>
        )}
      </header>

      {/* Tabs */}
      <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50/95 px-3 py-2 backdrop-blur scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-emerald-700 text-white"
                : "text-gray-500 hover:bg-gray-200/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div className="flex-1 p-4">
        {isLoading && <SkeletonList />}
        {isError && (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-500 ring-1 ring-black/5">
            Impossible de charger les données. Réessaie dans un instant.
          </div>
        )}
        {data && tab === "classement" && (
          <Leaderboard players={data.players} mode="points" />
        )}
        {data && tab === "matchs" && <Matches matches={data.matches} />}
        {data && tab === "joueurs" && (
          <Players players={data.players} teams={data.teams} matches={data.matches} />
        )}
        {data && tab === "tableau" && <Brackets matches={data.matches} />}
        {tab === "projection" && <Projection />}
      </div>
    </main>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-200/70" />
      ))}
    </div>
  );
}
