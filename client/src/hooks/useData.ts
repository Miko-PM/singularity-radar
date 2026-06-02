import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiResponse } from '../types/index.ts';
import { API_BASE } from '../utils/api.ts';

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

export function useHotTopics() {
  return useGet<any[]>(`${API_BASE}/api/hot-topics`);
}

export function useTags() {
  return useGet<any[]>(`${API_BASE}/api/tags`);
}

export function useSources() {
  return useGet<any[]>(`${API_BASE}/api/sources`);
}

// ── 文章列表（支持分页加载更多）──

export function useArticles(params: Record<string, string>) {
  const [articles, setArticles] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [allLoaded, setAllLoaded] = useState(false);
  const pageRef = useRef(1);
  // 记录 params 签名，用于检测 filter 变化时重置
  const paramsSig = JSON.stringify(params);

  // params 变化 → 重置到第一页
  useEffect(() => {
    pageRef.current = 1;
    setArticles([]);
    setPagination(null);
    setAllLoaded(false);
  }, [paramsSig]);

  // 获取当前页
  useEffect(() => {
    const abort = new AbortController();
    const isLoadMore = pageRef.current > 1;

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    const qs = new URLSearchParams({ ...params, page: String(pageRef.current) }).toString();
    const url = `${API_BASE}/api/articles?${qs}`;

    fetch(url, { signal: abort.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ApiResponse<any[]>) => {
        if (json.error) throw new Error(json.error);
        if (!abort.signal.aborted) {
          setPagination(json.pagination);
          if (isLoadMore) {
            setArticles(prev => [...prev, ...(json.data || [])]);
          } else {
            setArticles(json.data || []);
          }
        }
      })
      .catch(err => {
        if (!abort.signal.aborted && err.name !== 'AbortError') {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => abort.abort();
  }, [paramsSig, retry]);

  const loadMore = useCallback(() => {
    if (pagination && pageRef.current < pagination.totalPages) {
      pageRef.current += 1;
      setRetry(r => r + 1);
    } else {
      setAllLoaded(true);
    }
  }, [pagination]);

  const hasMore = pagination ? pageRef.current < pagination.totalPages : false;

  const refetch = useCallback(() => {
    pageRef.current = 1;
    setArticles([]);
    setAllLoaded(false);
    setRetry(r => r + 1);
  }, []);

  return { articles, pagination, loading, loadingMore, error, hasMore, loadMore, refetch, allLoaded };
}
