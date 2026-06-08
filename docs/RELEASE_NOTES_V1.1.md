# Singularity Radar V1.1 发布说明

**发布日期：** 2026-06-02（V1.1）/ 2026-06-04（V1.1.1）/ 2026-06-05（V1.1.2）
**版本：** v1.1.2（server + client）

---

## 概述

V1.1 是 Singularity Radar 的第一个功能迭代版本，围绕"内容国际化、数据广度增强、管理体验提升、热度评分平衡"四个方向进行增强。

V1.1.1 是热修复版本，重点解决：翻译引擎切换（百度→腾讯）、数据源打散排序、GitHub Trending 排序霸榜、热度评分偏低、前端默认排序等线上问题。

V1.1.2 是翻译专项修复版本，重点解决：配额存储迁移（Render 临时文件系统 → PostgreSQL）、分级策略收紧（≥80/≥60）、自动暂停 + 管理员开关、Schema 幂等修复。

---

## 新增功能（V1.1）

### 英文内容自动翻译（初版：百度翻译 API）
- 接入百度翻译 API，非中文标题/摘要（CJK ≤ 15%）自动翻译为中文
- 异步队列批量处理，单次最多 6000 字符，不阻塞主抓取流程
- 翻译失败时保留原文，下次队列重试
- 前端优先展示翻译版（`title_zh` / `summary_zh`），点击卡片跳转原文

### GitHub 历史热门 AI 仓库
- **常青榜**：Top 20-30 经典高星 AI 项目（GitHub Search API 双通道搜索），每周增量更新，封顶 70°C
- **新锐榜**：近 30 天 star 增量最快的 AI 项目，每次抓取同步更新

### 管理员置顶机制
- 支持置顶/取消置顶爆料文章，置顶卡片带红色"置顶"角标
- 置顶热度随时间衰减：99°C（12h）→ 95°C（24h）→ 90°C（48h）→ 85°C（72h）→ 普通评分

### 爆料编辑/预览/验证
- PATCH `/api/admin/articles/:id` 编辑已发布爆料（标题/URL/摘要/标签/配图/分类）
- 管理表单实时渲染卡片预览，所见即所得
- 前端实时校验必填字段和 URL 格式，错误提示即时显示

### 新增 5 个 RSS 数据源
| 数据源 | 类型 | 接入方式 | 说明 |
|--------|------|---------|------|
| Product Hunt | AI 工具 | RSS 2.0 | AI 关键词白名单过滤 |
| Hacker News | 技术社区 | Atom feed | AI 关键词过滤 + 空摘要清理 |
| OpenAI Blog | 官方博客 | RSS | 第一手动向 |
| Google AI Blog | 官方博客 | Atom | Google AI 官方动态 |
| HuggingFace Blog | 官方博客 | RSS | 开源 AI 社区核心生态 |

---

## 变更（V1.1）

### 热度评分平衡调整（V1.1 acceptance 最终定稿）
- **GitHub 星数分档整体降 5 分**（≤100→20, 500→40, 2K→45, 10K→50, 50K→55, 100K→60），减少 GitHub 霸占首页
- **图片/标签加分收窄**：+5 → +3
- **各源 base 微调**：news=55, podcast=60, 36kr/sv101=50, official blog=65, HN=50, PH=55
- **长青榜封顶 70°C**（抓取 + 单篇重算 + 批量重算三路覆盖）

### API 排序策略
- `ORDER BY hot_score DESC, is_pinned DESC, pinned_at DESC NULLS LAST, published_at DESC`

### 数据源内容质量增强
- Hacker News 新增 AI 关键词过滤（正则 `(?<!\.)\bAI\b(?!\.)` 避免 .ai TLD 误匹配）
- 36氪/Product Hunt AI 过滤正则统一增强（`\bAI\b` / `\bRAG\b` 避免子串误匹配）
- Hacker News 空摘要处理：RSS 中 summary 仅含 "Comments" 时置为空

### 数据库
- `articles` 表新增：`title_zh` / `summary_zh`（翻译）、`is_pinned` / `pinned_at`（置顶）

### 环境变量
- 新增：`BAIDU_TRANSLATE_APPID`、`BAIDU_TRANSLATE_KEY`、`GITHUB_TOKEN`

---

## 修复（V1.1）

- 置顶贴热度不衰减：`PATCH` 置顶后触发 `scoreArticle()` 重算热度
- 置顶贴排序问题：`ORDER BY` 增加置顶 tiebreaker 确保置顶在前
- 长青榜封顶未覆盖批量重算：`reheatAll()` 和 `scoreArticle()` 均增加 evergreen cap
- 36氪非 AI 内容泄漏：数据库清除 139 条财经噪音数据，增强过滤正则

---

## V1.1.1 热修复（2026-06-04）

### 翻译引擎切换：百度 → 腾讯云 TMT

**背景：** 百度翻译免费额度 850,000 字符/月在 4 天内耗尽（实际使用 849,994/850,000），运维压力大。

**变更内容：**
- 移除百度翻译 SDK（`crypto.createHash` + HTTP 签名），使用 `tencentcloud-sdk-nodejs-tmt` SDK
- 新增腾讯云 TMT 翻译调用函数 `rateLimitedTranslate()`
- 腾讯 TMT 5 req/s 限制 → 客户端 330ms 间隔限速
- 环境变量变更：移除 `BAIDU_TRANSLATE_APPID` / `BAIDU_TRANSLATE_KEY`，新增 `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` / `TENCENT_REGION`

### 分级翻译策略（成本优化）

**背景：** 全量翻译消耗过大，按内容价值分级调用，优先覆盖高质量内容。

**实现方式：** `decideTranslationScope(title, summary, hotScore, sourceSlug)`

| hotScore | 范围 | 说明 |
|----------|------|------|
| ≥ 80 | 翻译标题 + 摘要 | 高价值内容全翻（v1.1.2 收紧） |
| 60-80 | 仅翻译标题 | 中等价值保底（v1.1.2 收紧） |
| < 60 | 跳过 | 低热度不翻（v1.1.2 收紧） |

**数据源覆盖规则：**
- 官方博客：仅翻译标题（v1.1.2 收紧，原为全翻）
- Hacker News：仅翻译标题
- 其他源：按 hotScore 分级

**配额管理：**
- 月度上限：4,500,000 字符
- 安全阈值：低于 200 字符时停止翻译
- **持久化（v1.1.2）**：~~`server/data/translation_quota.json`~~ → PostgreSQL `translation_usage` 表，部署不丢失

### 自动暂停 + 管理员开关（v1.1.2）

**背景：** 腾讯 TMT 月度额度耗尽后，队列每 10 分钟空转扫描，消耗无意义；管理员无法快速关闭翻译。

**自动暂停：**
- `rateLimitedTranslate()` 捕获 "used up" / "free amount" 错误
- 自动调用 `setTranslationPaused(true)`，写入 DB `paused` 列
- 暂停后 `runTranslationQueue()` 直接跳过扫描
- 状态永不自动重置

**管理员开关：**
- Admin 页面新增翻译状态卡片（运行中/已暂停 + 用量进度条）
- `GET /api/admin/translator/status` 返回 `{ month, chars, calls, limit, paused }`
- `POST /api/admin/translator/toggle` 接收 `{ paused: boolean }`
- 金色主题按钮，与现有管理 UI 风格一致

**队列保护：**
- 每条翻译前检查 `isQuotaExhausted()`，耗尽立即停止
- 单次运行上限 400 条

### 数据源打散排序

**背景：** 热点模式下同一数据源文章连续排列（GitHub 仓库扎堆前三页）。

**实现方式：** `diversifyBySource(articles, windowSize=3, penalty=18)`

- 贪心选择算法
- 滑动窗口（长度 3）追踪最近选中的数据源
- 窗口中已存在的源 → 有效分 = `hot_score - 18`
- 每次选有效分最高的未选文章
- 仅生效于"高热爆料"（filter=hot）模式

**效果：** 前 25 条覆盖 6+ 不同数据源，不再单一源霸榜。

### GitHub Trending 排序霸榜修复

**根因：** `INSERT ... ON CONFLICT (url) DO UPDATE` 中的 `published_at = EXCLUDED.published_at` 导致 GitHub Trending 仓库每次抓取把发布时间刷为最新。

**修复：** 移除 UPSERT 中的 `published_at = EXCLUDED.published_at`，仅首次入库记录发布时间。

### 热度评分上调

| 分档 | V1.1 | V1.1.1 |
|------|------|--------|
| ★ < 100 | 20 | 35 |
| ★ < 500 | 30 | 42 |
| ★ < 2000 | 40 | 50 |
| ★ < 10000 | 45 | 55 |
| ★ < 50000 | 50 | 60 |
| ★ < 100000 | 55 | 65 |
| ★ ≥ 100000 | 60 | 70 |

**新增今日星数加成：** `todayStars / 10`，上限 +15。如 20★ 仓库今日新增 50★ → base = 35 + 5 = 40°C。

### 前端默认排序调整

- 默认排序：从"高热爆料"改为"最新情报"
- 中文筛选：默认关闭（原默认开启）
- 用户偏好持久化：排序方式和中文开关均存入 `localStorage`

---

## 数据源完整清单（12 个）

| # | 数据源 | 类别 | 状态 |
|---|--------|------|------|
| 1 | GitHub Trending | 开源项目 | ✅ |
| 2 | GitHub 常青榜 | 开源项目 | ✅ 新增 |
| 3 | GitHub 新锐榜 | 开源项目 | ✅ 新增 |
| 4 | arXiv cs.AI | 论文 | ✅ |
| 5 | 36氪 | AI 资讯 | ✅ AI 过滤 |
| 6 | 雷峰网 | AI 资讯 | ✅ |
| 7 | Lenny's Podcast | 播客 | ✅ |
| 8 | 硅谷101 | 播客 | ✅ |
| 9 | Product Hunt | AI 工具 | ✅ 新增 |
| 10 | Hacker News | 技术社区 | ✅ 新增 |
| 11 | OpenAI Blog | 官方博客 | ✅ 新增 |
| 12 | Google AI Blog | 官方博客 | ✅ 新增 |
| 13 | HuggingFace Blog | 官方博客 | ✅ 新增 |
| — | 机器之心 | AI 资讯 | ❌ 已禁用 |

---

## 部署信息

- **前端**：Vercel（`https://sr.miko-ai.cn/`）
- **后端**：Render（`https://singularity-radar-api.onrender.com`）
- **数据库**：Supabase PostgreSQL
- **保活监控**：UptimeRobot（每 5 分钟 ping `/api/health`）

### 所需环境变量
```
# Database
DATABASE_URL          # Supabase PostgreSQL

# Auth
ADMIN_TOKEN           # 管理员鉴权

# Translation (V1.1.1: 腾讯云 TMT replacing Baidu)
TENCENT_SECRET_ID     # 腾讯云 SecretId
TENCENT_SECRET_KEY    # 腾讯云 SecretKey
TENCENT_REGION        # 腾讯云地域 (ap-beijing / ap-guangzhou 等)

# GitHub API
GITHUB_TOKEN          # GitHub Search API 认证

# Server
PORT=3001
NODE_ENV=production
```
