import { useState, useMemo } from 'react';
import { TabType } from '../types/index.ts';
import { useArticles, useHotTopics } from '../hooks/useData.ts';
import ArticleCard from '../components/ArticleCard.tsx';
import Skeleton from '../components/Skeleton.tsx';
import EmptyState from '../components/EmptyState.tsx';
import HotTopicCard from '../components/HotTopicCard.tsx';

interface Props {
  tab: TabType;
  filter: string;
  tag: string;
  source: string;
  chineseOnly: boolean;
  onTagClick: (tag: string) => void;
}

export default function HomePage({ tab, filter, tag, source, chineseOnly, onTagClick }: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [timeRange, setTimeRange] = useState<'week' | 'all'>('week');

  const params: Record<string, string> = {};
  if (tab !== 'hot') params.tab = tab;
  if (filter !== 'latest') params.filter = filter;
  if (tag) params.tag = tag;
  if (source) params.source = source;
  if (chineseOnly) params.lang = 'zh';
  if (timeRange === 'week') params.days = '7';

  const { data: articlesData, loading, error, refetch } = useArticles(params);
  const { data: hotTopics, loading: topicsLoading } = useHotTopics();

  // 文章列表（所有 Tab 都需要 hooks 保持一致）
  const articles = articlesData || [];

  // Hero card: pick first article with hot_score >= 80 (in list mode only)
  const heroArticle = useMemo(() => {
    if (viewMode !== 'list') return null;
    return articles.find((a: any) => a.hot_score >= 80) || null;
  }, [articles, viewMode]);

  // List articles (excluding hero)
  const listArticles = useMemo(() => {
    if (!heroArticle) return articles;
    return articles.filter((a: any) => a.id !== heroArticle.id);
  }, [articles, heroArticle]);

  // 深度专题 Tab
  if (tab === 'deep') {
    return (
      <div>
        {/* Featured top card */}
        <FeaturedSection />

        {/* Hot topics list */}
        {topicsLoading ? (
          <Skeleton count={4} variant="compact" />
        ) : hotTopics && hotTopics.length > 0 ? (
          <div className="space-y-4">
            {hotTopics.map((topic: any) => (
              <HotTopicCard key={topic.id} topic={topic} onTagClick={onTagClick} />
            ))}
          </div>
        ) : (
          <EmptyState message="热门议题聚合中…" />
        )}
      </div>
    );
  }

  // 文章列表 Tab（deep tab 在上面已提前 return，不会走到这里）
  return (
    <div>
      {/* View toggle + time range */}
      <div className="flex items-center justify-between mb-4">
        {/* Time range filter */}
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg p-0.5">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1 rounded-md text-xs font-label transition-colors ${
              timeRange === 'week'
                ? 'bg-[var(--gold-bg)]/15 text-[var(--gold)] border border-[var(--gold)]/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            近1周
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1 rounded-md text-xs font-label transition-colors ${
              timeRange === 'all'
                ? 'bg-[var(--gold-bg)]/15 text-[var(--gold)] border border-[var(--gold)]/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            全部
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-md text-xs font-label transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--gold-bg)]/15 text-[var(--gold)] border border-[var(--gold)]/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            列表
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-md text-xs font-label transition-colors ${
              viewMode === 'grid'
                ? 'bg-[var(--gold-bg)]/15 text-[var(--gold)] border border-[var(--gold)]/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            卡片
          </button>
        </div>
      </div>

      {loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6' : ''}>
          <Skeleton count={viewMode === 'grid' ? 9 : 5} variant={viewMode === 'grid' ? 'default' : 'compact'} />
        </div>
      ) : error ? (
        <EmptyState message="加载失败" onRetry={refetch} />
      ) : listArticles.length === 0 ? (
        <EmptyState message="暂无内容，雷达扫描中…" />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {articles.map((article: any) => (
            <ArticleCard key={article.id} article={article} onTagClick={onTagClick} layout="vertical" />
          ))}
        </div>
      ) : (
        <div className="w-full">
          {/* Hero card */}
          {heroArticle && (
            <ArticleCard article={heroArticle} onTagClick={onTagClick} variant="hero" />
          )}
          {/* Rest of articles in horizontal layout */}
          {listArticles.map((article: any) => (
            <ArticleCard key={article.id} article={article} onTagClick={onTagClick} layout="horizontal" />
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedSection() {
  const { data: featured, loading } = useArticles({ filter: 'hot', limit: '1' });

  if (loading) return null;

  const articles = featured || [];
  if (articles.length === 0) return null;

  const top = articles[0];
  if (!top) return null;

  return (
    <div className="mb-8">
      <h2 className="font-label text-xs text-[var(--text-dim)] tracking-wider uppercase mb-3">Featured Intel</h2>
      <ArticleCard article={top} onTagClick={() => {}} />
    </div>
  );
}
