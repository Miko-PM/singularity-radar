import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { Article, Tag, Source, HotTopic, ApiResponse, TabType, FilterType } from '../types/index.js';

const router = Router();

// GET /api/articles — 文章列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      tab = 'hot',
      tag,
      filter = 'latest',
      source,
      category,
      lang,
      days,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20') || 20));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    // Tab 筛选
    const tabToCategory: Record<string, string> = {
      tools: 'opensource',
      people: 'podcast',
    };
    if (tab !== 'hot') {
      const cat = tabToCategory[tab];
      if (cat) {
        where += ` AND s.category = $${paramIdx++}`;
        params.push(cat);
      }
    }

    // source 筛选
    if (source) {
      where += ` AND s.slug = $${paramIdx++}`;
      params.push(source);
    }

    // category 筛选
    if (category) {
      where += ` AND s.category = $${paramIdx++}`;
      params.push(category);
    }

    // tag 筛选
    if (tag) {
      where += ` AND a.id IN (SELECT article_id FROM article_tags at2 JOIN tags t ON at2.tag_id = t.id WHERE t.name = $${paramIdx++})`;
      params.push(tag);
    }

    // lang 筛选 — 仅中文（数据库正则不支持 CJK 范围，在 JS 层过滤）
    // 在 JavaScript 中 /[\u4e00-\u9fff]/ 是可靠的中文检测方式

    // days 筛选 — 限制最近 N 天
    if (days) {
      const n = parseInt(days, 10);
      if (n > 0) {
        where += ` AND a.published_at > NOW() - $${paramIdx++}::interval`;
        params.push(`${n} days`);
      }
    }

    // filter 排序
    let orderBy = 'ORDER BY a.published_at DESC';
    if (filter === 'hot') {
      where += ` AND a.published_at > NOW() - INTERVAL '3 days'`;
      orderBy = 'ORDER BY a.hot_score DESC, a.published_at DESC';
    } else if (filter === 'featured') {
      where += ` AND a.is_featured = true`;
    }

    // 计数
    const countRes = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM articles a JOIN sources s ON a.source_id = s.id ${where}`,
      params
    );
    const total = parseInt(String(countRes.rows[0]?.total || '0'));

    // 查询
    const dataRes = await query<Article>(
      `SELECT a.*, s.name AS source_name, s.slug AS source_slug, s.category
       FROM articles a
       JOIN sources s ON a.source_id = s.id
       ${where}
       ${orderBy}
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limitNum, offset]
    );

    // 一次性批量查询所有标签
    const ids = dataRes.rows.map(a => a.id);
    const tagRows = ids.length > 0
      ? (await query<{ article_id: number; name: string }>(
          `SELECT at2.article_id, t.name FROM tags t
           JOIN article_tags at2 ON t.id = at2.tag_id
           WHERE at2.article_id = ANY($1)`,
          [ids]
        )).rows
      : [];
    const tagMap = new Map<number, string[]>();
    for (const row of tagRows) {
      if (!tagMap.has(row.article_id)) tagMap.set(row.article_id, []);
      tagMap.get(row.article_id)!.push(row.name);
    }
    let articles = dataRes.rows.map(a => ({
      ...a,
      tags: tagMap.get(a.id) || [],
    }));

    // lang=zh 应用层过滤（PostgreSQL POSIX 正则不支持 CJK Unicode 范围）
    if (lang === 'zh') {
      const cjk = /[\u4e00-\u9fff]/;
      articles = articles.filter(a => cjk.test(a.title) || cjk.test(a.summary || ''));
    }

    const adjustedTotal = lang === 'zh' ? articles.length : total;

    const response: ApiResponse<typeof articles> = {
      data: articles,
      error: null,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: adjustedTotal,
        totalPages: Math.ceil(adjustedTotal / limitNum),
      },
    };

    res.json(response);
  } catch (err: any) {
    console.error('[API] GET /articles error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

// GET /api/articles/:id — 文章详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ data: null, error: 'invalid id' });
      return;
    }

    const articleRes = await query<Article>(
      `SELECT a.*, s.name AS source_name, s.slug AS source_slug, s.category
       FROM articles a JOIN sources s ON a.source_id = s.id WHERE a.id = $1`,
      [id]
    );

    if (articleRes.rows.length === 0) {
      res.status(404).json({ data: null, error: 'not found' });
      return;
    }

    const article = articleRes.rows[0];
    const tagRes = await query<{ name: string }>(
      `SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = $1`,
      [id]
    );

    res.json({
      data: { ...article, tags: tagRes.rows.map(t => t.name) },
      error: null,
    });
  } catch (err: any) {
    console.error('[API] GET /articles/:id error:', err.message);
    res.status(500).json({ data: null, error: 'internal error' });
  }
});

export default router;
