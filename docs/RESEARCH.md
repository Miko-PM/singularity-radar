# Singularity Radar · 需求研究（最终版）

> 最后更新：2026-06-02（V1.1 规划完成）

## 修订历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v0.1 | 2026-05-27 | Claude | 需求研究初稿 |
| v1.0 | 2026-06-01 | Claude | 正式发布：自定义域名、保活监控、published_at 修复、部署调整 |
| v1.1 | 2026-06-02 | Claude | 英文翻译、GitHub 历史仓库、爆料编辑/预览、新增 RSS 数据源。环境变量新增 BAIDU_TRANSLATE_APPID/KEY、GITHUB_TOKEN |

---

## 产品定位

一个面向 AI 从业者和爱好者的信息聚合平台，每日自动汇集 GitHub 热榜、arXiv 最新论文、AI 资讯和深度播客。不只是聚合链接，更通过**标签体系**和**热门议题聚合**帮助用户构建个人认知体系。

**一句话价值：** 每日自动汇集 GitHub 热榜、AI 论文、行业资讯与深度播客，通过智能标签与热门议题聚合，让 AI 从业者高效掌握行业动态。

**目标用户：** 追求信息效率和认知深度的 AI 专业人士

---

## 竞品分析

### 主要竞品

| 产品 | 定位 | 核心优势 | 潜在短板 | 参考价值 |
|------|------|---------|---------|---------|
| **AI Hot Today** | 广度型"信息雷达" | 50+ AI 信源，24/7 实时更新，DeepSeek 筛选 | 信息深度有限，设计偏工具风 | 信源选取策略参考 |
| **AI Base** | 深度型"决策助手" | 结构化决策支持，多维度对比矩阵 | 覆盖偏窄 | 差异化参照 |
| **PrimeScope** | 中英文全局覆盖 | 30+ 权威信源，AI 摘要 | 暂无深度分析 | 中英双语覆盖思路 |
| **Di.gg (Digg)** | AI 专家影响力追踪 | 追踪 1000 位 AI 大咖关注的动态 | 重度依赖 X API | 大咖视角理念参考 |
| **Horizon** | 开源 AI 新闻雷达 | 4.1k stars，多源聚合，双语简报 | Python 技术栈，需自部署 | 开源架构参考 |

### Singularity Radar 差异化

- **洞察引擎**：不只是链接聚合，通过标签体系和热门议题聚合，穿透信息表层
- **多源覆盖**：从论文到开源到资讯到播客，层层递进
- **大咖视角**：独家聚合 AI 大咖播客和深度访谈内容
- **热门议题**：跨数据源自动聚合同一话题的全貌
- **黑金设计**：暗黑奢华风视觉，区别于大多数工具风竞品

---

## 技术方案

| 层级 | 技术选型 | 备注 |
|------|---------|------|
| 前端框架 | React 19 + Vite 6 + Tailwind CSS v4 | 同一套代码响应式适配 PC/移动端；主题模式通过 CSS 变量 + localStorage 实现 |
| 后端 | Node.js + Express | 轻量 API 服务 |
| 数据库 | PostgreSQL（Supabase 免费版） | 500MB 存储，SSL 连接，与后端分离部署 |
| 定时任务 | node-cron | 内置于后端进程，RSS 抓取顺序执行（非并行） |
| 前端部署 | Vercel（自定义域名） | `https://sr.miko-ai.cn/` |
| 后端部署 | Render（免费版） | 15 分钟无流量休眠，UptimeRobot 保活 |
| 保活监控 | UptimeRobot | 每 5 分钟 ping /api/health，防止服务休眠 |
| 数据获取 | RSS + HTML Scraper | RSS（arXiv/36氪/雷峰网/播客）+ HTML Scraper（GitHub Trending） |

### 数据库说明：PostgreSQL（Supabase 免费版）

- 使用 Supabase 免费版（500MB 存储），内置 PostgreSQL，SSL 连接
- 连接方式：`DATABASE_URL` 环境变量（Supabase 连接池字符串）
- 使用 `pg`（node-postgres）驱动，连接池模式
- **关键约定：RSS 抓取任务顺序执行（非并行）**，避免数据库连接争抢
- V1.0 数据量：每天 4 次抓取，每次 ~50 条，月均 ~6000 条

### 环境变量清单

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADMIN_TOKEN` | 管理员页面鉴权 | 必填，启动时校验 |
| `CACHE_TTL` | 缓存过期时间（小时） | 72 |
| `RSSHUB_BASE` | RSSHub 主实例地址 | `https://rsshub.app` |
| `RSSHUB_FALLBACK` | RSSHub 备用实例 | `https://rsshub.bili.xyz` |
| `PORT` | 后端端口 | 3001 |
| `DATABASE_URL` | Supabase PostgreSQL 连接字符串 | 必填 |
| `NODE_ENV` | 环境模式 | 生产环境为 `production` |
| `BAIDU_TRANSLATE_APPID` | 百度翻译 API AppID（v1.1） | 必填（启用翻译时） |
| `BAIDU_TRANSLATE_KEY` | 百度翻译 API Key（v1.1） | 必填（启用翻译时） |
| `GITHUB_TOKEN` | GitHub Personal Access Token（v1.1） | 可选（未认证 60次/小时，认证后 5000次/小时） |

### API 接口清单

| 方法 | 路径 | 说明 | 鉴权 | 参数 |
|------|------|------|------|------|
| GET | `/api/health` | 健康检查 / 保活 | 无 | — |
| GET | `/api/articles` | 获取文章列表 | 无 | `tab`, `tag`, `filter`, `source`, `lang`, `days`, `page`, `limit` |
| GET | `/api/articles/:id` | 获取文章详情 | 无 | — |
| GET | `/api/tags` | 获取所有标签 | 无 | — |
| GET | `/api/hot-topics` | 获取热门议题聚合 | 无 | — |
| GET | `/api/sources` | 获取数据源状态 | 无 | — |
| POST | `/api/admin/articles` | 管理员录入爆料 | Bearer Token | `title`, `url`, `summary`, `tags`, `category`, `image_url` |
| PATCH | `/api/admin/articles/:id` | 管理员编辑爆料（v1.1） | Bearer Token | title, url, summary, tags, category, image_url |
| POST | `/api/admin/fetch` | 手动触发全量抓取 | Bearer Token | — |
| POST | `/api/admin/retag` | 全量重新打标签 | Bearer Token | — |
| POST | `/api/admin/reheat` | 全量重算热度评分 | Bearer Token | — |
| GET | `/api/admin/stats` | 数据统计概览 | Bearer Token | — |

> 所有接口统一返回 JSON 格式：`{ data: ..., error: ..., pagination: { page, limit, total } }`

---

## 数据源

| 数据源 | 类型 | 获取方式 | 更新频率 | 优先级 | 状态 |
|--------|------|---------|---------|--------|------|
| GitHub Trending | 开源项目 | HTML Scraper | 每日 | P0 | ✅ |
| GitHub 历史热门 AI 仓库（常青榜） | 开源项目 | GitHub Search API | 每周增量更新 | P0 | ✅ v1.1（Top 20-30 经典高星项目）|
| GitHub 历史热门 AI 仓库（新锐榜） | 开源项目 | GitHub Search API | 每次抓取同步更新 | P0 | ✅ v1.1（近 30 天 star 增量最快）|
| arXiv cs.AI | 论文 | 官方 RSS | 每日 | P0 | ✅ |
| 36氪 | AI 资讯 | 官方 RSS（AI 过滤） | 每日 | P0 | ✅ |
| 雷峰网 | AI 资讯 | 官方 RSS | 每日 | P0 | ✅ |
| Lenny's Podcast | 播客 | Substack RSS | 每周数期 | P1 | ✅ |
| 硅谷101 | 播客 | Fireside RSS | 每周 | P1 | ✅ |
| 管理员爆料 | 人工录入 | 管理员表单 | 不定期 | P1 | ✅ |
| Product Hunt | AI 工具 | RSS 2.0（AI 关键词过滤） | 每日 | P0 | ✅ v1.1 |
| Hacker News | 技术社区 | Atom feed | 实时 | P0 | ✅ v1.1 |
| OpenAI Blog | 官方博客 | RSS | 不定期 | P0 | ✅ v1.1 |
| Google AI Blog | 官方博客 | Atom | 不定期 | P0 | ✅ v1.1 |
| Hugging Face Blog | 官方博客 | RSS | 不定期 | P0 | ✅ v1.1 |
| 机器之心 | AI 资讯 | 官方 RSS | 每小时 | P0 | ❌ 已禁用（源不稳定） |

## 部署架构

```
用户 → https://sr.miko-ai.cn/ (Vercel, CDN)
                  ↓
          REST API → https://singularity-radar-api.onrender.com (Render)
                  ↓
            Supabase PostgreSQL

保活: UptimeRobot → 每5分钟 GET /api/health → 保持 Render 服务在线
```

### Render 休眠策略

Render 免费版 15 分钟无流量休眠（冷启动约 30s）。UptimeRobot 保活配置后，服务持续运行：
- 监控地址：`https://singularity-radar-api.onrender.com/api/health`
- 监控频率：每 5 分钟
- 如果保活失效，用户首次访问需要等待冷启动（约 30s）

---

## V1.0 变更记录（自 MVP 以来）

| 变更 | 类型 | 说明 |
|------|------|------|
| 自定义域名 | 部署 | `https://sr.miko-ai.cn/`，Vercel 配置 |
| 保活监控 | 运维 | UptimeRobot 每 5 分钟 ping |
| 数据新鲜度修复 | Bugfix | ON CONFLICT 更新 published_at |
| 数据源调整 | 配置 | 禁用机器之心（不稳定），启用雷峰网 |
| 亮色/暗色主题 | 功能 | CSS 变量 + localStorage |
| 36氪 AI 过滤 | 优化 | 仅保留 AI 相关内容 |

---

## V1.1 变更记录（自 V1.0 以来）

| 变更 | 类型 | 说明 |
|------|------|------|
| 英文内容翻译 | 功能 | 百度翻译 API，异步队列，CJK > 15% 跳过 |
| GitHub 历史热门 AI 仓库 | 功能 | 常青榜（周增量）+ 新锐榜（每次抓取同步），长青榜封顶 70°C |
| 爆料编辑/预览/验证 | 管理 | PATCH API + 实时预览 + 前端校验 |
| 新增 RSS 数据源 | 数据 | Product Hunt、Hacker News、OpenAI Blog、Google AI Blog、HuggingFace Blog |
| 置顶机制 | 功能 | 置顶/取消置顶 + 热度衰减 + 红色角标 |
| 热度评分平衡 | 优化 | GitHub 星数降 5 分，加分收窄 5→3，base 微调 |
| AI 内容过滤增强 | 优化 | HN 新增 AI 过滤，统一 \b 边界正则，HN 空摘要清理 |
| 36氪数据清理 | 运维 | 数据库清除 139 条非 AI 财经噪音 |
| 排序策略 | 变更 | ORDER BY 增加 is_pinned / pinned_at 作为 tiebreaker |

## 风险与约束

1. **RSS 源变更**：上游 RSS 格式变更或限流 → 记录日志，尝试备用地址
2. **Render 休眠**：15 分钟无流量休眠，UptimeRobot 保活可解决
3. **GitHub Trending HTML 结构**：页面改版可能导致 Scraper 失效
4. **数据新鲜度**：连续上榜仓库的 published_at 停滞 → ON CONFLICT 更新已修复
5. **版权合规**：仅展示标题与摘要（< 200 字），点击新窗口跳转原文
6. **翻译 API 限流**：百度翻译 API 免费版有字符上限 → 异步队列重试机制 + CJK 阈值过滤（>15%跳过）减少无效调用
7. **GitHub Search API 限流**：未认证仅 60 次/小时 → 需配置 GITHUB_TOKEN 认证后 5000 次/小时
8. **Product Hunt 内容噪声**：RSS 包含非 AI 品类 → AI 关键词白名单过滤

---

## 成功标准（V1.0）

| # | 标准 | 状态 |
|---|------|------|
| 1 | 所有 P0 数据源成功抓取并展示 | ✅ GitHub + arXiv + 36氪 + 雷峰网 |
| 2 | 播客数据源成功解析 | ✅ Lenny's + 硅谷101 |
| 3 | 响应式 PC/移动端正常浏览 | ✅ |
| 4 | 热门议题自动聚合 | ✅ 每次抓取后生成 |
| 5 | 标签筛选正常 | ✅ |
| 6 | 爆料功能可用 | ✅ |
| 7 | 首屏加载 < 3s | ✅ |
| 8 | 自定义域名可访问 | ✅ `https://sr.miko-ai.cn/` |
| 9 | 保活运行服务持续在线 | ✅ UptimeRobot |
| 10 | 数据新鲜度正确 | ✅ published_at 随抓取更新 |

## 成功标准（V1.1）

| # | 标准 | 状态 |
|---|------|------|
| 1 | 非中文标题/摘要自动翻译为中文，异步队列不阻塞主流程 | ✅ |
| 2 | CJK > 15% 的中英混写文本不触发翻译，≤ 15% 正确翻译 | ✅ |
| 3 | 百度翻译 API 失败时保留原文，异步队列重试 | ✅ |
| 4 | 常青榜 Top 20-30 高星 AI 仓库入库，与新锐榜分区展示 | ✅ 长青榜封顶 70°C |
| 5 | 新锐榜展示近 30 天 star 增量最快的 AI 项目 | ✅ |
| 6 | GITHUB_TOKEN 配置后 API 限流 5000 次/小时正常工作 | ✅ |
| 7 | 管理员可编辑已发布爆料（PATCH API），标签全量覆盖 | ✅ |
| 8 | 编辑表单提交前实时预览，必填字段实时校验 | ✅ |
| 9 | Product Hunt / Hacker News / OpenAI / Google AI / HuggingFace 新源正常抓取 | ✅ |
| 10 | Product Hunt 非 AI 内容被白名单过滤，不稀释工具榜 | ✅ |
| 11 | 管理员置顶文章热度衰减（99→95→90→85→普通），72h 后自动降级 | ✅ |
| 12 | 热度评分平衡：GitHub 星数降 5 分，加分收窄 5→3，首页覆盖 6+ 数据源 | ✅ |
| 13 | Hacker News AI 过滤 + 空摘要处理 + `\b` 边界正则统一 | ✅ |
