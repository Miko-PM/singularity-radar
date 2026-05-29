import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { Tag } from '../types/index.js';

const router = Router();

// GET /api/tags — 所有标签
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query<Tag>(
      `SELECT t.*, COUNT(at2.article_id) as article_count
       FROM tags t
       LEFT JOIN article_tags at2 ON t.id = at2.tag_id
       GROUP BY t.id
       ORDER BY article_count DESC`
    );
    res.json({ data: result.rows, error: null });
  } catch (err: any) {
    console.error('[API] GET /tags error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

export default router;
