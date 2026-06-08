import { query } from '../db/index.js';
import { calculateHeatScore, getHoursAgo } from './heatScore.js';
import { tagArticle } from './tagger.js';

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'Singularity-Radar/1.0';

interface GitHubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  pushed_at: string;
  topics: string[];
}

/** GitHub API 请求头（含可选 Token） */
function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/vnd.github.v3+json',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h['Authorization'] = `token ${token}`;
  return h;
}

/** GitHub Search API 搜索仓库 */
async function searchRepos(queryStr: string, sort: string = 'stars', order: string = 'desc', perPage: number = 30): Promise<GitHubRepo[]> {
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(queryStr)}&sort=${sort}&order=${order}&per_page=${perPage}`;
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15000) });

  if (!res.ok) {
    if (res.status === 403) {
      console.warn('[GitHubHistory] API rate limited, consider setting GITHUB_TOKEN');
    }
    throw new Error(`GitHub API ${res.status}`);
  }

  const json = await res.json();
  return (json.items || []).map((item: any): GitHubRepo => ({
    full_name: item.full_name,
    html_url: item.html_url,
    description: item.description,
    stargazers_count: item.stargazers_count,
    language: item.language,
    pushed_at: item.pushed_at,
    topics: item.topics || [],
  }));
}

/** 将仓库写入 articles 表 */
async function insertRepo(repo: GitHubRepo, sourceId: number, isRising: boolean, claimOnConflict: boolean = false, capScore?: number): Promise<boolean> {
  const title = repo.full_name;
  const summaryParts: string[] = [];
  if (repo.description) summaryParts.push(repo.description);
  if (repo.language) summaryParts.push(`[${repo.language}]`);
  summaryParts.push(`⭐ ${repo.stargazers_count.toLocaleString()}`);
  const summary = summaryParts.join(' | ').slice(0, 500);

  // 热度评分：opensource 分档制 + 时间衰减
  const publishedAt = repo.pushed_at || new Date().toISOString();
  const hoursAgo = getHoursAgo(publishedAt);
  // 新锐榜额外 +5 热度（近 30 天增量激励）
  const hotScore = calculateHeatScore('opensource', repo.stargazers_count, hoursAgo, false, undefined);
  let finalScore = hotScore;
  // 可选上限（长青榜长期推荐，不应霸榜）
  if (capScore !== undefined && finalScore > capScore) {
    finalScore = capScore;
  }

  try {
    const updateSet = claimOnConflict
      ? `hot_score = EXCLUDED.hot_score, published_at = EXCLUDED.published_at, stars = EXCLUDED.stars, source_id = EXCLUDED.source_id, summary = CASE WHEN articles.summary = '' THEN EXCLUDED.summary ELSE articles.summary END`
      : `hot_score = EXCLUDED.hot_score, published_at = EXCLUDED.published_at, stars = EXCLUDED.stars, summary = CASE WHEN articles.summary = '' THEN EXCLUDED.summary ELSE articles.summary END`;
    const result = await query(
      `INSERT INTO articles (source_id, title, url, summary, author, published_at, hot_score, stars)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (url) DO UPDATE SET ${updateSet}
       RETURNING id`,
      [sourceId, title, repo.html_url, summary, '', publishedAt, finalScore, repo.stargazers_count]
    );

    if (result.rows.length > 0) {
      await tagArticle(result.rows[0].id, `${title} ${repo.description || ''}`);
      return true;
    }
    return false;
  } catch (err: any) {
    if (err.code !== '23505') {
      console.warn(`[GitHubHistory] Error inserting "${title}": ${err.message}`);
    }
    return false;
  }
}

// ── 搜索策略 ──

const TOPIC_QUERY = 'topic:ai'; // GitHub Search API 不支持过多 OR 限定词

const DESC_FALLBACK = '"ai" OR "artificial intelligence" OR "llm" OR "machine learning" in:description stars:>5000';

/** 获取 source_id（按 slug） */
async function getSourceId(slug: string): Promise<number | null> {
  const res = await query<{ id: number }>('SELECT id FROM sources WHERE slug = $1', [slug]);
  return res.rows[0]?.id ?? null;
}

/** 常青榜：Top 20-30 高星 AI 仓库 */
export async function fetchEvergreenRepos(): Promise<number> {
  const sourceId = await getSourceId('github_evergreen');
  if (!sourceId) {
    console.warn('[GitHubHistory] Source github_evergreen not found, skipping');
    return 0;
  }

  const start = Date.now();
  let count = 0;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dateStr = oneYearAgo.toISOString().slice(0, 10);

  try {
    // 通道 A：Topic 标签搜索
    const topicRepos = await searchRepos(`${TOPIC_QUERY} pushed:>${dateStr}`, 'stars', 'desc', 30);
    console.log(`[GitHubHistory] Topic search returned ${topicRepos.length} repos`);

    for (const repo of topicRepos) {
      if (await insertRepo(repo, sourceId, false, true, 70)) count++;
    }

    // 通道 B：描述关键词兜底（仅当不足 30 条时）
    if (topicRepos.length < 20) {
      const fallbackRepos = await searchRepos(`${DESC_FALLBACK} pushed:>${dateStr}`, 'stars', 'desc', 20);
      console.log(`[GitHubHistory] Fallback search returned ${fallbackRepos.length} repos`);

      // 去重：跳过已在 topic 结果中的
      const existingUrls = new Set(topicRepos.map(r => r.html_url));
      for (const repo of fallbackRepos) {
        if (!existingUrls.has(repo.html_url)) {
          if (await insertRepo(repo, sourceId, false, true, 70)) count++;
        }
      }
    }

    console.log(`[GitHubHistory] Evergreen: ${count} new repos (${Date.now() - start}ms)`);
  } catch (err: any) {
    console.error(`[GitHubHistory] Evergreen fetch error: ${err.message}`);
  }

  return count;
}

/** 新锐榜：每次抓取同步更新的增长中 AI 仓库 */
export async function fetchRisingRepos(): Promise<number> {
  const sourceId = await getSourceId('github_rising');
  if (!sourceId) {
    console.warn('[GitHubHistory] Source github_rising not found, skipping');
    return 0;
  }

  const start = Date.now();
  let count = 0;
  const now = new Date();

  // 预查现有 GitHub 仓库 URL（避免重复插入）
  const existingUrls = new Set<string>();
  const existing = await query("SELECT url FROM articles WHERE url LIKE 'https://github.com/%'");
  for (const row of existing.rows) existingUrls.add(row.url);

  /** 插入新仓库（去重后） */
  const insertNew = async (repos: GitHubRepo[]): Promise<number> => {
    let n = 0;
    for (const repo of repos) {
      if (existingUrls.has(repo.html_url)) continue;
      if (await insertRepo(repo, sourceId, true)) {
        existingUrls.add(repo.html_url); // 去重集合同步更新
        n++;
      }
    }
    return n;
  };

  try {
    // ── 通道 A：近期活跃的中等星数仓库（按 pushed 排序，每次 cron 能找到不同的） ──
    const recentDate = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const activeRepos = await searchRepos(
      `topic:ai stars:500..30000 pushed:>${recentDate}`, 'pushed', 'desc', 20
    );
    console.log(`[GitHubHistory] Rising active search returned ${activeRepos.length} repos`);
    count += await insertNew(activeRepos);

    // ── 通道 B：新创建的 AI 仓库（created 排序，发现新兴项目） ──
    if (count < 10) {
      const createdDate = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
      const newRepos = await searchRepos(
        `topic:ai stars:>300 created:>${createdDate}`, 'stars', 'desc', 10
      );
      console.log(`[GitHubHistory] Rising new-repo search returned ${newRepos.length} repos`);
      count += await insertNew(newRepos);
    }

    // ── 通道 C（兜底）：描述关键词搜索，跳过 topic:ai 限制 ──
    if (count < 5) {
      const recentDate2 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
      const descRepos = await searchRepos(
        `"ai" OR "llm" OR "machine learning" in:description stars:1000..20000 pushed:>${recentDate2}`,
        'pushed', 'desc', 10
      );
      console.log(`[GitHubHistory] Rising description fallback returned ${descRepos.length} repos`);
      count += await insertNew(descRepos);
    }

    console.log(`[GitHubHistory] Rising: ${count} new repos (${Date.now() - start}ms)`);
  } catch (err: any) {
    console.error(`[GitHubHistory] Rising fetch error: ${err.message}`);
  }

  return count;
}
