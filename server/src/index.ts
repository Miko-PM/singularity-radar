import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runSchema, runSeed } from './db/index.js';
import { loadKeywords } from './services/tagger.js';
import { fetchAll } from './services/fetcher.js';
import { generateHotTopics } from './services/hotTopics.js';
import articlesRouter from './routes/articles.js';
import tagsRouter from './routes/tags.js';
import hotTopicsRouter from './routes/hotTopics.js';
import sourcesRouter from './routes/sources.js';
import adminRouter from './routes/admin.js';
import pool from './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// 中间件
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3001').split(',');
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

// 生产环境：服务前端静态文件（SPA fallback）
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

let server: ReturnType<typeof app.listen>;

// 启动
async function start() {
  try {
    // 数据库初始化
    console.log('[Server] Applying schema...');
    await runSchema();
    console.log('[Server] Loading tag keywords...');
    await loadKeywords();

    // 定时任务：UTC+8 8:00, 12:00, 18:00, 22:00
    const cronTask = cron.schedule('0 0,4,10,14 * * *', async () => {
      console.log('[Cron] Scheduled fetch started...');
      try {
        await fetchAll();
      } catch (err) {
        console.error('[Cron] Fetch error:', err);
      }
    });
    console.log('[Server] Cron scheduled: 8:00, 12:00, 18:00, 22:00 UTC+8');

    // 启动后立即触发首次抓取（串行等待，确保数据就绪后再接受请求）
    console.log('[Server] Initial fetch on startup...');
    try {
      await fetchAll();
      console.log('[Server] Initial fetch complete');
    } catch (err) {
      console.error('[Server] Initial fetch error (non-fatal):', err);
    }

    server = app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Startup error:', err);
    process.exit(1);
  }
}

function gracefulShutdown(signal: string) {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
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
