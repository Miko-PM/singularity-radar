import { query, transaction } from '../db/index.js';
import { TagKeyword } from '../types/index.js';
import { escapeRegex } from '../utils/escapeRegex.js';

let keywordCache: TagKeyword[] = [];

export async function loadKeywords(): Promise<void> {
  const res = await query<TagKeyword>('SELECT * FROM tag_keywords');
  keywordCache = res.rows;
  console.log(`[Tag] Loaded ${keywordCache.length} keywords`);
}

export async function reloadKeywords(): Promise<void> {
  keywordCache = [];
  await loadKeywords();
}

export function matchTags(text: string): { tag_name: string; keyword: string }[] {
  if (!text || keywordCache.length === 0) return [];

  const matches: { tag_name: string; keyword: string }[] = [];
  const seen = new Set<string>();

  for (const tk of keywordCache) {
    const escaped = escapeRegex(tk.keyword);
    // `\b` 仅匹配 ASCII 单词边界，中文不适用
    // 纯 ASCII 关键词使用 \b 避免部分匹配（如 "GPT" 不匹配 "GPTs"）
    // 中文关键词直接匹配即可是完整语义单元
    const pattern = /^[\x00-\x7F]+$/.test(tk.keyword)
      ? `\\b${escaped}\\b`
      : escaped;
    const regex = new RegExp(pattern, 'i');
    if (regex.test(text)) {
      const key = `${tk.tag_name}:${tk.keyword}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({ tag_name: tk.tag_name, keyword: tk.keyword });
      }
    }
  }

  return matches;
}

export async function tagArticle(articleId: number, text: string): Promise<void> {
  const matches = matchTags(text);
  if (matches.length === 0) return;

  for (const m of matches) {
    // 确保标签存在
    await query(
      `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [m.tag_name]
    );

    // 获取标签 id
    const tagRes = await query<{ id: number }>(
      `SELECT id FROM tags WHERE name = $1`,
      [m.tag_name]
    );
    if (tagRes.rows.length === 0) continue;

    // 插入关联
    await query(
      `INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [articleId, tagRes.rows[0].id]
    );
  }
}

export async function retagAllArticles(): Promise<number> {
  const articles = await query<{ id: number; title: string; summary: string }>(
    `SELECT id, title, summary FROM articles`
  );

  return transaction(async (client) => {
    // 清空所有标签关联（在事务中，失败可回滚）
    await client.query('DELETE FROM article_tags');

    let count = 0;
    for (const article of articles.rows) {
      const text = `${article.title} ${article.summary}`;
      await tagArticle(article.id, text);
      count++;
    }

    console.log(`[Tag] Retagged ${count} articles`);
    return count;
  });
}
