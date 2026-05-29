import { query, transaction } from '../db/index.js';

interface CoOccurrence {
  keyword: string;
  articles: { id: number; title: string; url: string; image_url: string; hot_score: number; source_type: string; source_name: string; }[];
  source_types: Set<string>;
}

export async function generateHotTopics(): Promise<number> {
  // 获取最近 48 小时内所有文章的标签
  const articlesRes = await query<{
    id: number;
    title: string;
    url: string;
    image_url: string;
    hot_score: number;
    source_slug: string;
    category: string;
    tag_name: string;
  }>(
    `SELECT a.id, a.title, a.url, a.image_url, a.hot_score,
            s.slug AS source_slug, s.category,
            t.name AS tag_name
     FROM articles a
     JOIN sources s ON a.source_id = s.id
     JOIN article_tags at2 ON a.id = at2.article_id
     JOIN tags t ON at2.tag_id = t.id
     WHERE a.created_at > NOW() - INTERVAL '48 hours'
       AND a.hot_score > 0`
  );

  // 按关键词分组
  const topicMap = new Map<string, CoOccurrence>();

  for (const row of articlesRes.rows) {
    const keyword = row.tag_name;
    if (!topicMap.has(keyword)) {
      topicMap.set(keyword, {
        keyword,
        articles: [],
        source_types: new Set(),
      });
    }
    const topic = topicMap.get(keyword)!;

    // 避免重复文章
    if (!topic.articles.some(a => a.id === row.id)) {
      topic.articles.push({
        id: row.id,
        title: row.title,
        url: row.url,
        image_url: row.image_url,
        hot_score: row.hot_score,
        source_type: row.category,
        source_name: row.source_slug,
      });
    }
    topic.source_types.add(row.category);
  }

  // 筛选：≥2 种不同源类型 且 ≥3 篇文章
  const validTopics = Array.from(topicMap.values())
    .filter(t => t.source_types.size >= 2 && t.articles.length >= 3);

  // 在事务中清空旧数据并写入新数据
  const insertedCount = await transaction(async (client) => {
    await client.query('DELETE FROM hot_topics');

    let count = 0;
    for (const topic of validTopics) {
      // 按热度排序，取最高分文章作为主标题
      topic.articles.sort((a, b) => b.hot_score - a.hot_score);
      const master = topic.articles[0];

      // 计算聚合热度
      const totalHot = topic.articles.reduce((s, a) => s + a.hot_score, 0);

      await client.query(
        `INSERT INTO hot_topics (keyword, master_title, master_url, master_image_url, article_count, source_types, total_hot_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          topic.keyword,
          master.title.slice(0, 200),
          master.url,
          master.image_url,
          topic.articles.length,
          JSON.stringify(Array.from(topic.source_types)),
          totalHot,
        ]
      );
      count++;
    }
    return count;
  });

  console.log(`[Topics] Generated ${insertedCount} hot topics (from ${topicMap.size} candidates)`);
  return insertedCount;
}
