import { useState, useEffect } from 'react';
import { getToken, setToken, clearToken, API_BASE } from '../utils/api.ts';
import { useTags } from '../hooks/useData.ts';

interface Props {
  onBack: () => void;
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

  const { data: tags } = useTags();

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (authenticated) fetchStats();
  }, [authenticated]);

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

  function handleLogin() {
    if (locked) return;
    if (token.length < 4) return;

    // 不直接校验，请求会返回 403
    setToken(token);
    setAuthenticated(true);
    setAttempts(0);
  }

  function handleLogout() {
    clearToken();
    setTokenState('');
    setAuthenticated(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !url) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title,
          url,
          summary,
          category,
          image_url: imageUrl || undefined,
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
        setResult(`失败：${json.error}`);
      } else {
        setResult('发布成功！');
        setTitle('');
        setUrl('');
        setSummary('');
        setImageUrl('');
        setTagInput('');
        setIsFeatured(false);
        setIsPinned(false);
        fetchStats();
      }
    } catch (err: any) {
      setResult(`网络错误：${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetag() {
    if (!confirm('确定全量重新打标签？')) return;
    setResult('重新打标签中…');
    try {
      const res = await fetch(`${API_BASE}/api/admin/retag`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setResult(json.data ? `已重新打标签：${json.data.retagged} 条` : `失败：${json.error}`);
    } catch (err: any) {
      setResult(`错误：${err.message}`);
    }
  }

  async function handleFetch() {
    setResult('手动抓取中…');
    try {
      const res = await fetch(`${API_BASE}/api/admin/fetch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.data) {
        const total = json.data.reduce((s: number, r: any) => s + r.newCount, 0);
        setResult(`抓取完成，新增 ${total} 条`);
      } else {
        setResult(`失败：${json.error}`);
      }
    } catch (err: any) {
      setResult(`错误：${err.message}`);
    }
  }

  async function handleReheat() {
    setResult('重算热度中…');
    try {
      const res = await fetch(`${API_BASE}/api/admin/reheat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.data) {
        setResult(`热度重算完成：${json.data.rescored} 条`);
      } else {
        setResult(`失败：${json.error}`);
      }
    } catch (err: any) {
      setResult(`错误：${err.message}`);
    }
  }

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <button onClick={onBack} className="font-label text-xs text-[#666] hover:text-white mb-8 transition-colors">
            ← 返回首页
          </button>

          <h1 className="font-headline text-2xl text-[#d4af37] mb-2">管理员登录</h1>
          <p className="text-sm text-[#666] mb-6 font-label">
            请输入管理员 Token
          </p>

          {locked && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-xs font-label">
              认证失败 3 次，请刷新页面重试
            </div>
          )}

          <input
            type="password"
            value={token}
            onChange={(e) => setTokenState(e.target.value)}
            placeholder="输入 Token…"
            className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-[#ececeb] placeholder-[#555] focus:outline-none focus:border-[#d4af37]/40 transition-colors font-label"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            onClick={handleLogin}
            disabled={locked || token.length < 4}
            className="w-full mt-3 py-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] rounded-lg text-sm font-label hover:bg-[#d4af37]/15 transition-colors disabled:opacity-40"
          >
            确认
          </button>
        </div>
      </div>
    );
  }

  // Admin panel
  return (
    <div className="min-h-screen bg-[#0c0c0c]">
      {/* Header */}
      <header className="h-16 border-b border-[#222] flex items-center justify-between px-4 md:px-8">
        <button onClick={onBack} className="font-label text-xs text-[#666] hover:text-white transition-colors">
          ← 返回首页
        </button>
        <h1 className="font-label text-sm text-[#d4af37]">管理员面板</h1>
        <button onClick={handleLogout} className="font-label text-xs text-[#666] hover:text-red-400 transition-colors">
          退出
        </button>
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
              <div key={s.label} className="bg-[#0e0e0e] border border-[#222] rounded-xl p-3 text-center">
                <p className="font-label text-lg text-[#d4af37]">{s.value}</p>
                <p className="font-label text-[10px] text-[#555] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mb-8 flex-wrap">
          <button onClick={handleFetch} className="font-label text-xs px-4 py-2 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/15 transition-colors">
            手动抓取
          </button>
          <button onClick={handleRetag} className="font-label text-xs px-4 py-2 rounded-lg bg-[#111] border border-[#333] text-[#888] hover:text-white transition-colors">
            全量重打标签
          </button>
          <button onClick={handleReheat} className="font-label text-xs px-4 py-2 rounded-lg bg-[#111] border border-[#333] text-[#888] hover:text-white transition-colors">
            重算热度
          </button>
        </div>

        {/* Result feedback */}
        {result && (
          <div className={`mb-6 p-3 rounded-lg border text-sm font-label ${
            result.includes('成功') || result.includes('完成')
              ? 'bg-green-900/20 border-green-500/30 text-green-300'
              : 'bg-red-900/20 border-red-500/30 text-red-300'
          }`}>
            {result}
          </div>
        )}

        {/* Submit form */}
        <form onSubmit={handleSubmit} className="bg-[#0e0e0e] border border-[#222] rounded-2xl p-5 md:p-6">
          <h2 className="font-label text-xs text-[#888] tracking-wider uppercase mb-4">录入爆料</h2>

          <div className="space-y-4">
            <div>
              <label className="font-label text-[11px] text-[#666] block mb-1">标题 *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ececeb] placeholder-[#555] focus:outline-none focus:border-[#d4af37]/40 transition-colors"
                placeholder="文章标题"
                required
              />
            </div>

            <div>
              <label className="font-label text-[11px] text-[#666] block mb-1">原文链接 *</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ececeb] placeholder-[#555] focus:outline-none focus:border-[#d4af37]/40 transition-colors"
                placeholder="https://"
                required
              />
            </div>

            <div>
              <label className="font-label text-[11px] text-[#666] block mb-1">摘要</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ececeb] placeholder-[#555] focus:outline-none focus:border-[#d4af37]/40 transition-colors resize-none"
                placeholder="简要描述…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-label text-[11px] text-[#666] block mb-1">分类</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ececeb] focus:outline-none focus:border-[#d4af37]/40 transition-colors"
                >
                  <option value="opensource">GitHub 热榜</option>
                  <option value="paper">论文速递</option>
                  <option value="news">资讯</option>
                  <option value="podcast">播客</option>
                </select>
              </div>

              <div>
                <label className="font-label text-[11px] text-[#666] block mb-1">配图 URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ececeb] placeholder-[#555] focus:outline-none focus:border-[#d4af37]/40 transition-colors"
                  placeholder="https://"
                />
              </div>
            </div>

            <div>
              <label className="font-label text-[11px] text-[#666] block mb-1">标签（逗号分隔）</label>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ececeb] placeholder-[#555] focus:outline-none focus:border-[#d4af37]/40 transition-colors"
                placeholder="LLM, Agent, 开源"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="accent-[#d4af37]"
                />
                <span className="font-label text-[11px] text-[#888]">精选（Featured）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="accent-[#d4af37]"
                />
                <span className="font-label text-[11px] text-[#888]">置顶（3天固定99°C）</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !title || !url}
            className="mt-5 w-full py-2.5 bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] rounded-lg text-sm font-label hover:bg-[#d4af37]/15 transition-colors disabled:opacity-40"
          >
            {submitting ? '提交中…' : '发布'}
          </button>
        </form>

        {/* Tags overview */}
        {tags && tags.length > 0 && (
          <div className="mt-8">
            <h2 className="font-label text-xs text-[#888] tracking-wider uppercase mb-3">标签概览</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: any) => (
                <span key={tag.id} className="font-label text-xs px-2.5 py-1 rounded-full bg-[#1a1a1a] text-[#888] border border-[#333]">
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
