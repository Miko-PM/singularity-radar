import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { Source } from '../types/index.js';

const router = Router();

// GET /api/sources — 数据源状态
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query<Source>(
      `SELECT s.*,
              (SELECT COUNT(*) FROM articles WHERE source_id = s.id) AS article_count,
              (SELECT MAX(created_at) FROM articles WHERE source_id = s.id) AS last_fetch
       FROM sources s
       ORDER BY s.id`
    );
    res.json({ data: result.rows, error: null });
  } catch (err: any) {
    console.error('[API] GET /sources error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

export default router;
