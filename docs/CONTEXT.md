# Session Context

最后更新：2026-06-05

> 维护方式：每次结束一段工作或切换任务时，Claude 更新此文件。
> 目的是在会话中断（关机、关窗口、超时压缩）后快速恢复上下文。

---

## 当前状态

- **V1.1.1 已发布上线**（2026-06-04 部署），**V1.1.1 hotfix 已部署**（2026-06-05）
- 修复了翻译引擎切换（百度→腾讯 TMT）、数据源打散排序、GitHub Trending 排序霸榜、热度评分偏低、前端默认排序等线上问题
- 翻译功能已自动暂停（腾讯 TMT 月度额度耗尽），等待 7/1 重置
- 对应文档均已更新（PRD、RELEASE_NOTES、RETROSPECTIVE、CONTEXT）

---

## 已完成

### 2026-06-05 V1.1.1 翻译热修复（续）
- **配额存储迁移**：`translation_quota.json`（Render 临时文件系统）→ PostgreSQL `translation_usage` 表
- **Schema 修复**：注释掉每次部署重置 `''→NULL` 的 UPDATE 语句
- **分级策略收紧**：≥80 全翻, ≥60 仅标题, <60 跳过（原 ≥65/≥40）
- **官方博客降级**：openai/google/huggingface 博客改为仅翻标题（原为全翻）
- **自动暂停**：检测到"used up"/"free amount"错误时自动 `setTranslationPaused(true)`
- **队列上限**：单次运行最多处理 400 条，每条前检查 `isQuotaExhausted()`
- **管理员开关**：Admin 页面翻译状态卡片（运行中/已暂停 + 用量进度条 + 暂停/恢复按钮）
- **状态持久化**：`paused` 列写入 DB，永不自动重置，仅管理员手动修改

### 2026-06-04 V1.1.1 热修复
- **翻译引擎切换**：百度翻译（额度耗尽）→ 腾讯云 TMT SDK
- **分级翻译策略**：`decideTranslationScope()` — hotScore ≥65 全翻, ≥40 仅标题, <40 跳过；官方博客全翻，HN 仅标题
- **API 限速**：腾讯 TMT 5 req/s 限制，330ms 间隔
- **字符配额管理**：月度 4,500,000 字符上限，`translation_quota.json` 持久化
- **数据源打散排序**：`diversifyBySource()` 贪心算法，windowSize=3, penalty=18
- **Github Trending 修复**：移除 UPSERT 中 published_at 更新
- **热度评分上调**：gitHubBase 全面上调，今日星数加成（+15 cap）
- **前端默认排序**：默认"最新情报"，中文筛选默认关闭，localStorage 持久化
- **环境变量变更**：TENCENT_SECRET_ID/KEY/REGION 代替 BAIDU_TRANSLATE_APPID/KEY

### 2026-06-03 代码质量修复（已部署）
- `translator.ts`: 删除未使用的 `REFILL_MONTHLY_CHARS`，添加 Render Ephemeral 文件系统注释
- `heatScore.ts`: `reheatAll()` N+1 改为批量 GROUP BY 查询；新增 `decayPinnedPosts()` 函数
- `admin.ts`: PATCH 编辑标题/摘要后触发异步翻译队列
- `index.ts`: 三个 cron 变量在 `gracefulShutdown` 时调用 `.stop()`
- `index.ts` (startup): 启动路径增加 `decayPinnedPosts()`，部署重启后立即生效
- `index.ts` (cron + startup): 定时抓取和启动时均执行置顶热度衰减

### 2026-06-02 V1.1 正式发布
- 英文自动翻译（百度 API 初版）、GitHub 历史仓库（常青榜+新锐榜）、爆料编辑/预览/前端验证
- 新增 5 个 RSS 数据源（Product Hunt、Hacker News、OpenAI Blog、Google AI Blog、HuggingFace Blog）
- 管理员置顶机制（衰减 99→95→90→85→普通）
- 热度评分平衡（5 轮调参定稿）
- 多项 bug 修复

---

## 待办

暂无明确的下一步任务。候选方向：

- [ ] V1.2 功能规划（如有）
- [ ] 监控线上运行稳定性
- [ ] 观察腾讯 TMT 月度配额使用情况

---

## 关键结论

### 热度评分公式（V1.1.1 最终定稿）
```
score = min(round(base × recency_boost + bonus), 100)
```
- **GitHub stars 分档**: <100→35, <500→42, <2K→50, <10K→55, <50K→60, <100K→65, ≥100K→70
- **今日星数加成**: todayStars/10, 上限+15
- **各源 base**: paper=40, news=55, 36kr=50, podcast=60, sv101=50, admin=75, PH=55, HN=50, blogs=65, default=40
- **recency_boost**: ≤12h×1.5, ≤24h×1.3, ≤48h×1.1, >48h×1.0
- **bonus**: 有图+3, ≥3 标签+3
- **常青榜封顶**: 70°C（insertRepo + scoreArticle + reheatAll 三路覆盖）
- **置顶衰减**: 12h=99, 24h=95, 48h=90, 72h=85, 之后普通 admin base

### 排序策略
```sql
-- 高热模式：得分降序（含数据源打散）
ORDER BY hot_score DESC, is_pinned DESC, pinned_at DESC NULLS LAST, published_at DESC
-- 打散：diversifyBySource(articles, windowSize=3, penalty=18) 在后端应用

-- 最新情报模式：纯时间倒序
ORDER BY published_at DESC
```

### 数据源打散算法
```
diversifyBySource(articles, windowSize=3, penalty=18)
→ 贪心选择，滑动窗口追踪同源，penalty=18 降权有效分
→ 仅 filter=hot 模式生效
```

### 翻译分级策略
```
decideTranslationScope(title, summary, hotScore, sourceSlug):
  hotScore ≥ 80 → 标题 + 摘要全翻
  hotScore ≥ 60 → 仅翻译标题
  hotScore < 60 → 跳过

  官方博客（openai/google/huggingface）→ 仅翻译标题（v1.1.1 收紧）
  Hacker News → 仅标题（无视热度）
```

### 翻译引擎
- 腾讯云 TMT SDK（`tencentcloud-sdk-nodejs-tmt`），非百度翻译
- 限速 330ms/req（5 req/s 限制）
- 月度配额 4,500,000 字符，低于 200 停止
- 配额存储：PostgreSQL `translation_usage` 表，部署不丢失
- 自动暂停：API 返回额度耗尽错误时自动暂停
- 管理员开关：Admin 页面可手动暂停/恢复，状态持久化到 DB

### 翻译 NULL 语义
- `NULL` = 未处理（队列扫描）
- `''` = 已处理但无需翻译（跳过）
- 非空 = 已翻译
- ⚠️ `paused` 列（DB）：`true` = 暂停，永不自动重置为 `false`

### 正则规范
- 短关键词（≤4 字符）必须加 `\b` word boundary
- `.ai` 域名用 `(?<!\.)\bAI\b(?!\.)` 排除 TLD 误匹配
- 英文环境过滤用精准关键词（模型名+公司名），不用描述性泛词

### 部署架构
- 前端: Vercel + 自定义域名 `sr.miko-ai.cn`
- 后端: Render Web Service + UptimeRobot 保活
- 数据库: Supabase PostgreSQL
- CORS: `localhost:5173`, `localhost:3001`, `sr.miko-ai.cn`

### GitHub Trending 注意事项（V1.1.1 修复）
- **published_at 不再随 UPSERT 更新**，避免排序永久置顶
- 仅首次入库记录发布时间
- ON CONFLICT DO UPDATE 仅更新 hot_score / image_url / summary

### 环境变量（V1.1.1）
- `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` / `TENCENT_REGION`（翻译，代替 BAIDU 变量）
- `GITHUB_TOKEN`（GitHub Search API）
- `ADMIN_TOKEN`（管理鉴权）
- `DATABASE_URL`（Supabase PostgreSQL）
