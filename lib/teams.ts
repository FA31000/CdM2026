// Single source of truth for the Friends League: who owns which team.
// Teams are matched to ESPN results by their 3-letter FIFA code (e.g. "KSA").
// A team can have several owners — all of them score when it wins or draws.

export const PLAYERS = [
  "Franzou",
  "Marion",
  "Riton",
  "Jean-Marc",
  "Gustave",
  "Pierrick",
  "Nadir",
] as const;

export type Player = (typeof PLAYERS)[number];

export type Team = {
  code: string; // ESPN / FIFA abbreviation
  label: string; // French display name (as used in the group's Excel)
  owners: Player[];
};

export const TEAMS: Team[] = [
  // Franzou
  { code: "ESP", label: "Espagne", owners: ["Franzou"] },
  { code: "NOR", label: "Norvège", owners: ["Franzou"] },
  { code: "SEN", label: "Sénégal", owners: ["Franzou"] },
  { code: "SWE", label: "Suède", owners: ["Franzou"] },
  { code: "PAR", label: "Paraguay", owners: ["Franzou"] },
  { code: "TUN", label: "Tunisie", owners: ["Franzou"] },
  // Marion
  { code: "FRA", label: "France", owners: ["Marion"] },
  { code: "SUI", label: "Suisse", owners: ["Marion"] },
  { code: "CIV", label: "Côte d'Ivoire", owners: ["Marion"] },
  { code: "TUR", label: "Türkiye", owners: ["Marion"] },
  { code: "RSA", label: "Afrique du Sud", owners: ["Marion"] },
  { code: "PAN", label: "Panama", owners: ["Marion"] },
  // Riton
  { code: "POR", label: "Portugal", owners: ["Riton"] },
  { code: "BEL", label: "Belgique", owners: ["Riton"] },
  { code: "COL", label: "Colombie", owners: ["Riton"] },
  { code: "CZE", label: "Tchéquie", owners: ["Riton"] },
  { code: "GHA", label: "Ghana", owners: ["Riton"] },
  { code: "QAT", label: "Qatar", owners: ["Riton"] },
  // Jean-Marc
  { code: "ARG", label: "Argentine", owners: ["Jean-Marc"] },
  { code: "BRA", label: "Brésil", owners: ["Jean-Marc"] },
  { code: "KOR", label: "Corée du Sud", owners: ["Jean-Marc"] },
  { code: "ALG", label: "Algérie", owners: ["Jean-Marc"] },
  { code: "SCO", label: "Écosse", owners: ["Jean-Marc"] },
  { code: "UZB", label: "Ouzbékistan", owners: ["Jean-Marc"] },
  // Gustave
  { code: "NED", label: "Pays-Bas", owners: ["Gustave"] },
  { code: "CRO", label: "Croatie", owners: ["Gustave"] },
  { code: "EGY", label: "Égypte", owners: ["Gustave"] },
  { code: "URU", label: "Uruguay", owners: ["Gustave"] },
  { code: "AUS", label: "Australie", owners: ["Gustave"] },
  { code: "COD", label: "RD Congo", owners: ["Gustave"] },
  // Pierrick
  { code: "ENG", label: "Angleterre", owners: ["Pierrick"] },
  { code: "USA", label: "États-Unis", owners: ["Pierrick"] },
  { code: "MEX", label: "Mexique", owners: ["Pierrick"] },
  { code: "CAN", label: "Canada", owners: ["Pierrick"] },
  { code: "AUT", label: "Autriche", owners: ["Pierrick"] },
  { code: "BIH", label: "Bosnie-Herzégovine", owners: ["Pierrick"] },
  { code: "JOR", label: "Jordanie", owners: ["Pierrick"] },
  // Nadir
  { code: "GER", label: "Allemagne", owners: ["Nadir"] },
  { code: "JPN", label: "Japon", owners: ["Nadir"] },
  { code: "MAR", label: "Maroc", owners: ["Nadir"] },
  { code: "ECU", label: "Équateur", owners: ["Nadir"] },
  { code: "IRN", label: "Iran", owners: ["Nadir"] },
  { code: "NZL", label: "Nouvelle-Zélande", owners: ["Nadir"] },
  // Shared teams (owned by several players)
  { code: "KSA", label: "Arabie Saoudite", owners: ["Franzou", "Riton", "Gustave"] },
  { code: "CPV", label: "Cap-Vert", owners: ["Marion", "Jean-Marc", "Nadir"] },
];

// Fast lookup of a team (and its owners) by ESPN/FIFA code.
export const TEAM_BY_CODE: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.code, t]),
);

// Every team a given player owns.
export function teamsForPlayer(player: Player): Team[] {
  return TEAMS.filter((t) => t.owners.includes(player));
}
