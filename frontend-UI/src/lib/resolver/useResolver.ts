import { useState } from "react";
import { resolveBatchV2, resolveSingleV2 } from "./client";
import type { BatchResolveV2Response, ResolveV2Response } from "./types";

export function useSingleResolver() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResolveV2Response | null>(null);

  const resolve = async (url: string) => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await resolveSingleV2(url);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Failed to resolve URL");
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, result, setResult, setError, resolve };
}

export function useBatchResolver() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BatchResolveV2Response | null>(null);

  const resolve = async (urls: string[]) => {
    if (!urls.length) return;
    setLoading(true);
    setError("");
    try {
      const data = await resolveBatchV2(urls);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Batch resolve failed");
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, result, setResult, setError, resolve };
}
