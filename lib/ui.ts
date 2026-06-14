import type { Player } from "./teams";

// A distinct accent colour per player, reused across the leaderboard,
// matches and player pages so everyone is easy to recognise at a glance.
export const PLAYER_COLOR: Record<Player, string> = {
  Franzou: "#ef4444", // red
  Marion: "#f59e0b", // amber
  Riton: "#22c55e", // green
  "Jean-Marc": "#3b82f6", // blue
  Gustave: "#f97316", // orange
  Pierrick: "#a855f7", // purple
  Nadir: "#ec4899", // pink
};

export const RANK_MEDAL: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function formatUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
