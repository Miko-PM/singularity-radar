import { useState, useEffect, useMemo } from 'react';
import { getToken, setToken, clearToken, API_BASE } from '../utils/api.ts';
import { useTags } from '../hooks/useData.ts';
import { Article } from '../types/index.ts';
import { timeAgo, heatToColor } from '../utils/index.ts';

interface Props {
  onBack: () => void;
}

// ── 预览卡片组件 ──
function PreviewCard({ title, summary, imageUrl, tags, category }: {
  title: string;
  summary: string;
  imageUrl: string;
  tags: string[];
  category: string;
}) {
  const hasImage = !!imageUrl;
  return (
    <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden transition-all duration-300 max-w-md mx-auto">
      {hasImage && (
        <div className="relative h-32 overflow-hidden bg-[var(--bg-secondary)]">
          <img
            src={imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover brightness-75 contrast-125 grayscale-[20%]"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <span className="absolute top-2 left-2 font-label text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-[var(--text-secondary)] backdrop-blur-sm border border-white/10">
            {category || '未分类'}
          </span>
        </div>
      )}
      <div className="p-4">
        <h3 className="font-headline text-base leading-snug text-[var(--text-primary)] line-clamp-2">
          {title || '标题预览'}
        </h3>
        {summary && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
            {summary}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.slice(0, 3).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded-full bg-[var(--gold-bg)]/8 text-[var(--gold)]/80 text-[10px] border border-[var(--gold)]/15 font-label">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-primary)]">
          <span className="font-label text-xs text-[var(--text-dim)]">
            via 预览
          </span>
          <span className="font-label text-[10px] text-[var(--text-dim)]">
            刚刚
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage({ onBack }: Props) {
  const [token, setTokenState] = useState(getToken() || '');
  const [authenticated, setAuthenticated] = useState(!!getToken());
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('news');
  const [imageUrl, setImageUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Edit mode
  const [editId, setEditId] = useState<number | null>(null);
  const [articleList, setArticleList] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { data: tags } = useTags();

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Computed validation ──
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = '标题不能为空';
    if (!url.trim()) e.url = '原文链接不能为空';
    else if (!/^https?:\/\/.+/.test(url.trim())) e.url = 'URL 格式不正确，需以 http:// 或 https:// 开头';
    if (!summary.trim()) e.summary = '摘要不能为空';
    if (imageUrl.trim() && !/^https?:\/\/.+/.test(imageUrl.trim())) e.imageUrl = '配图 URL 格式不正确';
    return e;
  }, [title, url, summary, imageUrl]);

  const isValid = Object.keys(errors).length === 0;

  // ── Effect: fetch stats + articles on login ──
  useEffect(() => {
    if (authenticated) {
      fetchStats();
      fetchArticles();
    }
  }, [authenticated]);

  // ── API calls ──
  async function fetchStats() {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.data) setStats(json.data);
    } catch {} finally {
      setStatsLoading(false);
    }
  }

  async function fetchArticles() {
    setLoadingArticles(true);
    try {
      const res = await fetch(`${API_BASE}/api/articles?source=admin_post&limit=50`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.data) setArticleList(json.data);
    } catch {} finally {
      setLoadingArticles(false);
    }
  }

  // ── Auth ──
  async function handleLogin() {
    if (locked) return;
    if (token.length < 4) return;
    // 先调后端验证 Token
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          setLocked(true);
          setResult('认证失败 3 次，请刷新页面重试');
        } else {
          setResult(`Token 错误（${newAttempts}/3）`);
        }
        return;
      }
      const json = await res.json();
      if (!json.data) {
        setResult('验证失败：未知错误');
        return;
      }
    } catch (err: any) {
      setResult(`网络错误：${err.message}`);
      return;
    }
    setResult(null);
    setToken(token);
    setAuthenticated(true);
    setAttempts(0);
  }

  function handleLogout() {
    clearToken();
    setTokenState('');
    setAuthenticated(false);
    setEditId(null);
  }

  // ── Form handlers ──
  function resetForm() {
    setTitle('');
    setUrl('');
    setSummary('');
    setImageUrl('');
    setTagInput('');
    setIsFeatured(false);
    setIsPinned(false);
    setEditId(null);
    setTouched({});
    setResult(null);
  }

  function loadArticle(article: Article) {
    setEditId(article.id);
    setTitle(article.title || '');
    setUrl(article.url || '');
    setSummary(article.summary || '');
    setImageUrl(article.image_url || '');
    setCategory(article.category || 'news');
    setTagInput((article.tags || []).join(', '));
    setIsFeatured(article.is_featured);
    setIsPinned(article.is_pinned || false);
    setTouched({});
    setResult(null);
    // 滚动到表单
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBlur(field: string) {
    setTouched(prev => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 标记所有字段为 touched
    setTouched({ title: true, url: true, summary: true, imageUrl: true });
    if (!isValid) return;

    setSubmitting(true);
    setResult(null);

    try {
      const method = editId ? 'PATCH' : 'POST';
      const path = editId ? `${API_BASE}/api/admin/articles/${editId}` : `${API_BASE}/api/admin/articles`;

      const res = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          summary: summary.trim(),
          category,
          image_url: imageUrl.trim() || undefined,
          tags: tagInput.split(',').map(t => t.trim()).filter(Boolean),
          is_featured: isFeatured,
          is_pinned: isPinned,
        }),
      });

      const json = await res.json();

      if (res.status === 403) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          setLocked(true);
          handleLogout();
          setResult('认证失败 3 次，请刷新页面重试');
        } else {
          setResult(`Token 错误（${newAttempts}/3）`);
        }
        return;
      }

      if (json.error) {
        if (res.status === 409) setResult('失败：URL 与其他文章冲突');
        else setResult(`失败：${json.error}`);
      } else {
        setResult(editId ? '更新成功！' : '发布成功！');
        resetForm();
        fetchStats();
        fetchArticles();
      }
    } catch (err: any) {
      setResult(`网络错误：${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Admin actions ──
  async function handleRetag() {
    if (!confirm('确定全量重新打标签？')) return;
    setResult('重新打标签中…');
    try {
      const res = await fetch(`${API_BASE}/api/admin/retag`, {
        method: 'POST', headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setResult(json.data ? `已重新打标签：${json.data.retagged} 条` : `失败：${json.error}`);
    } catch (err: any) { setResult(`错误：${err.message}`); }
  }

  async function handleFetch() {
    setResult('手动抓取中…');
    try {
      const res = await fetch(`${API_BASE}/api/admin/fetch`, {
        method: 'POST', headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.data) {
        const total = json.data.reduce((s: number, r: any) => s + r.newCount, 0);
        setResult(`抓取完成，新增 ${total} 条`);
      } else { setResult(`失败：${json.error}`); }
    } catch (err: any) { setResult(`错误：${err.message}`); }
  }

  async function handleReheat() {
    setResult('重算热度中…');
    try {
      const res = await fetch(`${API_BASE}/api/admin/reheat`, {
        method: 'POST', headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.data) { setResult(`热度重算完成：${json.data.rescored} 条`); }
      else { setResult(`失败：${json.error}`); }
    } catch (err: any) { setResult(`错误：${err.message}`); }
  }

  // ── Render: Tag helper ──
  const tagList = useMemo(() => tagInput.split(',').map(t => t.trim()).filter(Boolean), [tagInput]);

  // ── Login screen ──
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <button onClick={onBack} className="font-label text-xs text-[var(--text-muted)] hover:text-white mb-8 transition-colors">
            ← 返回首页
          </button>
          <h1 className="font-headline text-2xl text-[var(--gold)] mb-2">管理员登录</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6 font-label">请输入管理员 Token</p>
          {locked && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-xs font-label">
              认证失败 3 次，请刷新页面重试
            </div>
          )}
          <input
            type="password" value={token}
            onChange={(e) => setTokenState(e.target.value)}
            placeholder="输入 Token…"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)]/40 transition-colors font-label"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin} disabled={locked || token.length < 4}
            className="w-full mt-3 py-2.5 bg-[var(--gold-bg)]/10 border border-[var(--gold)]/20 text-[var(--gold)] rounded-lg text-sm font-label hover:bg-[var(--gold-bg)]/15 transition-colors disabled:opacity-40">
            确认
          </button>
          {result && (
            <div className="mt-3 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-xs font-label">
              {result}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Admin panel ──
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="h-16 border-b border-[var(--border-primary)] flex items-center justify-between px-4 md:px-8">
        <button onClick={onBack} className="font-label text-xs text-[var(--text-muted)] hover:text-white transition-colors">← 返回首页</button>
        <h1 className="font-label text-sm text-[var(--gold)]">管理员面板</h1>
        <button onClick={handleLogout} className="font-label text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors">退出</button>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            {[
              { label: '总文章', value: stats.total_articles },
              { label: '24h 新增', value: stats.articles_24h },
              { label: '标签数', value: stats.total_tags },
              { label: '热门议题', value: stats.total_topics },
              { label: '数据源', value: stats.active_sources },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-3 text-center">
                <p className="font-label text-lg text-[var(--gold)]">{s.value}</p>
                <p className="font-label text-[10px] text-[var(--text-dim)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mb-8 flex-wrap">
          <button onClick={handleFetch} className="font-label text-xs px-4 py-2 rounded-lg bg-[var(--gold-bg)]/10 border border-[var(--gold)]/20 text-[var(--gold)] hover:bg-[var(--gold-bg)]/15 transition-colors">手动抓取</button>
          <button onClick={handleRetag} className="font-label text-xs px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-white transition-colors">全量重打标签</button>
          <button onClick={handleReheat} className="font-label text-xs px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-white transition-colors">重算热度</button>
        </div>

        {/* Result feedback */}
        {result && (
          <div className={`mb-6 p-3 rounded-lg border text-sm font-label ${
            result.includes('成功') || result.includes('完成')
              ? 'bg-green-900/20 border-green-500/30 text-green-300'
              : 'bg-red-900/20 border-red-500/30 text-red-300'
          }`}>{result}</div>
        )}

        {/* Edit / Create form */}
        <form onSubmit={handleSubmit} className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-label text-xs text-[var(--text-secondary)] tracking-wider uppercase">
              {editId ? '编辑爆料' : '录入爆料'}
            </h2>
            {editId && (
              <button type="button" onClick={resetForm}
                className="font-label text-xs text-[var(--text-muted)] hover:text-white transition-colors">
                取消编辑
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="font-label text-[11px] text-[var(--text-muted)] block mb-1">标题 *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => handleBlur('title')}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                placeholder="文章标题" required />
              {touched.title && errors.title && <p className="text-red-400 text-[11px] mt-1 font-label">{errors.title}</p>}
            </div>

            {/* URL */}
            <div>
              <label className="font-label text-[11px] text-[var(--text-muted)] block mb-1">原文链接 *</label>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => handleBlur('url')}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                placeholder="https://" required />
              {touched.url && errors.url && <p className="text-red-400 text-[11px] mt-1 font-label">{errors.url}</p>}
            </div>

            {/* Summary */}
            <div>
              <label className="font-label text-[11px] text-[var(--text-muted)] block mb-1">摘要 *</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => handleBlur('summary')}
                rows={3}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)]/40 transition-colors resize-none"
                placeholder="简要描述…" required />
              {touched.summary && errors.summary && <p className="text-red-400 text-[11px] mt-1 font-label">{errors.summary}</p>}
            </div>

            {/* Category + Image */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-label text-[11px] text-[var(--text-muted)] block mb-1">分类</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/40 transition-colors">
                  <option value="opensource">GitHub 热榜</option>
                  <option value="paper">论文速递</option>
                  <option value="news">资讯</option>
                  <option value="podcast">播客</option>
                </select>
              </div>
              <div>
                <label className="font-label text-[11px] text-[var(--text-muted)] block mb-1">配图 URL</label>
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onBlur={() => handleBlur('imageUrl')}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                  placeholder="https://" />
                {touched.imageUrl && errors.imageUrl && <p className="text-red-400 text-[11px] mt-1 font-label">{errors.imageUrl}</p>}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="font-label text-[11px] text-[var(--text-muted)] block mb-1">标签（逗号分隔）</label>
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)]/40 transition-colors"
                placeholder="LLM, Agent, 开源" />
            </div>

            {/* Checkboxes */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="accent-[var(--gold)]" />
                <span className="font-label text-[11px] text-[var(--text-secondary)]">精选（Featured）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="accent-[var(--gold)]" />
                <span className="font-label text-[11px] text-[var(--text-secondary)]">置顶（3天固定99°C）</span>
              </label>
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="mt-5 w-full py-2.5 bg-[var(--gold-bg)]/10 border border-[var(--gold)]/20 text-[var(--gold)] rounded-lg text-sm font-label hover:bg-[var(--gold-bg)]/15 transition-colors disabled:opacity-40">
            {submitting ? '提交中…' : editId ? '更新' : '发布'}
          </button>
        </form>

        {/* V1.1: Preview card */}
        {(title || summary || imageUrl || tagInput) && (
          <div className="mt-6">
            <h3 className="font-label text-xs text-[var(--text-secondary)] tracking-wider uppercase mb-3">卡片预览</h3>
            <PreviewCard
              title={title}
              summary={summary}
              imageUrl={imageUrl}
              tags={tagList}
              category={category}
            />
          </div>
        )}

        {/* V1.1: Article list with edit */}
        <div className="mt-8">
          <h2 className="font-label text-xs text-[var(--text-secondary)] tracking-wider uppercase mb-3">历史爆料</h2>
          {loadingArticles ? (
            <p className="text-sm text-[var(--text-dim)]">加载中…</p>
          ) : articleList.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">暂无爆料记录</p>
          ) : (
            <div className="space-y-2">
              {articleList.map((article) => (
                <div key={article.id}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)] truncate">{article.title}</p>
                    <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                      {timeAgo(article.published_at)} · {article.hot_score}°C
                    </p>
                  </div>
                  <button onClick={() => loadArticle(article)}
                    className="shrink-0 font-label text-xs px-3 py-1.5 rounded-lg bg-[var(--gold-bg)]/10 border border-[var(--gold)]/20 text-[var(--gold)] hover:bg-[var(--gold-bg)]/15 transition-colors">
                    编辑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags overview */}
        {tags && tags.length > 0 && (
          <div className="mt-8">
            <h2 className="font-label text-xs text-[var(--text-secondary)] tracking-wider uppercase mb-3">标签概览</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: any) => (
                <span key={tag.id} className="font-label text-xs px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-secondary)]">
                  #{tag.name} ({tag.article_count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
