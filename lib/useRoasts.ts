"use client";

import { useQuery } from "@tanstack/react-query";

export type Roast = { player: string; text: string };

async function getRoasts(): Promise<{ roasts: Roast[]; generatedAt: string }> {
  const res = await fetch("/api/roast");
  if (!res.ok) throw new Error("Could not load roasts");
  return res.json();
}

export function useRoasts(enabled: boolean) {
  return useQuery({
    queryKey: ["roasts"],
    queryFn: getRoasts,
    enabled,
    staleTime: Infinity, // don't auto-regenerate; only on the button
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
