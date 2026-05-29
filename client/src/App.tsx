import { useState, useEffect } from 'react';
import { TabType } from './types/index.ts';
import { API_BASE } from './utils/api.ts';
import Sidebar from './components/Sidebar.tsx';
import HomePage from './pages/HomePage.tsx';
import AdminPage from './pages/AdminPage.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('hot');
  const [activeFilter, setActiveFilter] = useState<string>('hot');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [activeSource, setActiveSource] = useState<string>('');
  const [chineseOnly, setChineseOnly] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch sources & tags for sidebar
  const [sources, setSources] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`${API_BASE}/api/sources`, { signal: abort.signal })
      .then(r => r.json()).then(d => { if (!abort.signal.aborted) setSources(d.data || []); })
      .catch(() => {});
    fetch(`${API_BASE}/api/tags`, { signal: abort.signal })
      .then(r => r.json()).then(d => { if (!abort.signal.aborted) setTags(d.data || []); })
      .catch(() => {});
    return () => abort.abort();
  }, []);

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag === selectedTag ? '' : tag);
  };

  if (showAdmin) {
    return <AdminPage onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Full-width header */}
      <header className="h-16 sticky top-0 z-50 bg-[var(--bg-primary)]/90 backdrop-blur-md border-b border-[var(--border-primary)] flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger */}
          <button
            className="md:hidden text-[var(--text-primary)] p-2 -ml-2 shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>

          {/* Desktop brand — spans full width, above sidebar */}
          <div className="hidden md:flex items-baseline gap-3">
            <h1 className="font-headline text-xl md:text-2xl not-italic font-bold bg-gradient-to-r from-[var(--gold)] via-[var(--gold-gradient-2)] to-[var(--gold-gradient-3)] bg-clip-text text-transparent tracking-wider">
              Singularity Radar
            </h1>
            <span className="font-label text-xs text-[var(--gold-bright)]/70 tracking-[0.15em]">
              · 奇点雷达
            </span>
          </div>

          {/* Mobile title */}
          <span className="md:hidden font-label text-sm text-[var(--gold)] truncate">
            {activeTab === 'hot' ? '今日热点' : activeTab === 'tools' ? '工具榜' : activeTab === 'people' ? '人物动态' : '深度专题'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="shrink-0 font-label text-xs text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors p-1.5 rounded-lg border border-[var(--border-secondary)] hover:border-[var(--gold)]/40"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setShowAdmin(true)}
            className="shrink-0 font-label text-xs text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors px-4 py-1.5 rounded-lg border border-[var(--border-secondary)] hover:border-[var(--gold)]/40"
          >
            我要爆料
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          activeFilter={activeFilter}
          onTabChange={(tab) => { setActiveTab(tab); setMobileMenuOpen(false); }}
          onFilterChange={setActiveFilter}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          selectedTag={selectedTag}
          onClearTag={() => setSelectedTag('')}
          activeSource={activeSource}
          onSourceChange={setActiveSource}
          chineseOnly={chineseOnly}
          onChineseOnlyChange={setChineseOnly}
          sources={sources}
          tags={tags}
          onTagClick={handleTagClick}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-6xl 2xl:max-w-7xl p-4 md:p-8">
            {(selectedTag || activeSource) && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-[var(--text-secondary)]">筛选：</span>
                {selectedTag && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold-bg)]/10 text-[var(--gold)] text-xs border border-[var(--gold)]/30">
                    #{selectedTag}
                  </span>
                )}
                {activeSource && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--blue-bg)]/20 text-[var(--blue)] text-xs border border-[var(--blue-dark)]/30">
                    {activeSource}
                  </span>
                )}
                <button
                  onClick={() => { setSelectedTag(''); setActiveSource(''); }}
                  className="text-xs text-[var(--text-muted)] hover:text-white transition-colors ml-1"
                >
                  清除全部
                </button>
              </div>
            )}

            <HomePage
              tab={activeTab}
              filter={activeFilter}
              tag={selectedTag}
              source={activeSource}
              chineseOnly={chineseOnly}
              onTagClick={handleTagClick}
            />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] py-6 px-4 md:px-8 text-center">
        <p className="text-xs text-[var(--text-dim)] font-label">
          Singularity Radar · 奇点雷达
        </p>
        <p className="text-xs text-[var(--text-dark)] mt-1">
          本站为个人学习项目，数据源版权归原作者所有，如有侵权请联系删除
          <br />
          邮箱：<a href="mailto:mikogao@qq.com" className="text-[var(--gold)]/60 hover:text-[var(--gold)]">mikogao@qq.com</a>
        </p>
      </footer>
    </div>
  );
}
