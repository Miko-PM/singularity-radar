import { tmt } from 'tencentcloud-sdk-nodejs-tmt';
import { query } from '../db/index.js';
import fs from 'fs';
import path from 'path';

// ── CJK 检测 ──

/** 统计文本中 CJK 汉字字符占比（0~1） */
export function cjkRatio(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  if (!cjk) return 0;
  return cjk.length / text.length;
}

/** CJK 占比 > 15% 视为中文内容，跳过翻译 */
export function isChineseContent(text: string): boolean {
  return cjkRatio(text) > 0.15;
}

// ── 腾讯翻译 API（TMT SDK）──

const TENCENT_REGION = process.env.TENCENT_REGION || 'ap-guangzhou';
const TENCENT_ENDPOINT = 'tmt.tencentcloudapi.com';

let tmtClient: InstanceType<typeof tmt.v20180321.Client> | null = null;

function getTmtClient() {
  if (tmtClient) return tmtClient;
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) {
    console.warn('[Translator] TENCENT_SECRET_ID or TENCENT_SECRET_KEY not set');
    return null;
  }
  tmtClient = new tmt.v20180321.Client({
    credential: { secretId, secretKey },
    region: TENCENT_REGION,
    profile: { httpProfile: { endpoint: TENCENT_ENDPOINT } },
  });
  return tmtClient;
}

// 腾讯 API 限制 5次/秒，这里控制在 3次/秒（留足余量）
const MIN_INTERVAL_MS = 330; // 1000ms / 3 ≈ 330ms
let lastApiCallTime = 0;

async function rateLimitedTranslate(client: InstanceType<typeof tmt.v20180321.Client>, text: string): Promise<string | null> {
  const now = Date.now();
  const elapsed = now - lastApiCallTime;
  const wait = Math.max(0, MIN_INTERVAL_MS - elapsed);
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastApiCallTime = Date.now();

  try {
    const resp = await client.TextTranslate({
      SourceText: text,
      Source: 'en',
      Target: 'zh',
      ProjectId: 0,
    });
    return resp.TargetText ?? null;
  } catch (err: any) {
    console.warn(`[Translator] Tencent API error: ${err.message}`);
    return null;
  }
}

/** 对文本数组执行翻译（单条依次调用腾讯 API，带限速） */
export async function translateBatch(texts: string[]): Promise<(string | null)[]> {
  const client = getTmtClient();
  if (!client) {
    return texts.map(() => null);
  }

  // 过滤空文本
  const nonEmpty = texts.filter(t => t.length > 0);
  if (nonEmpty.length === 0) return texts.map(() => null);

  // 逐条翻译（腾讯 SDK 不支持批量接口，单条支持 6000 字符）
  const results: (string | null)[] = [];
  for (const text of nonEmpty) {
    const translated = await rateLimitedTranslate(client, text);
    results.push(translated);
  }

  // 映射回原始顺序（含空文本占位）
  let idx = 0;
  return texts.map(t => t.length > 0 ? (results[idx++] ?? null) : null);
}

// ── 月度翻译用量追踪（持久化到文件，防止重启丢失） ──

interface MonthlyUsage {
  month: string;   // "2026-06"
  chars: number;
  calls: number;
}

// 用量存本地磁盘，Render 重启会重置（Ephemeral Filesystem）
// 腾讯 API 服务端也有独立计数，本地文件仅用于提前自我限制
const QUOTA_FILE = path.resolve(process.cwd(), 'data', 'translation_quota.json');
const MAX_MONTHLY_CHARS = 4_500_000;  // 腾讯免费 5M/月，留 10% 余量
const MIN_REMAINING_CHARS = 200;      // 剩余不足时提前停止，避免无意义循环

/** 从磁盘加载本月用量 */
function loadMonthlyUsage(): MonthlyUsage {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const raw = fs.readFileSync(QUOTA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // 文件损坏等，重置
  }
  return { month: '', chars: 0, calls: 0 };
}

/** 保存月度用量到磁盘 */
function saveMonthlyUsage(usage: MonthlyUsage): void {
  try {
    const dir = path.dirname(QUOTA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(usage), 'utf-8');
  } catch (err: any) {
    console.warn(`[Translator] Failed to save quota: ${err.message}`);
  }
}

/** 获取当月已用量（懒加载） */
function getOrInitMonthlyUsage(): MonthlyUsage {
  const usage = loadMonthlyUsage();
  const thisMonth = new Date().toISOString().slice(0, 7); // "2026-06"
  if (usage.month !== thisMonth) {
    usage.month = thisMonth;
    usage.chars = 0;
    usage.calls = 0;
    saveMonthlyUsage(usage);
  }
  return usage;
}

/** 检查翻译配额，成功则扣减并返回 true，超限返回 false */
function checkAndDeductQuota(texts: string[]): boolean {
  const totalChars = texts.reduce((s, t) => s + t.length, 0);
  if (totalChars === 0) return true; // 无字符无需扣减

  const usage = getOrInitMonthlyUsage();

  if (usage.chars + totalChars > MAX_MONTHLY_CHARS) {
    console.warn(
      `[Translator] Monthly quota exhausted (${usage.chars}/${MAX_MONTHLY_CHARS}), ` +
      `remaining articles will retry next month`
    );
    // 注意：不标记文章已翻译，下月配额重置后会自动重试
    return false;
  }

  usage.chars += totalChars;
  usage.calls += 1;
  saveMonthlyUsage(usage);
  return true;
}

/** 当月配额是否已耗尽 */
function isQuotaExhausted(): boolean {
  return getOrInitMonthlyUsage().chars >= MAX_MONTHLY_CHARS;
}

/** 获取本月翻译用量统计 */
export function getTranslationStats(): { month: string; chars: number; calls: number; limit: number } {
  const usage = getOrInitMonthlyUsage();
  return { ...usage, limit: MAX_MONTHLY_CHARS };
}

/** 按来源/热度分层决策是否需要翻译以及翻译哪些字段 */
function decideTranslationScope(
  title: string, summary: string,
  hotScore: number, sourceSlug: string
): { translateTitle: boolean; translateSummary: boolean } {
  const isEngTitle = !!title && !isChineseContent(title);
  const isEngSummary = !!summary && !isChineseContent(summary);

  // 官方博客：全译
  if (['openai_blog', 'google_ai_blog', 'huggingface_blog'].includes(sourceSlug)) {
    return { translateTitle: isEngTitle, translateSummary: isEngSummary };
  }
  // Hacker News：只翻标题
  if (sourceSlug === 'hacker_news') {
    return { translateTitle: isEngTitle, translateSummary: false };
  }
  // 按热度分层
  if (hotScore >= 65) {
    return { translateTitle: isEngTitle, translateSummary: isEngSummary };
  }
  if (hotScore >= 40) {
    return { translateTitle: isEngTitle, translateSummary: false };
  }
  // < 40：跳过
  return { translateTitle: false, translateSummary: false };
}

/** 检测是否需要翻译，若需要则调用 API */
async function translateArticle(
  id: number,
  title: string,
  summary: string,
  hotScore: number = 0,
  sourceSlug: string = ''
): Promise<{ titleZh: string | null; summaryZh: string | null }> {
  // ── GitHub owner/repo 特殊格式 ──
  // 标题（owner/repo）不翻译，摘要按热度分层
  if (/^[\w.-]+\/[\w.-]+$/.test(title.trim())) {
    const scope = decideTranslationScope(title, summary, hotScore, sourceSlug);
    let summaryZh: string | null = null;

    if (scope.translateSummary) {
      if (!checkAndDeductQuota([summary])) {
        return { titleZh: null, summaryZh: null };
      }
      const results = await translateBatch([summary]);
      summaryZh = results[0];
    }

    // 总是标记 title_zh 避免重复扫描
    const setFields: string[] = ['title_zh = $1'];
    const setParams: any[] = [''];
    let idx = 2;

    if (summaryZh !== null) {
      setFields.push(`summary_zh = $${idx++}`);
      setParams.push(summaryZh);
    } else if (!summary || isChineseContent(summary) || !scope.translateSummary) {
      // 空 / 中文 / 被分层跳过 → 标记为已处理
      setFields.push(`summary_zh = $${idx++}`);
      setParams.push('');
    }
    // 翻译失败 → 不设 summary_zh → 留空下次重试

    setParams.push(id);
    await query(
      `UPDATE articles SET ${setFields.join(', ')} WHERE id = $${idx}`,
      setParams
    );

    return { titleZh: null, summaryZh };
  }

  // ── 常规文章 ──
  const { translateTitle, translateSummary } = decideTranslationScope(
    title, summary, hotScore, sourceSlug
  );

  if (!translateTitle && !translateSummary) {
    // 标记为已处理（写入空字符串避免重复扫描）
    const setFields: string[] = [];
    const setParams: any[] = [];
    let idx = 1;

    if (title) {
      setFields.push(`title_zh = $${idx++}`);
      setParams.push('');
    }
    if (summary) {
      setFields.push(`summary_zh = $${idx++}`);
      setParams.push('');
    }
    if (setFields.length > 0) {
      setParams.push(id);
      await query(
        `UPDATE articles SET ${setFields.join(', ')} WHERE id = $${idx}`,
        setParams
      );
    }
    return { titleZh: null, summaryZh: null };
  }

  // 检查当月翻译限额
  const toTranslate: string[] = [];
  if (translateTitle) toTranslate.push(title);
  if (translateSummary) toTranslate.push(summary);

  if (!checkAndDeductQuota(toTranslate)) {
    return { titleZh: null, summaryZh: null };
  }

  const results = await translateBatch(toTranslate);

  let titleZh: string | null = null;
  let summaryZh: string | null = null;

  if (translateTitle) {
    titleZh = results[0];
  }
  if (translateSummary) {
    summaryZh = translateTitle ? results[1] : results[0];
  }

  // 写入数据库
  const setFields: string[] = [];
  const setParams: any[] = [];
  let idx = 1;

  // 标题：翻译成功则写入，翻译失败留 NULL 重试，被分层跳过则标记已处理
  if (titleZh !== null) {
    setFields.push(`title_zh = $${idx++}`);
    setParams.push(titleZh);
  } else if (translateTitle) {
    // 翻译失败，留空下次重试
  } else if (title) {
    setFields.push(`title_zh = $${idx++}`);
    setParams.push('');
  }

  // 摘要：同上
  if (summaryZh !== null) {
    setFields.push(`summary_zh = $${idx++}`);
    setParams.push(summaryZh);
  } else if (!translateSummary && summary) {
    setFields.push(`summary_zh = $${idx++}`);
    setParams.push('');
  }
  // 翻译失败 → 不设 summary_zh → 留空下次重试

  if (setFields.length > 0) {
    setParams.push(id);
    await query(
      `UPDATE articles SET ${setFields.join(', ')} WHERE id = $${idx}`,
      setParams
    );
  }

  return { titleZh, summaryZh };
}

// ── 异步翻译队列 ──

let queueRunning = false;

/** 扫描未翻译文章，按热度高低依次翻译（异步，不阻塞主流程） */
export async function runTranslationQueue(): Promise<void> {
  if (queueRunning) {
    console.log('[Translator] Queue already running, skipping');
    return;
  }

  // 先检查当月配额是否已耗尽（含最小剩余量检查）
  const usage = getOrInitMonthlyUsage();
  if (usage.chars >= MAX_MONTHLY_CHARS) {
    console.log(`[Translator] Monthly quota used up (${usage.chars}/${MAX_MONTHLY_CHARS}), queue skipped`);
    return;
  }
  if (MAX_MONTHLY_CHARS - usage.chars < MIN_REMAINING_CHARS) {
    console.log(`[Translator] Remaining quota too small (<${MIN_REMAINING_CHARS} chars), queue skipped`);
    return;
  }

  queueRunning = true;
  const start = Date.now();
  let translated = 0;
  let skipped = 0;

  try {
    // 分批处理，每次取 40 条，按热度降序排列
    const BATCH_SIZE = 40;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await query<{
        id: number;
        title: string;
        summary: string;
        hot_score: number;
        source_slug: string;
      }>(
        `SELECT a.id, a.title, a.summary, a.hot_score, s.slug AS source_slug
         FROM articles a
         JOIN sources s ON a.source_id = s.id
         WHERE a.title_zh IS NULL OR a.summary_zh IS NULL
         ORDER BY a.hot_score DESC, a.id ASC
         LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );

      const articles = res.rows;
      if (articles.length === 0) {
        hasMore = false;
        break;
      }

      for (const article of articles) {
        // 每翻译一条前检查配额，用完后立即停止本轮队列
        if (isQuotaExhausted()) {
          console.log(`[Translator] Quota exhausted mid-batch, stopping queue`);
          hasMore = false;
          break;
        }

        const result = await translateArticle(article.id, article.title, article.summary, article.hot_score, article.source_slug);
        if (result.titleZh !== null || result.summaryZh !== null) {
          translated++;
        } else {
          skipped++;
        }
      }

      offset += BATCH_SIZE;

      // 避免单次运行太久，最多处理 400 条
      if (offset >= 400) {
        console.log(`[Translator] Reached max 400 articles per run, will continue next time`);
        hasMore = false;
      }
    }

    const elapsed = Date.now() - start;
    const stats = getTranslationStats();
    console.log(`[Translator] Done: ${translated} translated, ${skipped} skipped (${elapsed}ms)`);
    console.log(`[Translator] Monthly usage: ${stats.chars}/${stats.limit} chars (${stats.calls} calls)`);
  } catch (err: any) {
    console.error(`[Translator] Queue error: ${err.message}`);
  } finally {
    queueRunning = false;
  }
}
