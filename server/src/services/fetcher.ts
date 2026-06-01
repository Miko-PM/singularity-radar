import 'dotenv/config';
import { query } from '../db/index.js';
import { Source, Article } from '../types/index.js';
import { tagArticle } from './tagger.js';
import { calculateHeatScore, getHoursAgo } from './heatScore.js';
import { generateHotTopics } from './hotTopics.js';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

const USER_AGENT = 'Singularity-Radar/1.0';

interface FetchResult {
  source: string;
  success: boolean;
  newCount: number;
  error?: string;
  elapsed: number;
}

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    return null;
  }
}

async function parseRSS(xml: string): Promise<any[]> {
  try {
    const parsed = parser.parse(xml);
    // RSS 2.0
    if (parsed.rss?.channel?.item) return parsed.rss.channel.item;
    // Atom
    if (parsed.feed?.entry) return parsed.feed.entry;
    return [];
  } catch {
    return [];
  }
}

function extractField(item: any, ...keys: string[]): string {
  for (const key of keys) {
    const val = item[key];
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val?.['#text']) return val['#text'];
  }
  return '';
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

function extractImage(item: any): string {
  // RSS 2.0: media:content or enclosure
  const mediaContent = item['media:content'] || item['media:thumbnail'];
  if (typeof mediaContent === 'string') return mediaContent;
  if (mediaContent?.['@_url']) return mediaContent['@_url'];
  if (Array.isArray(mediaContent) && mediaContent[0]?.['@_url']) return mediaContent[0]['@_url'];

  const enclosure = item.enclosure;
  if (typeof enclosure === 'object' && enclosure?.['@_url'] && enclosure?.['@_type']?.startsWith('image')) {
    return enclosure['@_url'];
  }

  // Atom
  const link = item.link;
  if (Array.isArray(link)) {
    for (const l of link) {
      if (typeof l === 'object' && l['@_rel'] === 'enclosure' && l['@_type']?.startsWith('image')) {
        return l['@_href'];
      }
    }
  }

  // 从 content:encoded / description / content 提取第一张图
  for (const field of ['content:encoded', 'description', 'content', 'summary']) {
    const raw = item[field];
    if (typeof raw === 'string') {
      const m = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) return m[1];
    }
  }

  return '';
}

/**
 * GitHub Trending — HTML scraper
 * 替代 RSSHub（Cloudflare 墙内不可用），直接解析 GitHub Trending 页面
 */
async function fetchGitHubTrending(source: Source): Promise<FetchResult> {
  const start = Date.now();
  let newCount = 0;

  try {
    const res = await fetch('https://github.com/trending?since=daily', {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return { source: source.name, success: false, newCount: 0, error: `HTTP ${res.status}`, elapsed: Date.now() - start };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const articles = $('article.Box-row');

    if (articles.length === 0) {
      return { source: source.name, success: false, newCount: 0, error: 'No trending repos found in HTML', elapsed: Date.now() - start };
    }

    for (const el of articles) {
      const $el = $(el);

      // 仓库 URL: /owner/repo
      const href = $el.find('h2 a').attr('href') || '';
      if (!href) continue;
      const fullUrl = `https://github.com${href}`;
      const parts = href.replace(/^\//, '').split('/');
      const owner = parts[0] || '';
      const repo = parts[1] || '';
      const title = `${owner}/${repo}`;

      // 描述
      const description = $el.find('p').text().trim();

      // 编程语言
      const language = $el.find('[itemprop="programmingLanguage"]').text().trim();

      // Star 数
      const starText = $el.find('.f6 .d-inline-block.float-sm-right').text().trim();
      const starMatch = starText.match(/([\d,]+)\s*stars?/i);
      const stars = starMatch ? parseInt(starMatch[1].replace(/,/g, '')) : 0;

      // Today's stars
      const todayStarText = $el.find('.f6 .float-sm-none').text().trim();
      const todayStarMatch = todayStarText.match(/([\d,]+)\s*stars?\s*today/i);
      const todayStars = todayStarMatch ? parseInt(todayStarMatch[1].replace(/,/g, '')) : 0;

      // 构建摘要
      let summary = description;
      if (language) summary = `[${language}] ${summary}`;
      summary += ` | ⭐ ${stars.toLocaleString()} | ★${todayStars} today`;
      if (summary.length > 500) summary = summary.slice(0, 500);

      // 热度评分
      const hoursAgo = 0; // trending = 最新
      const hotScore = calculateHeatScore('opensource', stars, hoursAgo, false, undefined);

      try {
        const result = await query<Article>(
          `INSERT INTO articles (source_id, title, url, summary, author, published_at, image_url, hot_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (url) DO UPDATE SET
             hot_score = EXCLUDED.hot_score,
             published_at = EXCLUDED.published_at,
             image_url = CASE WHEN EXCLUDED.image_url <> '' THEN EXCLUDED.image_url ELSE articles.image_url END,
             summary = CASE WHEN articles.summary = '' THEN EXCLUDED.summary ELSE articles.summary END
           RETURNING id`,
          [
            source.id,
            title,
            fullUrl,
            summary,
            '',
            new Date().toISOString(),
            '',
            hotScore,
          ]
        );

        if (result.rows.length > 0) {
          await tagArticle(result.rows[0].id, `${title} ${description}`);
          newCount++;
        }
      } catch (err: any) {
        if (err.code !== '23505') {
          console.warn(`[GitHubTrending] Error processing "${title.slice(0, 40)}":`, err.message);
        }
      }
    }

    return {
      source: source.name,
      success: true,
      newCount,
      elapsed: Date.now() - start,
    };
  } catch (err: any) {
    return {
      source: source.name,
      success: false,
      newCount: 0,
      error: err.message,
      elapsed: Date.now() - start,
    };
  }
}

async function fetchSingleSource(source: Source): Promise<FetchResult> {
  const start = Date.now();

  // GitHub Trending 使用 HTML scraper，跳过 RSS
  if (source.slug === 'github_trending') {
    return fetchGitHubTrending(source);
  }

  try {
    let xml = await fetchFeed(source.feed_url);

    // 主地址失败，尝试备用地址
    if (!xml) {
      const fallbacks: string[] = JSON.parse(source.fallback_urls || '[]');
      for (const fb of fallbacks) {
        xml = await fetchFeed(fb);
        if (xml) break;
      }
    }

    if (!xml) {
      return {
        source: source.name,
        success: false,
        newCount: 0,
        error: 'All feed URLs failed',
        elapsed: Date.now() - start,
      };
    }

    const items = await parseRSS(xml);
    let newCount = 0;

    for (const item of items) {
      const title = extractField(item, 'title').trim();
      if (!title) continue;

      // 提取 URL
      let link = extractField(item, 'link', 'id');
      // Atom link is an array
      if (Array.isArray(item.link)) {
        const altLink = item.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel']);
        link = altLink?.['@_href'] || item.link[0]?.['@_href'] || link;
      }
      if (!link) continue;

      // 提取摘要
      let summary = stripHTML(extractField(item, 'summary', 'description', 'itunes:summary', 'content:encoded', 'content'));
      if (summary.length > 500) summary = summary.slice(0, 500);

      // 提取作者
      const author = extractField(item, 'author', 'dc:creator', 'itunes:author');

      // 提取发布时间
      const pubDate = extractField(item, 'pubDate', 'published', 'published_at', 'updated', 'dc:date');

      // 提取配图
      const imageUrl = extractImage(item);

      // 36氪仅保留 AI 相关文章（过滤财经/股市类噪音）
      if (source.slug === '36kr') {
        const aiPattern = /AI|人工智能|大模型|机器学习|深度学习|LLM|GPT|ChatGPT|机器人|自动驾驶|芯片|半导体|算法|算力|神经|视觉|语言|生成式|AIGC|Agent|多模态|参数|开源|扩散|Transformer|transformer|Attention|attention|微软|谷歌|Google|Meta|Facebook|Apple|苹果|英伟达|NVIDIA|AMD|英特尔|Intel|高通|Qualcomm|华为|百度|阿里|腾讯|字节|京东|OpenAI|Anthropic|Claude|Gemini|Gemma|Llama|Mistral|Stability|Midjourney|Sora|Copilot|AutoGPT|液冷|光模块/i;
        const combined = `${title} ${summary}`;
        if (!aiPattern.test(combined)) {
          continue; // 跳过非 AI 内容
        }
      }

      // 提取 GitHub stars（GitHub Trending 特有）
      let stars: number | undefined;
      if (source.slug === 'github_trending') {
        const desc = extractField(item, 'description', 'summary');
        const starMatch = desc.match(/(\d[\d,]*)\s*stars?/i);
        if (starMatch) stars = parseInt(starMatch[1].replace(/,/g, ''));
      }

      try {
        // 计算热度
        let catForScore: string = source.category;
        if (source.slug === 'xinzhiyuan') catForScore = 'xinzhiyuan';
        if (source.slug === '36kr') catForScore = '36kr';
        if (source.slug === 'sv101') catForScore = 'sv101';
        if (source.slug === 'admin_post') catForScore = 'admin';

        const pubDateObj = pubDate ? new Date(pubDate) : new Date();
        const hoursAgo = getHoursAgo(pubDateObj.toISOString());
        const hasImage = imageUrl ? imageUrl.length > 0 : false;
        const hotScore = calculateHeatScore(catForScore, stars, hoursAgo, hasImage);

        // 入库
        const result = await query<Article>(
          `INSERT INTO articles (source_id, title, url, summary, author, published_at, image_url, hot_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (url) DO UPDATE SET
             hot_score = EXCLUDED.hot_score,
             published_at = EXCLUDED.published_at,
             image_url = CASE WHEN EXCLUDED.image_url <> '' THEN EXCLUDED.image_url ELSE articles.image_url END,
             summary = CASE WHEN articles.summary = '' THEN EXCLUDED.summary ELSE articles.summary END
           RETURNING id`,
          [
            source.id,
            title,
            link,
            summary,
            author,
            pubDateObj.toISOString(),
            imageUrl,
            hotScore,
          ]
        );

        if (result.rows.length > 0) {
          // 打标签
          const tagText = `${title} ${summary}`;
          await tagArticle(result.rows[0].id, tagText);

          // ≥3 标签 → 热度 +5
          const tagCountRes = await query(`SELECT COUNT(*) AS cnt FROM article_tags WHERE article_id = $1`, [result.rows[0].id]);
          const tagCount = parseInt(tagCountRes.rows[0]?.cnt || '0', 10);
          if (tagCount >= 3) {
            await query(`UPDATE articles SET hot_score = LEAST(hot_score + 5, 100) WHERE id = $1`, [result.rows[0].id]);
          }
          newCount++;
        }
      } catch (err: any) {
        // 唯一约束冲突等，跳过
        if (err.code !== '23505') {
          console.warn(`[Fetch] Error processing item "${title.slice(0, 40)}":`, err.message);
        }
      }
    }

    return {
      source: source.name,
      success: true,
      newCount,
      elapsed: Date.now() - start,
    };
  } catch (err: any) {
    return {
      source: source.name,
      success: false,
      newCount: 0,
      error: err.message,
      elapsed: Date.now() - start,
    };
  }
}

export async function fetchAll(): Promise<FetchResult[]> {
  console.log('[Fetch] Starting full fetch...');

  const sourcesRes = await query<Source>(
    `SELECT * FROM sources WHERE enabled = true ORDER BY id`
  );
  const sources = sourcesRes.rows;
  console.log(`[Fetch] ${sources.length} enabled sources`);

  const results: FetchResult[] = [];

  for (const source of sources) {
    console.log(`[Fetch] Fetching ${source.name}...`);
    const result = await fetchSingleSource(source);
    results.push(result);
    console.log(`[Fetch] ${source.name}: ${result.success ? 'OK' : 'FAIL'} (${result.newCount} new, ${result.elapsed}ms)`);
  }

  // 生成热门议题
  console.log('[Fetch] Generating hot topics...');
  await generateHotTopics();

  const totalNew = results.reduce((s, r) => s + r.newCount, 0);
  console.log(`[Fetch] Done. Total new articles: ${totalNew}`);

  return results;
}

// 如果直接运行此脚本
const isMain = process.argv[1]?.endsWith('fetcher.ts');
if (isMain) {
  fetchAll().then((results) => {
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  }).catch((err) => {
    console.error('[Fetch] Fatal:', err);
    process.exit(1);
  });
}
