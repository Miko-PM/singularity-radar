import { useState, useEffect, useCallback } from 'react';
import { ApiResponse } from '../types/index.ts';

export function useGet<T>(url: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const abort = new AbortController();

    setLoading(true);
    setError(null);

    fetch(url, { signal: abort.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ApiResponse<T>) => {
        if (json.error) throw new Error(json.error);
        if (!abort.signal.aborted) setData(json.data);
      })
      .catch(err => {
        if (!abort.signal.aborted && err.name !== 'AbortError') {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });

    return () => abort.abort();
  }, [url, ...deps, retry]);

  const refetch = useCallback(() => setRetry(c => c + 1), []);

  return { data, loading, error, refetch };
}

export function useArticles(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const url = `/api/articles${qs ? `?${qs}` : ''}`;
  return useGet<any>(url, [qs]);
}

export function useHotTopics() {
  return useGet<any[]>('/api/hot-topics');
}

export function useTags() {
  return useGet<any[]>('/api/tags');
}

export function useSources() {
  return useGet<any[]>('/api/sources');
}
