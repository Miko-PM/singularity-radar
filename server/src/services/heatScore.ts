import { query } from '../db/index.js';
import { Source, Article } from '../types/index.js';

/**
 * 计算热度评分（抓取时计算）
 *
 * 公式: raw = base × recency_boost + bonus
 * 最终: min(round(raw / MAX_RAW × 100), 100) °C
 *
 * MAX_RAW = 150 — 理论最高原始分（GitHub 万星 + 最近 + 满加成）
 * 管理员置顶文章直接返回 99°C（不参与归一化），3 天后自动过期
 */
const MAX_RAW = 150;

/** GitHub star 分档 */
function gitHubBase(stars?: number): number {
  if (!stars || stars < 100) return 80;
  if (stars < 500) return 85;
  if (stars < 2000) return 90;
  if (stars < 10000) return 95;
  return 100; // ≥10000★
}

export function calculateHeatScore(
  category: string,
  stars?: number,
  hoursAgo?: number,
  hasImage?: boolean,
  tagCount?: number,
  isPinned?: boolean,
  pinnedAt?: string
): number {
  // 管理员置顶：3 天内固定 99°C
  if (category === 'admin' && isPinned && pinnedAt) {
    const hoursSincePin = getHoursAgo(pinnedAt);
    if (hoursSincePin < 72) return 99;
  }

  // base_score
  let base: number;
  switch (category) {
    case 'opensource':
      base = gitHubBase(stars);
      break;
    case 'paper':
      base = 50;
      break;
    case 'news':
      base = 60;
      break;
    case '36kr':
      base = 50;
      break;
    case 'podcast':
      base = 70;
      break;
    case 'sv101':
      base = 50;
      break;
    case 'admin':
      base = 90; // 非置顶管理员爆料
      break;
    default:
      base = 45;
  }

  // recency_boost
  let boost = 1.0;
  if (hoursAgo !== undefined) {
    if (hoursAgo <= 12) boost = 1.5;
    else if (hoursAgo <= 24) boost = 1.3;
    else if (hoursAgo <= 48) boost = 1.1;
    else boost = 1.0;
  }

  // 额外加分
  let bonus = 0;
  if (hasImage) bonus += 5;
  if (tagCount !== undefined && tagCount >= 3) bonus += 5;

  // 归一化到 0–100 °C
  const raw = base * boost + bonus;
  return Math.min(Math.round((raw / MAX_RAW) * 100), 100);
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

  const hasImage = !!article.image_url;
  const tagRes = await query(`SELECT COUNT(*) AS cnt FROM article_tags WHERE article_id = $1`, [article.id]);
  const tagCount = parseInt(tagRes.rows[0]?.cnt || '0', 10);

  const isPinned = (article as any).is_pinned === true;
  const pinnedAt = (article as any).pinned_at;

  const score = calculateHeatScore(categoryForScore, undefined, hoursAgo, hasImage, tagCount, isPinned, pinnedAt);

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

    const hasImage = !!article.image_url;
    const tagRes = await query(`SELECT COUNT(*) AS cnt FROM article_tags WHERE article_id = $1`, [article.id]);
    const tagCount = parseInt(tagRes.rows[0]?.cnt || '0', 10);

    const isPinned = (article as any).is_pinned === true;
    const pinnedAt = (article as any).pinned_at;

    const score = calculateHeatScore(catForScore, undefined, hoursAgo, hasImage, tagCount, isPinned, pinnedAt);
    await query(`UPDATE articles SET hot_score = $1 WHERE id = $2`, [score, article.id]);
    count++;
  }

  console.log(`[Heat] Rescored ${count} articles`);
  return count;
}
