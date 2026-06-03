import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { runSchema, runSeed } from './db/index.js';
import { loadKeywords } from './services/tagger.js';
import { fetchAll } from './services/fetcher.js';
import { decayPinnedPosts } from './services/heatScore.js';
import { generateHotTopics } from './services/hotTopics.js';
import { runTranslationQueue } from './services/translator.js';
import { fetchEvergreenRepos } from './services/gitHubHistory.js';
import articlesRouter from './routes/articles.js';
import tagsRouter from './routes/tags.js';
import hotTopicsRouter from './routes/hotTopics.js';
import sourcesRouter from './routes/sources.js';
import adminRouter from './routes/admin.js';
import pool from './db/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// 中间件
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3001,https://sr.miko-ai.cn').split(',');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// 健康检查 / API 保活
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 路由
app.use('/api/articles', articlesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/hot-topics', hotTopicsRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/admin', adminRouter);

// 注：前端由 Vercel 独立部署，后端仅提供 API

let server: ReturnType<typeof app.listen>;
let cronTask: ReturnType<typeof cron.schedule> | null = null;
let evergreenCron: ReturnType<typeof cron.schedule> | null = null;
let translateCron: ReturnType<typeof cron.schedule> | null = null;

// 启动
async function start() {
  try {
    // 数据库初始化
    console.log('[Server] Applying schema...');
    await runSchema();
    console.log('[Server] Seeding initial data...');
    await runSeed();
    console.log('[Server] Loading tag keywords...');
    await loadKeywords();

    // 定时任务：UTC+8 8:00, 12:00, 18:00, 22:00（cron 使用 UTC：0,4,10,14 UTC = 8,12,18,22 UTC+8）
    cronTask = cron.schedule('0 0,4,10,14 * * *', async () => {
      console.log('[Cron] Scheduled fetch started...');
      try {
        await fetchAll();
        // 置顶爆料热度衰减
        await decayPinnedPosts();
        // V1.1: 抓取完成后异步执行翻译
        runTranslationQueue();
      } catch (err) {
        console.error('[Cron] Fetch error:', err);
      }
    });
    console.log('[Server] Cron scheduled: 8:00, 12:00, 18:00, 22:00 UTC+8');

    // V1.1: 常青榜每周一 8:00 UTC+8（cron 使用 UTC：0 0 = 周一 0:00 UTC = 8:00 UTC+8）
    evergreenCron = cron.schedule('0 0 * * 1', async () => {
      console.log('[Cron] Weekly evergreen repos fetch...');
      try {
        await fetchEvergreenRepos();
      } catch (err) {
        console.error('[Cron] Evergreen error:', err);
      }
    });
    console.log('[Server] Evergreen cron scheduled: Monday 8:00 UTC+8');

    // V1.1: 翻译队列定时扫描（每 10 分钟）
    translateCron = cron.schedule('*/10 * * * *', async () => {
      runTranslationQueue();
    });
    console.log('[Server] Translation cron scheduled: every 10 min');

    // 先启动服务器接受请求，再异步触发首次抓取（避免阻塞 Render 健康检查）
    server = app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      // 首次抓取：常青榜先于 Rising（避免 Rising 抢先占用 URL）
      fetchEvergreenRepos()
        .then(() => {
          console.log('[Server] Initial evergreen fetch complete');
          return fetchAll();
        })
        .then(() => {
          console.log('[Server] Initial fetch complete');
          // 启动时执行置顶衰减，确保旧置顶贴热度正确
          return decayPinnedPosts();
        })
        .then(() => {
          // V1.1: 首次抓取后异步执行翻译
          runTranslationQueue();
        })
        .catch(err => console.error('[Server] Initial fetch error (non-fatal):', err));
    });
  } catch (err) {
    console.error('[Server] Startup error:', err);
    process.exit(1);
  }
}

function gracefulShutdown(signal: string) {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);

  // 停止定时任务
  cronTask?.stop();
  evergreenCron?.stop();
  translateCron?.stop();

  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed');
      pool.end().then(() => {
        console.log('[Server] DB pool closed');
        process.exit(0);
      });
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
