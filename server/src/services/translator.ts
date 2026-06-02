import { createHash } from 'crypto';
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

// ── 百度翻译 API ──

const BAIDU_API = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

interface BaiduTransResult {
  src: string;
  dst: string;
}

interface BaiduResponse {
  from: string;
  to: string;
  trans_result: BaiduTransResult[];
  error_code?: string;
  error_msg?: string;
}

/** 对文本数组执行批量翻译（百度 API 单次最多 6000 字符） */
export async function translateBatch(texts: string[]): Promise<(string | null)[]> {
  const appid = process.env.BAIDU_TRANSLATE_APPID;
  const key = process.env.BAIDU_TRANSLATE_KEY;

  if (!appid || !key) {
    console.warn('[Translator] BAIDU_TRANSLATE_APPID or BAIDU_TRANSLATE_KEY not set, skipping');
    return texts.map(() => null);
  }

  // 过滤空文本
  const nonEmpty = texts.filter(t => t.length > 0);
  if (nonEmpty.length === 0) return texts.map(() => null);

  // 检查字符总量
  const totalChars = nonEmpty.reduce((s, t) => s + t.length, 0);
  if (totalChars > 6000) {
    console.warn(`[Translator] Batch too large (${totalChars} chars > 6000), splitting...`);
    // 分批处理
    const results: (string | null)[] = [];
    let batch: string[] = [];
    let batchChars = 0;
    for (const t of nonEmpty) {
      if (batchChars + t.length > 6000 && batch.length > 0) {
        const batchResults = await translateBatch(batch);
        results.push(...batchResults);
        batch = [t];
        batchChars = t.length;
      } else {
        batch.push(t);
        batchChars += t.length;
      }
    }
    if (batch.length > 0) {
      const batchResults = await translateBatch(batch);
      results.push(...batchResults);
    }
    return results;
  }

  // 用 \n 拼接多条文本
  const q = nonEmpty.join('\n');
  const salt = Date.now().toString();
  const sign = createHash('md5').update(appid + q + salt + key).digest('hex');

  try {
    const url = `${BAIDU_API}?q=${encodeURIComponent(q)}&from=en&to=zh&appid=${appid}&salt=${salt}&sign=${sign}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json: BaiduResponse = await res.json();
    if (json.error_code) {
      console.warn(`[Translator] API error: ${json.error_code} - ${json.error_msg}`);
      return texts.map(() => null);
    }

    // 映射结果回原始顺序（百度按 \n 分割返回对应顺序的结果）
    const translated = json.trans_result.map(r => r.dst);
    // 如果有空文本跳过，需要重新对齐
    let idx = 0;
    return texts.map(t => t.length > 0 ? (translated[idx++] ?? null) : null);
  } catch (err: any) {
    console.warn(`[Translator] Request failed: ${err.message}`);
    return texts.map(() => null);
  }
}

// ── 月度翻译用量追踪（持久化到文件，防止重启丢失） ──

interface MonthlyUsage {
  month: string;   // "2026-06"
  chars: number;
  calls: number;
}

const QUOTA_FILE = path.resolve(process.cwd(), 'data', 'translation_quota.json');
const MAX_MONTHLY_CHARS = 850_000;  // 百度免费 1M/月，留 15% 余量
const REFILL_MONTHLY_CHARS = 800_000; // 低于此值时触发补量翻译

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
      `next refill at ${REFILL_MONTHLY_CHARS} chars — will retry next month`
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

/** 检测是否需要翻译，若需要则调用 API */
async function translateArticle(
  id: number,
  title: string,
  summary: string
): Promise<{ titleZh: string | null; summaryZh: string | null }> {
  // GitHub owner/repo 格式 — 标题跳过翻译，非空摘要需翻译
  if (/^[\w.-]+\/[\w.-]+$/.test(title.trim())) {
    let summaryZh: string | null = null;

    if (summary && !isChineseContent(summary)) {
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
    } else if (!summary || isChineseContent(summary)) {
      // 空摘要或已是中文 → 标记为已处理
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

  const shouldTranslateTitle = title && !isChineseContent(title);
  const shouldTranslateSummary = summary && !isChineseContent(summary);

  if (!shouldTranslateTitle && !shouldTranslateSummary) {
    // 标记为已处理（写入空字符串避免重复扫描）
    const setFields: string[] = [];
    const setParams: any[] = [];
    let idx = 1;

    if (!shouldTranslateTitle) {
      setFields.push(`title_zh = $${idx++}`);
      setParams.push('');
    }
    if (!shouldTranslateSummary) {
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
  if (shouldTranslateTitle) toTranslate.push(title);
  if (shouldTranslateSummary) toTranslate.push(summary);

  if (!checkAndDeductQuota(toTranslate)) {
    return { titleZh: null, summaryZh: null };
  }

  const results = await translateBatch(toTranslate);

  let titleZh: string | null = null;
  let summaryZh: string | null = null;

  if (shouldTranslateTitle) {
    titleZh = results[0];
  }
  if (shouldTranslateSummary) {
    summaryZh = shouldTranslateTitle ? results[1] : results[0];
  }

  // 写入数据库
  const setFields: string[] = [];
  const setParams: any[] = [];
  let idx = 1;

  if (titleZh !== null) {
    setFields.push(`title_zh = $${idx++}`);
    setParams.push(titleZh);
  } else if (shouldTranslateTitle) {
    // 翻译失败，留空下次重试
  }

  if (summaryZh !== null) {
    setFields.push(`summary_zh = $${idx++}`);
    setParams.push(summaryZh);
  }

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

  // 先检查当月配额是否已耗尽
  const usage = getOrInitMonthlyUsage();
  if (usage.chars >= MAX_MONTHLY_CHARS) {
    console.log(`[Translator] Monthly quota used up (${usage.chars}/${MAX_MONTHLY_CHARS}), queue skipped`);
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
      }>(
        `SELECT id, title, summary FROM articles
         WHERE title_zh IS NULL OR summary_zh IS NULL
         ORDER BY hot_score DESC, id ASC
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

        const result = await translateArticle(article.id, article.title, article.summary);
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
