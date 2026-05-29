import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { Article } from '../types/index.js';
import { calculateHeatScore, getHoursAgo, reheatAll } from '../services/heatScore.js';
import { tagArticle, retagAllArticles } from '../services/tagger.js';
import { fetchAll } from '../services/fetcher.js';
import { generateHotTopics } from '../services/hotTopics.js';

const router = Router();

// Token 校验中间件
function requireAdmin(req: Request, res: Response): boolean {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const adminToken = process.env.ADMIN_TOKEN;
  if (!token || token !== adminToken) {
    res.status(403).json({ data: null, error: 'forbidden' });
    return false;
  }
  return true;
}

// POST /api/admin/articles — 管理员录入爆料
router.post('/articles', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { title, url, summary, tags, category, image_url, is_pinned } = req.body;

    if (!title || !url) {
      res.status(400).json({ data: null, error: 'title and url are required' });
      return;
    }

    // 算热度（管理员非置顶 base=90 → ~82°C；置顶=99°C 固定）
    const hoursAgo = 0; // 刚发布
    const hotScore = calculateHeatScore('admin', undefined, hoursAgo, !!image_url, undefined, is_pinned === true, new Date().toISOString());

    const result = await query<Article>(
      `INSERT INTO articles (source_id, title, url, summary, image_url, hot_score, is_admin_post, is_featured, is_pinned, pinned_at, published_at)
       VALUES (
         (SELECT id FROM sources WHERE slug = 'admin_post'),
         $1, $2, $3, $4, $5, true, $6, $7, $8, NOW()
       )
       ON CONFLICT (url) DO UPDATE SET hot_score = EXCLUDED.hot_score
       RETURNING id`,
      [title, url, summary || '', image_url || '', hotScore, req.body.is_featured === true, is_pinned === true, is_pinned ? new Date().toISOString() : null]
    );

    const articleId = result.rows[0].id;

    // 打标签
    if (tags) {
      const tagList = typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : tags;
      for (const tagName of tagList) {
        if (!tagName) continue;
        await query(`INSERT INTO tags (name) VALUES ($1) ON CONFLICT DO NOTHING`, [tagName]);
        const tagRes = await query<{ id: number }>(`SELECT id FROM tags WHERE name = $1`, [tagName]);
        if (tagRes.rows.length > 0) {
          await query(`INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [articleId, tagRes.rows[0].id]);
        }
      }
    }

    // 同时对 title + summary 做自动标签匹配
    await tagArticle(articleId, `${title} ${summary || ''}`);

    // 刷新热门议题
    await generateHotTopics();

    res.json({ data: { id: articleId }, error: null });
  } catch (err: any) {
    console.error('[API] POST /admin/articles error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

// POST /api/admin/retag — 全量重新打标签
router.post('/retag', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const count = await retagAllArticles();
    await generateHotTopics();
    res.json({ data: { retagged: count }, error: null });
  } catch (err: any) {
    console.error('[API] POST /admin/retag error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

// POST /api/admin/fetch — 手动触发全量抓取
router.post('/fetch', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const results = await fetchAll();
    res.json({ data: results, error: null });
  } catch (err: any) {
    console.error('[API] POST /admin/fetch error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

// POST /api/admin/reheat — 全量重算热度评分
router.post('/reheat', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const count = await reheatAll();
    res.json({ data: { rescored: count }, error: null });
  } catch (err: any) {
    console.error('[API] POST /admin/reheat error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

// GET /api/admin/stats — 数据统计概览
router.get('/stats', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const stats = await query(
      `SELECT
         (SELECT COUNT(*) FROM articles) AS total_articles,
         (SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '24 hours') AS articles_24h,
         (SELECT COUNT(*) FROM tags) AS total_tags,
         (SELECT COUNT(*) FROM hot_topics) AS total_topics,
         (SELECT COUNT(*) FROM sources WHERE enabled = true) AS active_sources`
    );
    res.json({ data: stats.rows[0], error: null });
  } catch (err: any) {
    console.error('[API] GET /admin/stats error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

export default router;
