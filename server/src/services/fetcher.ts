import 'dotenv/config';
import { query } from '../db/index.js';
import { Source, Article } from '../types/index.js';
import { tagArticle } from './tagger.js';
import { calculateHeatScore, getHoursAgo } from './heatScore.js';
import { generateHotTopics } from './hotTopics.js';
import { fetchRisingRepos } from './gitHubHistory.js';
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

async function fetchFeed(url: string, timeoutMs: number = 15000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
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
      const hotScore = calculateHeatScore('opensource', stars, hoursAgo, false, undefined, false, undefined, todayStars);

      try {
        const result = await query<Article>(
          `INSERT INTO articles (source_id, title, url, summary, author, published_at, image_url, hot_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (url) DO UPDATE SET
             hot_score = EXCLUDED.hot_score,
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

/** 抓取 Hugging Face Blog（HTML scraping，feed.xml 的 CloudFront TLS 常被阻断） */
async function fetchHuggingFaceBlog(source: Source): Promise<FetchResult> {
  const start = Date.now();
  try {
    const html = await fetchFeed('https://huggingface.co/blog', 15000);
    if (!html) {
      // 第二尝试：blog 主页也被 TLS 阻断，尝试不同子域名
      const altHtml = await fetchFeed('https://huggingface.co/blog/index.xml', 10000);
      if (!altHtml) {
        return { source: source.name, success: false, newCount: 0, error: 'All HuggingFace URLs failed', elapsed: Date.now() - start };
      }
      // 如果是 xml feed (index.xml 可能包含 Atom 格式)
      const items = await parseRSS(altHtml);
      return processFeedItems(source, items, start);
    }

    const $ = cheerio.load(html);
    const articles: any[] = [];

    // Hugging Face blog 的卡片结构：article.blog-card-article 或 .blog-article-card
    $('article, .blog-card, [class*="blog"]').each((_: any, el: any) => {
      const $el = $(el);
      const linkEl = $el.find('a[href*="/blog/"]').first();
      const href = linkEl.attr('href') || '';
      if (!href || !href.includes('/blog/')) return;

      const fullUrl = href.startsWith('http') ? href : `https://huggingface.co${href}`;
      const title = $el.find('h2, h3, .title, [class*="title"]').first().text().trim();
      if (!title) return;

      const desc = $el.find('p, .description, [class*="desc"]').first().text().trim().slice(0, 500);
      const imgEl = $el.find('img').first();
      const imageUrl = imgEl.attr('src') || '';
      const timeEl = $el.find('time, [datetime]').first();
      const pubDate = timeEl.attr('datetime') || timeEl.text().trim();

      articles.push({ title, link: fullUrl, summary: desc, imageUrl, pubDate });
    });

    // 降级：如果 cheerio 没解析到结果，尝试用简单正则提取
    if (articles.length === 0) {
      const linkRegex = /<a\s+href="(\/blog\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      const seen = new Set<string>();
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const title = cheerio.load(match[0])().text().trim();
        if (!title || seen.has(href)) continue;
        seen.add(href);
        articles.push({
          title,
          link: `https://huggingface.co${href}`,
          summary: '',
          imageUrl: '',
          pubDate: '',
        });
      }
    }

    return processFeedItems(source, articles, start);
  } catch (err: any) {
    return { source: source.name, success: false, newCount: 0, error: err.message, elapsed: Date.now() - start };
  }
}

/** 处理 feed 解析后的条目（插入数据库），共用逻辑 */
async function processFeedItems(source: Source, items: any[], start: number): Promise<FetchResult> {
  let newCount = 0;
  for (const item of items) {
    const title = (item.title || '').trim();
    if (!title) continue;

    let link = item.link || item.id || '';
    if (!link || !/^https?:\/\//.test(link)) continue;

    let summary = (item.summary || item.description || '').trim().slice(0, 500);

    const author = item.author || '';
    const pubDate = item.pubDate || item.published || item.updated || '';
    const imageUrl = item.imageUrl || item.image_url || '';

    try {
      let catForScore: string = source.category;
      if (source.slug === 'huggingface_blog') catForScore = 'huggingface_blog';

      const pubDateObj = pubDate ? new Date(pubDate) : new Date();
      const hoursAgo = getHoursAgo(pubDateObj.toISOString());
      const hasImage = !!imageUrl;
      const hotScore = calculateHeatScore(catForScore, undefined, hoursAgo, hasImage);

      const result = await query<Article>(
        `INSERT INTO articles (source_id, title, url, summary, author, published_at, image_url, hot_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (url) DO UPDATE SET
           hot_score = EXCLUDED.hot_score,
           image_url = CASE WHEN EXCLUDED.image_url <> '' THEN EXCLUDED.image_url ELSE articles.image_url END,
           summary = CASE WHEN articles.summary = '' THEN EXCLUDED.summary ELSE articles.summary END
         RETURNING id`,
        [source.id, title, link, summary, author, pubDateObj.toISOString(), imageUrl, hotScore]
      );

      if (result.rows.length > 0) {
        await tagArticle(result.rows[0].id, `${title} ${summary}`);
        newCount++;
      }
    } catch (err: any) {
      if (err.code !== '23505') {
        console.warn(`[Fetch] Error processing "${title.slice(0, 40)}":`, err.message);
      }
    }
  }
  return { source: source.name, success: true, newCount, elapsed: Date.now() - start };
}

async function fetchSingleSource(source: Source): Promise<FetchResult> {
  const start = Date.now();

  // GitHub Trending 使用 HTML scraper，跳过 RSS
  if (source.slug === 'github_trending') {
    return fetchGitHubTrending(source);
  }

  try {
    // 播客 RSS 通常较大（含历史剧集），给予更长超时
    const timeout = source.category === 'podcast' ? 30000 : 15000;
    let xml = await fetchFeed(source.feed_url, timeout);

    // 主地址失败，尝试备用地址
    if (!xml) {
      const fallbacks: string[] = JSON.parse(source.fallback_urls || '[]');
      for (const fb of fallbacks) {
        xml = await fetchFeed(fb, timeout);
        if (xml) break;
      }
    }

    if (!xml) {
      // Hugging Face Blog: RSS feed TLS 常被 CloudFront 阻断，降级到 HTML scraping
      if (source.slug === 'huggingface_blog') {
        console.log('[Fetch] HuggingFace feed failed, falling back to HTML scraping...');
        return fetchHuggingFaceBlog(source);
      }
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
      // Atom link is an object or array with @_href
      if (Array.isArray(item.link)) {
        const altLink = item.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel']);
        link = altLink?.['@_href'] || item.link[0]?.['@_href'] || link;
      } else if (typeof item.link === 'object' && item.link?.['@_href']) {
        link = item.link['@_href'];
      }
      // 过滤非 URL 的 id（如 tag:xxx 格式）
      if (!link || !/^https?:\/\//.test(link)) continue;

      // 提取摘要
      let summary = stripHTML(extractField(item, 'summary', 'description', 'itunes:summary', 'content:encoded', 'content'));
      // HN 等源的 description 只有评论链接，无实质内容
      if (!summary || summary === 'Comments' || summary === 'Comment') {
        summary = '';
      }
      if (summary.length > 500) summary = summary.slice(0, 500);

      // 提取作者
      const author = extractField(item, 'author', 'dc:creator', 'itunes:author');

      // 提取发布时间
      const pubDate = extractField(item, 'pubDate', 'published', 'published_at', 'updated', 'dc:date');

      // 提取配图
      const imageUrl = extractImage(item);

      // 36氪仅保留 AI 相关文章（过滤财经/股市类噪音）
      if (source.slug === '36kr') {
        // 两层过滤：必须匹配 AI 核心技术词，公司名单独出现不放行
        const aiCore = /AI|人工智能|大模型|机器学习|深度学习|LLM|GPT|ChatGPT|机器人|自动驾驶|芯片|半导体|算法|算力|神经[网路]?|视觉|生成式|AIGC|Agent|多模态|开源|扩散模型|Transformer|Attention|语言模型|自然语言|图像识别|推荐算法|强化学习|机器视觉|语音识别|计算机视觉|NLP|CLIP|VLM|RAG|MoE|知识图谱|文心|通义|混元|盘古|星火|Copilot|AutoGPT|液冷|光模块|prompt|token|embedding|fine.?tun|RLHF|synthetic.?data|sora|midjourney|stable.?diffusion|llama|mistral|claude|gemini|gemma|anthropic|openai|目标检测|语义分割|NER|文本生成|代码生成|图像生成|视频生成|向量数据库|检索增强|推理加速|模型压缩|量化|蒸馏|微调|对齐|agent|function.?call|tool.?use|视觉语言/i;
        const combined = `${title} ${summary}`;
        if (!aiCore.test(combined)) {
          continue; // 跳过非 AI 内容
        }
      }

      // V1.1: Product Hunt AI 内容过滤
      if (source.slug === 'product_hunt') {
        const aiKeywords = /\bAI\b|artificial intelligence|machine learning|LLM|GPT|chatbot|copilot|automation|deep learning|neural|computer vision|NLP|recommendation|predictive|analytics|data science|natural language|transformer|diffusion|embedding|vector|\bRAG\b|agent|pipeline|fine.?tun|rlhf|synthetic|autonomous|vision|speech|text.?to.?|generat|intelligence/i;
        const combined = `${title} ${summary}`;
        if (!aiKeywords.test(combined)) {
          continue; // 跳过非 AI 内容
        }
      }

      // Hacker News AI 内容过滤（仅保留 AI 相关帖子）
      // 使用精确关键词组合，剔除泛词（intelligence/autonomous/vision/analytics 等易误匹配）
      if (source.slug === 'hacker_news') {
        const hnAiKeywords = /(?<!\.)\bAI\b(?!\.)|\bLLM\b|\bGPT\b|\bClaude\b|\bChatGPT\b|\bOpenAI\b|\bAnthropic\b|\bGemini\b|\bLlama\b|\bMistral\b|machine learning|deep learning|neural network|natural language|large language model|reinforcement learning|diffusion model|foundation model|frontier model|transformer|attention|backprop|\bRAG\b|agent|fine.?tun|\bRLHF\b|embedding|token|prompt|inference|synthetic.?data|copilot|codex|open source|self.?driving|autonomous|robotics|humanoid|\bGPU\b|\bCUDA\b|\bH100\b|\bA100\b|PyTorch|TensorFlow|\bJAX\b|Hugging.?Face|OpenAI|Anthropic|Google.*AI|Meta.*AI|Sora|Midjourney|Stable.?Diffusion|\bGAN\b|computer vision|object.?detection|image.?generation|text.?generation|code.?generation|speech.?recognition|text.?to.?speech|vector.*db|knowledge.*graph|semantic.*search|data.?center|compute|inference.*cost/i;
        const combined = `${title} ${summary}`;
        if (!hnAiKeywords.test(combined)) {
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
        if (source.slug === 'product_hunt') catForScore = 'product_hunt';
        if (source.slug === 'hacker_news') catForScore = 'hacker_news';
        if (source.slug === 'openai_blog') catForScore = 'openai_blog';
        if (source.slug === 'google_ai_blog') catForScore = 'google_ai_blog';
        if (source.slug === 'huggingface_blog') catForScore = 'huggingface_blog';

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

  // 新锐榜：每次抓取同步更新
  console.log('[Fetch] Fetching rising repos...');
  await fetchRisingRepos();

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
