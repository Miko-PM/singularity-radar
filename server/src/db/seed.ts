import 'dotenv/config';
import { runSchema, runSeed } from '../db/index.js';
import { loadKeywords } from '../services/tagger.js';
import { fetchAll } from '../services/fetcher.js';

async function seed() {
  console.log('[Seed] Starting...');

  // 1. 建表
  await runSchema();
  console.log('[Seed] Schema applied');

  // 2. 写入初始数据
  await runSeed();
  console.log('[Seed] Seed data inserted');

  // 3. 加载词库
  await loadKeywords();
  console.log('[Seed] Keywords loaded');

  console.log('[Seed] Done. Run `npm run fetch` to fetch articles.');
  process.exit(0);
}

seed().catch(err => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
