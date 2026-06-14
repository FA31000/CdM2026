import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchEvents } from "@/lib/espn";
import { computeStandings, Standings } from "@/lib/standings";

export const dynamic = "force-dynamic";

function buildPrompt(s: Standings): string {
  const lines = s.players.map((p) => {
    const teams = s.teams
      .filter((t) => t.owners.includes(p.name))
      .sort((a, b) => b.points - a.points)
      .map((t) => `${t.label} (${t.points}pt)`)
      .join(", ");
    return `#${p.rank} ${p.name} — ${p.ppg.toFixed(2)} pts/match (${p.points} pts au total, ${p.wins}V ${p.draws}N ${p.losses}D). Équipes : ${teams}.`;
  });
  return `Voici le classement actuel de notre ligue entre potes pour la Coupe du Monde 2026 (3 pts par victoire, 1 pt par nul). Le classement se fait à la moyenne de points par match, pas au total :\n\n${lines.join("\n")}`;
}

export async function GET() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API manquante." },
        { status: 500 },
      );
    }

    const standings = computeStandings(await fetchEvents());
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system:
        "Tu es un commentateur sportif français, cinglant et impitoyable, qui démolit un groupe de potes pariant sur la Coupe du Monde. " +
        "Tu écris des piques courtes, féroces et assassines : moqueries cruelles, humiliations bien senties, vannes qui font mal. " +
        "Sois sarcastique, méprisant et sans pitié — chambre fort, vise l'orgueil et l'incompétence. " +
        "Détruis surtout le premier (insupportable de prétention) et le dernier (une catastrophe ambulante qui devrait avoir honte). " +
        "Pas de gentillesse, pas de compassion. Reste drôle mais brutal. " +
        "Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, au format " +
        '[{"player":"NomExact","text":"la pique en une ou deux phrases"}]. ' +
        "Un objet par joueur, en utilisant exactement les noms fournis.",
      messages: [
        {
          role: "user",
          content: buildPrompt(standings),
        },
      ],
    });

    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Strip ```json fences if present, then parse the JSON array.
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    let roasts: { player: string; text: string }[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) roasts = parsed;
    } catch {
      // If parsing fails, fall back to one block of text.
      roasts = [{ player: "", text: raw }];
    }

    return NextResponse.json({ roasts, generatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
