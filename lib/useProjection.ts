"use client";

import { useQuery } from "@tanstack/react-query";
import type { Projection } from "./projection";

async function getProjection(): Promise<Projection> {
  const res = await fetch("/api/projection");
  if (!res.ok) throw new Error("Could not load projection");
  return res.json();
}

export function useProjection() {
  return useQuery({ queryKey: ["projection"], queryFn: getProjection });
}
