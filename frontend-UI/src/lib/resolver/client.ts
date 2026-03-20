import type { BatchResolveV2Response, ResolveV2Response } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.error || "Request failed";
  } catch {
    return "Request failed";
  }
}

export async function resolveSingleV2(url: string): Promise<ResolveV2Response> {
  const response = await fetch(`${API_BASE}/api/resolve?v=2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function resolveBatchV2(urls: string[]): Promise<BatchResolveV2Response> {
  const response = await fetch(`${API_BASE}/api/resolve/batch?v=2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}
