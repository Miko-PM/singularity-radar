import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { HotTopic } from '../types/index.js';

const router = Router();

// GET /api/hot-topics — 热门议题聚合
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query<HotTopic>(
      `SELECT * FROM hot_topics ORDER BY total_hot_score DESC`
    );

    // 为每个议题获取关联文章
    const topics = await Promise.all(
      result.rows.map(async (topic) => {
        const articles = await query(
          `SELECT a.id, a.title, a.url, a.image_url, a.hot_score, s.name AS source_name, s.slug AS source_slug, s.category
           FROM articles a
           JOIN sources s ON a.source_id = s.id
           JOIN article_tags at2 ON a.id = at2.article_id
           JOIN tags t ON at2.tag_id = t.id
           WHERE t.name = $1 AND a.published_at > NOW() - INTERVAL '48 hours'
           ORDER BY a.hot_score DESC
           LIMIT 10`,
          [topic.keyword]
        );
        return { ...topic, articles: articles.rows };
      })
    );

    res.json({ data: topics, error: null });
  } catch (err: any) {
    console.error('[API] GET /hot-topics error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

export default router;
