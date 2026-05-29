import { TabType } from '../types/index.ts';
import { API_BASE } from '../utils/api.ts';
import { useState, useEffect } from 'react';

interface Props {
  activeTab: TabType;
  activeFilter: string;
  onTabChange: (tab: TabType) => void;
  onFilterChange: (filter: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  selectedTag: string;
  onClearTag: () => void;
  activeSource: string;
  onSourceChange: (source: string) => void;
  chineseOnly: boolean;
  onChineseOnlyChange: (v: boolean) => void;
  sources: any[];
  tags: any[];
  onTagClick: (tag: string) => void;
}

const tabs: { key: TabType; label: string; icon: string }[] = [
  { key: 'hot', label: '今日热点', icon: '◎' },
  { key: 'tools', label: '工具榜', icon: '⚙' },
  { key: 'people', label: '人物动态', icon: '◈' },
  { key: 'deep', label: '深度专题', icon: '◆' },
];

export default function Sidebar({
  activeTab, activeFilter, onTabChange, onFilterChange,
  mobileOpen, onMobileClose,
  selectedTag, onClearTag,
  activeSource, onSourceChange,
  chineseOnly, onChineseOnlyChange,
  sources, tags, onTagClick,
}: Props) {
  // 检查是否有编辑精选文章（决定是否显示该筛选按钮）
  const [hasFeatured, setHasFeatured] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`${API_BASE}/api/articles?filter=featured&limit=1`, { signal: abort.signal })
      .then(r => r.json())
      .then(d => { if (!abort.signal.aborted) setHasFeatured((d.data || []).length > 0); })
      .catch(() => {});
    return () => abort.abort();
  }, []);

  // 获取每个数据源的文章数（从已获取的 sources 中取）
  // 按 category 分组，仅有一个源时不显示 category 筛选
  const sourceCategories = new Map<string, any[]>();

  // Tab 到 category 的映射（仅显示当前 Tab 相关的数据源）
  const tabCategoryFilter: Record<string, string[]> = {
    hot: [],
    tools: ['opensource'],
    people: ['podcast'],
    deep: [], // 深度专题不需要数据源
  };
  const allowedCategories = tabCategoryFilter[activeTab] || [];

  for (const s of sources) {
    // 隐藏无数据或未启用的数据源
    const count = parseInt(s.article_count || '0', 10);
    if (count === 0 || !s.enabled) continue;
    // 按 Tab 过滤
    const cat = s.category || 'other';
    if (allowedCategories.length > 0 && !allowedCategories.includes(cat)) continue;
    if (!sourceCategories.has(cat)) sourceCategories.set(cat, []);
    sourceCategories.get(cat)!.push(s);
  }

  const hasActiveFilter = selectedTag || activeSource;

  const content = (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Tab Navigation */}
      <nav className="flex-shrink-0 px-3 pt-6 pb-2 space-y-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { onTabChange(tab.key); onMobileClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 font-label
              ${activeTab === tab.key
                ? 'bg-[var(--gold-bg)]/10 text-[var(--gold)] border border-[var(--gold)]/20'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border border-transparent'
              }`}
          >
            <span className="w-5 text-center">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Scrollable filter area */}
      <div className="flex-1 overflow-y-auto px-3">
        {/* 中文筛选（所有 Tab 均可用，默认选中） */}
        <div className="py-3 border-t border-[var(--border-primary)]">
            <p className="font-label text-[10px] text-[var(--text-dim)] tracking-wider uppercase px-3 mb-2">语言</p>
            <button
              onClick={() => onChineseOnlyChange(!chineseOnly)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all font-label border
                ${chineseOnly
                  ? 'bg-[var(--gold-bg)]/10 text-[var(--gold)] border-[var(--gold)]/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:bg-[var(--bg-secondary)]'
                }`}
            >
              <span>{chineseOnly ? '✓' : '○'}</span>
              仅展示中文
            </button>
          </div>

        {/* 筛选按钮 */}
        {!hasActiveFilter && (
          <div className="py-3 border-t border-[var(--border-primary)]">
            <p className="font-label text-[10px] text-[var(--text-dim)] tracking-wider uppercase px-3 mb-2">排序</p>
            <div className="space-y-1">
              <button
                onClick={() => onFilterChange('latest')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-200 font-label border
                  ${activeFilter === 'latest'
                    ? 'bg-[var(--gold-bg)]/10 text-[var(--gold)] border-[var(--gold)]/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:bg-[var(--bg-secondary)]'
                  }`}
              >
                最新情报
              </button>
              <button
                onClick={() => onFilterChange('hot')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-200 font-label border
                  ${activeFilter === 'hot'
                    ? 'bg-[var(--gold-bg)]/10 text-[var(--gold)] border-[var(--gold)]/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:bg-[var(--bg-secondary)]'
                  }`}
              >
                高热爆料
              </button>
              {hasFeatured && (
                <button
                  onClick={() => onFilterChange('featured')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-200 font-label border
                    ${activeFilter === 'featured'
                      ? 'bg-[var(--gold-bg)]/10 text-[var(--gold)] border-[var(--gold)]/20'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:bg-[var(--bg-secondary)]'
                    }`}
                >
                  编辑精选
                </button>
              )}
            </div>
          </div>
        )}

        {/* 清除筛选 */}
        {hasActiveFilter && (
          <div className="py-3 border-t border-[var(--border-primary)]">
            <button
              onClick={() => { onClearTag(); onSourceChange(''); }}
              className="w-full text-xs text-[var(--gold)] font-label px-3 py-2 rounded-lg border border-[var(--gold)]/20 hover:bg-[var(--gold-bg)]/5 transition-colors"
            >
              清除筛选
            </button>
          </div>
        )}

        {/* 数据源筛选 - 按分类分组显示（仅显示当前 Tab 相关且有数据的数据源） */}
        {sourceCategories.size > 0 && (
          <div className="py-3 border-t border-[var(--border-primary)]">
            <p className="font-label text-[10px] text-[var(--text-dim)] tracking-wider uppercase px-3 mb-2">数据源</p>
            <div className="space-y-1">
              {Array.from(sourceCategories.entries()).map(([cat, srcs]) => (
                <div key={cat}>
                  {srcs.length > 1 && (
                    <p className="font-label text-[9px] text-[var(--text-dark)] uppercase tracking-wider px-3 mt-2 mb-1">
                      {cat === 'opensource' ? '开源' : cat === 'paper' ? '论文' : cat === 'news' ? '资讯' : cat === 'podcast' ? '播客' : cat}
                    </p>
                  )}
                  {srcs.map(s => (
                    <button
                      key={s.slug}
                      onClick={() => onSourceChange(activeSource === s.slug ? '' : s.slug)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all font-label border
                        ${activeSource === s.slug
                          ? 'bg-[var(--blue-bg)]/10 text-[var(--blue)] border-[var(--blue-dark)]/30'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent hover:bg-[var(--bg-secondary)]'
                        }`}
                    >
                      <span className="w-4 text-center text-[9px]">▸</span>
                      {s.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 标签筛选 */}
        {tags.length > 0 && (
          <div className="py-3 border-t border-[var(--border-primary)]">
            <p className="font-label text-[10px] text-[var(--text-dim)] tracking-wider uppercase px-3 mb-2">热门标签</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 20).map((t: any) => (
                <button
                  key={t.name}
                  onClick={() => onTagClick(t.name)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-label transition-all border
                    ${selectedTag === t.name
                      ? 'bg-[var(--gold-bg)]/15 text-[var(--gold)] border-[var(--gold)]/30'
                      : 'bg-transparent text-[var(--text-muted)] border-[var(--border-secondary)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)]/80'
                    }`}
                >
                  #{t.name}
                  {t.article_count != null && (
                    <span className="ml-1 text-[10px] text-[var(--text-dim)]">{t.article_count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--border-primary)]">
        <p className="font-label text-[10px] text-[var(--text-dark)]">
          © 2025 Singularity Radar
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:block w-64 xl:w-72 2xl:w-80 flex-shrink-0 self-start sticky top-16 h-[calc(100vh-4rem)] border-r border-[var(--border-primary)] bg-[var(--bg-primary)]">
        {content}
      </aside>

      {/* Mobile */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[var(--bg-primary)] border-r border-[var(--border-primary)] transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </aside>
    </>
  );
}
