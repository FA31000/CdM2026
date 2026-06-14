"use client";

import { useProjection } from "@/lib/useProjection";
import type { Finish, TeamProjection } from "@/lib/projection";
import { PLAYER_COLOR, RANK_MEDAL } from "@/lib/ui";

const FINISH_LABEL: Record<Finish, string> = {
  champion: "🏆 Vainqueur",
  final: "Finaliste",
  sf: "Demi-finale",
  qf: "Quart de finale",
  r16: "8es de finale",
  r32: "16es de finale",
  groups: "Phase de groupes",
};

export function Projection() {
  const { data, isLoading, isError } = useProjection();

  if (isLoading)
    return (
      <div className="flex flex-col gap-3">
        <div className="h-56 animate-pulse rounded-2xl bg-gray-200/70" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-200/70" />
        ))}
      </div>
    );

  if (isError || !data)
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-gray-500 ring-1 ring-black/5">
        Impossible de calculer les projections. Réessaie dans un instant.
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-2xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900 ring-1 ring-emerald-600/10">
        Projection sur <b>{data.simulations.toLocaleString("fr-FR")}</b> simulations
        du tournoi. Les matchs connus utilisent les cotes réelles des bookmakers ;
        les matchs à élimination hypothétiques utilisent la force des équipes (Elo).
      </p>

      <Chart data={data} />

      {/* Projected final player standings */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-500">
          Classement final projeté
        </h2>
        <div className="flex flex-col gap-3">
          {data.players.map((p) => {
            const medal = RANK_MEDAL[p.rank];
            return (
              <div
                key={p.name}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex w-8 shrink-0 items-center justify-center text-2xl font-bold text-gray-400">
                  {medal ?? p.rank}
                </div>
                <div
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PLAYER_COLOR[p.name] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="mt-0.5 text-sm text-gray-500">
                    {p.pointsSoFar} pts à ce jour <span className="text-gray-300">·</span>{" "}
                    <LuckBadge luck={p.luck} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-extrabold text-emerald-700">
                    {p.expectedPoints}
                  </div>
                  <div className="-mt-1 text-xs uppercase tracking-wide text-gray-400">
                    pts projetés
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {p.expectedPpg.toFixed(2)} pts/match
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Per-team projection */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-500">
          Par équipe
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {data.teams
            .filter((t) => t.owners.length > 0)
            .map((t, i) => (
              <TeamRow key={t.code} team={t} first={i === 0} />
            ))}
        </div>
      </section>
    </div>
  );
}

function TeamRow({ team, first }: { team: TeamProjection; first: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        first ? "" : "border-t border-gray-100"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900">{team.label}</span>
          <span className="flex shrink-0 gap-1">
            {team.owners.map((o) => (
              <span
                key={o}
                title={o}
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: PLAYER_COLOR[o] }}
              />
            ))}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-gray-500">
          {FINISH_LABEL[team.expectedFinish]}
          <span className="text-gray-300"> · </span>
          {Math.round(team.qualifyProb * 100)}% qualifié
          {team.finishProbs.champion >= 0.01 && (
            <>
              <span className="text-gray-300"> · </span>
              {Math.round(team.finishProbs.champion * 100)}% 🏆
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-bold text-emerald-700">{team.expectedPoints}</div>
        <div className="-mt-1 text-[10px] uppercase tracking-wide text-gray-400">
          pts projetés
        </div>
      </div>
    </div>
  );
}

function LuckBadge({ luck }: { luck: number }) {
  if (Math.abs(luck) < 0.5)
    return <span className="text-gray-400">dans les clous</span>;
  const over = luck > 0;
  return (
    <span className={over ? "text-emerald-600" : "text-rose-500"}>
      {over ? "▲ +" : "▼ "}
      {luck.toFixed(1)} vs attendu
    </span>
  );
}

// Hand-drawn SVG line chart: one line per player, points accumulating over
// time. Solid where the games are already played, dotted for the projection.
function Chart({ data }: { data: NonNullable<ReturnType<typeof useProjection>["data"]> }) {
  const { series, labels } = data.timeline;
  const n = labels.length;
  if (n < 2) return null;

  const W = 700;
  const H = 320;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 26;

  const maxY = Math.max(
    1,
    ...series.map((s) => Math.max(...s.values)),
  );
  const yMax = Math.ceil(maxY / 5) * 5;

  const x = (i: number) => padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v: number) => padT + (1 - v / yMax) * (H - padT - padB);

  // Boundary index: where projection begins (max actualCount across players).
  const boundary = Math.max(0, ...series.map((s) => s.actualCount)) - 1;

  const line = (pts: { i: number; v: number }[]) =>
    pts.map((p, k) => `${k === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");

  const gridYs = [0, yMax / 2, yMax];
  // Show ~6 date labels evenly across the axis.
  const step = Math.max(1, Math.round(n / 6));

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {/* horizontal gridlines */}
        {gridYs.map((gy) => (
          <g key={gy}>
            <line x1={padL} y1={y(gy)} x2={W - padR} y2={y(gy)} stroke="#f1f5f9" />
            <text x={4} y={y(gy) + 3} fontSize="9" fill="#94a3b8">
              {Math.round(gy)}
            </text>
          </g>
        ))}

        {/* projection-start divider */}
        {boundary >= 0 && boundary < n - 1 && (
          <g>
            <line
              x1={x(boundary)}
              y1={padT}
              x2={x(boundary)}
              y2={H - padB}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
            />
            <text x={x(boundary) + 3} y={padT + 8} fontSize="8" fill="#94a3b8">
              projection →
            </text>
          </g>
        )}

        {/* x labels */}
        {labels.map((lab, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={H - padB + 14}
              fontSize="8"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {lab}
            </text>
          ) : null,
        )}

        {/* one line per player */}
        {series.map((s) => {
          const color = PLAYER_COLOR[s.name];
          const cut = Math.max(1, s.actualCount); // index where actual ends
          const solid = s.values.slice(0, cut).map((v, i) => ({ i, v }));
          const dotted = s.values
            .slice(Math.max(0, cut - 1))
            .map((v, k) => ({ i: Math.max(0, cut - 1) + k, v }));
          return (
            <g key={s.name}>
              {solid.length > 1 && (
                <path d={line(solid)} fill="none" stroke={color} strokeWidth={2} />
              )}
              {dotted.length > 1 && (
                <path
                  d={line(dotted)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  opacity={0.85}
                />
              )}
              {/* endpoint dot */}
              <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={2.5} fill={color} />
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1 text-xs text-gray-600">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PLAYER_COLOR[s.name] }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
