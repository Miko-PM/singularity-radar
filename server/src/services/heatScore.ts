import { query } from '../db/index.js';
import { Source, Article } from '../types/index.js';

/**
 * 计算热度评分（抓取时计算）
 *
 * 公式: score = min(base × recency_boost + bonus, 100) °C
 * - base: 数据源类型的基础分（GitHub 按星数分档）
 * - recency_boost: 发布时间越近加成越高（1.0 ~ 1.5）
 * - bonus: 有图 +5，≥3 标签 +5
 * - 管理员置顶文章 3 天内固定 99°C
 *
 * 设计原则：
 * - 爆火的 GitHub 仓库可达 90°C，普通仓库 30-50°C
 * - 头部 AI 资讯（马斯克/黄仁勋等）可达 80-90°C
 * - 播客/深度内容 60-85°C
 * - 论文 40-65°C
 * - 没有归一化硬上限，允许热内容自然突破
 */

/** GitHub star 分档（含今日新增加成） */
function gitHubBase(stars?: number, todayStars?: number): number {
  const todayBonus = todayStars ? Math.min(todayStars / 10, 15) : 0;
  let base: number;
  if (!stars || stars < 100) base = 35;
  else if (stars < 500) base = 42;
  else if (stars < 2000) base = 50;
  else if (stars < 10000) base = 55;
  else if (stars < 50000) base = 60;
  else if (stars < 100000) base = 65;
  else base = 70; // ≥100000★
  return base + todayBonus;
}

export function calculateHeatScore(
  category: string,
  stars?: number,
  hoursAgo?: number,
  hasImage?: boolean,
  tagCount?: number,
  isPinned?: boolean,
  pinnedAt?: string,
  todayStars?: number
): number {
  // 管理员置顶衰减：99°C → 逐渐降至正常评分，72h 后走普通公式
  if (category === 'admin' && isPinned && pinnedAt) {
    const hoursSincePin = getHoursAgo(pinnedAt);
    if (hoursSincePin <= 12) return 99;
    if (hoursSincePin <= 24) return 95;
    if (hoursSincePin <= 48) return 90;
    if (hoursSincePin <= 72) return 85;
    // 超过 72h：降级为普通管理员 base，但仍保留置顶排序优先
  }

  // base_score
  let base: number;
  switch (category) {
    case 'opensource':
      base = gitHubBase(stars, todayStars);
      break;
    case 'paper':
      base = 40;
      break;
    case 'news':
      base = 55;
      break;
    case '36kr':
      base = 50;
      break;
    case 'podcast':
      base = 60;
      break;
    case 'sv101':
      base = 50;
      break;
    case 'admin':
      base = 75; // 非置顶管理员爆料
      break;
    case 'product_hunt':
      base = 55;
      break;
    case 'hacker_news':
      base = 50;
      break;
    case 'openai_blog':
    case 'google_ai_blog':
    case 'huggingface_blog':
      base = 65; // 官方 AI 公司博客，与 100K★ GitHub 同级
      break;
    default:
      base = 40;
  }

  // recency_boost
  let boost = 1.0;
  if (hoursAgo !== undefined) {
    if (hoursAgo <= 12) boost = 1.5;
    else if (hoursAgo <= 24) boost = 1.3;
    else if (hoursAgo <= 48) boost = 1.1;
    else boost = 1.0;
  }

  // 额外加分（收窄，避免新闻聚合站因图片+标签堆积过量）
  let bonus = 0;
  if (hasImage) bonus += 3;
  if (tagCount !== undefined && tagCount >= 3) bonus += 3;

  // 直接封顶 100°C，不归一化
  const raw = base * boost + bonus;
  return Math.min(Math.round(raw), 100);
}

export function getHoursAgo(dateStr: string): number {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  return (now - date) / 3600000;
}

/**
 * 为单篇文章计算并更新热度
 */
export async function scoreArticle(article: Article): Promise<number> {
  const sourceRes = await query<{ category: string; slug: string }>(
    `SELECT category, slug FROM sources WHERE id = $1`,
    [article.source_id]
  );
  if (sourceRes.rows.length === 0) return 0;

  const { category, slug } = sourceRes.rows[0];
  const hoursAgo = getHoursAgo(article.published_at);

  let categoryForScore = category;
  if (slug === 'xinzhiyuan') categoryForScore = 'xinzhiyuan';
  if (slug === '36kr') categoryForScore = '36kr';
  if (slug === 'sv101') categoryForScore = 'sv101';
  if (slug === 'admin_post') categoryForScore = 'admin';
  if (slug === 'product_hunt') categoryForScore = 'product_hunt';
  if (slug === 'hacker_news') categoryForScore = 'hacker_news';
  if (slug === 'openai_blog') categoryForScore = 'openai_blog';
  if (slug === 'google_ai_blog') categoryForScore = 'google_ai_blog';
  if (slug === 'huggingface_blog') categoryForScore = 'huggingface_blog';

  const hasImage = !!article.image_url;
  const tagRes = await query(`SELECT COUNT(*) AS cnt FROM article_tags WHERE article_id = $1`, [article.id]);
  const tagCount = parseInt(tagRes.rows[0]?.cnt || '0', 10);

  const isPinned = (article as any).is_pinned === true;
  const pinnedAt = (article as any).pinned_at;
  const stars = (article as any).stars;

  let score = calculateHeatScore(categoryForScore, stars, hoursAgo, hasImage, tagCount, isPinned, pinnedAt);
  // 长青榜封顶 70（长期推荐不霸榜）
  if (slug === 'github_evergreen') score = Math.min(score, 70);

  await query(`UPDATE articles SET hot_score = $1 WHERE id = $2`, [score, article.id]);

  return score;
}

/**
 * 批次计算所有文章热度（用于全量重算）
 */
export async function reheatAll(): Promise<number> {
  const articles = await query<Article>(
    `SELECT a.*, s.slug, s.category FROM articles a JOIN sources s ON a.source_id = s.id`
  );

  // 批量查标签数，避免 N+1
  const tagCounts = new Map<number, number>();
  const tagRes = await query<{ article_id: string; cnt: string }>(
    `SELECT article_id, COUNT(*) AS cnt FROM article_tags GROUP BY article_id`
  );
  for (const row of tagRes.rows) {
    tagCounts.set(parseInt(row.article_id), parseInt(row.cnt));
  }

  let count = 0;
  for (const article of articles.rows) {
    const sourceSlug = (article as any).slug;
    const category = (article as any).category;
    const hoursAgo = getHoursAgo(article.published_at);

    let catForScore = category;
    if (sourceSlug === 'xinzhiyuan') catForScore = 'xinzhiyuan';
    if (sourceSlug === '36kr') catForScore = '36kr';
    if (sourceSlug === 'sv101') catForScore = 'sv101';
    if (sourceSlug === 'admin_post') catForScore = 'admin';
    if (sourceSlug === 'product_hunt') catForScore = 'product_hunt';
    if (sourceSlug === 'hacker_news') catForScore = 'hacker_news';
    if (sourceSlug === 'openai_blog') catForScore = 'openai_blog';
    if (sourceSlug === 'google_ai_blog') catForScore = 'google_ai_blog';
    if (sourceSlug === 'huggingface_blog') catForScore = 'huggingface_blog';

    const hasImage = !!article.image_url;
    const tagCount = tagCounts.get(article.id) ?? 0;

    const isPinned = (article as any).is_pinned === true;
    const pinnedAt = (article as any).pinned_at;
    const stars = (article as any).stars;

    let score = calculateHeatScore(catForScore, stars, hoursAgo, hasImage, tagCount, isPinned, pinnedAt);
    if (sourceSlug === 'github_evergreen') score = Math.min(score, 70);
    await query(`UPDATE articles SET hot_score = $1 WHERE id = $2`, [score, article.id]);
    count++;
  }

  console.log(`[Heat] Rescored ${count} articles`);
  return count;
}

/** 定时衰减置顶管理员爆料的热度 */
export async function decayPinnedPosts(): Promise<number> {
  const res = await query<Article>(
    `SELECT a.* FROM articles a
     JOIN sources s ON a.source_id = s.id
     WHERE s.slug = 'admin_post' AND a.is_pinned = true`
  );
  for (const article of res.rows) {
    await scoreArticle(article);
  }
  if (res.rows.length > 0) {
    console.log(`[Heat] Decayed ${res.rows.length} pinned posts`);
  }
  return res.rows.length;
}
