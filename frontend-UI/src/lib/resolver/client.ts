import type { BatchResolveV2Response, ResolveV2Response } from "./types";
import { apiFetch } from "@/lib/api";

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.error || "Request failed";
  } catch {
    return "Request failed";
  }
}

export async function resolveSingleV2(url: string): Promise<ResolveV2Response> {
  const response = await apiFetch("/api/resolve?v=2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function resolveBatchV2(urls: string[]): Promise<BatchResolveV2Response> {
  const response = await apiFetch("/api/resolve/batch?v=2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}
