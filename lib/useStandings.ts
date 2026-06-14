"use client";

import { useQuery } from "@tanstack/react-query";
import type { Standings } from "./standings";

async function getStandings(): Promise<Standings> {
  const res = await fetch("/api/standings");
  if (!res.ok) throw new Error("Could not load standings");
  return res.json();
}

export function useStandings() {
  return useQuery({ queryKey: ["standings"], queryFn: getStandings });
}
