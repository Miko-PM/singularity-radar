# 更新日志

## V1.0 — 2026-06-01

Singularity Radar 正式上线。AI 资讯聚合平台，覆盖 GitHub Trending、arXiv、科技媒体、深度播客等多源内容。

### 新增
- 自定义域名 `https://sr.miko-ai.cn/` 上线，Vercel 自定义域名配置
- UptimeRobot 保活监控，每 5 分钟 ping `/api/health`，防止 Render 休眠
- 管理后台新增手动抓取（`POST /api/admin/fetch`）和全量重算热度（`POST /api/admin/reheat`）接口
- 亮色/暗色主题切换，CSS 变量 + `localStorage` 持久化
- 36氪 AI 内容过滤，仅保留 AI 相关文章（正则匹配标题+摘要）

### 修复
- GitHub Trending `published_at` 停滞：`ON CONFLICT (url) DO UPDATE` 新增 `published_at = EXCLUDED.published_at`，仓库连续上榜时时间戳随抓取更新

### 变更
- 分离部署：前端迁移至 Vercel，后端保留在 Render，不再混部
- 数据源调整：禁用机器之心（源不稳定），启用雷峰网
- 文档更新：`PRD_V1.0_20260601.md`（替换草稿版本）、AGENTS.md、RESEARCH.md、CHANGELOG.md

## V1.1 — 2026-06-02

内容国际化、数据广度增强、管理体验提升、热度评分平衡。

### 新增
- 英文内容自动翻译：接入百度翻译 API，非中文标题/摘要自动翻译为中文展示，CJK 汉字占比 ≤15% 判定为非中文。异步队列批量处理，不阻塞主抓取流程
- GitHub 历史热门 AI 仓库：GitHub Search API 双通道搜索，分为**常青榜**（Top 20-30 经典高星项目，每周增量）和**新锐榜**（近 30 天 star 增量最快项目，随抓取同步更新）
- 爆料编辑/预览：发布后可编辑标题/摘要/标签/图片，管理表单实时渲染卡片预览
- 爆料表单前端验证：提交前实时校验必填字段和 URL 格式
- 新增 5 个 RSS 数据源：Product Hunt（AI 关键词白名单过滤）、Hacker News、OpenAI Blog、Google AI Blog、HuggingFace Blog
- 管理员置顶机制：支持置顶/取消置顶，热度随时间衰减（99°C → 95 → 90 → 85，72h 后恢复正常评分）
- 置顶爆料卡片增加"置顶"红色角标

### 变更
- 数据源从 7 个扩展至 12 个（含 5 个新增源，机器之心仍禁用）
- API 新增 `PATCH /api/admin/articles/:id` 管理员编辑接口，支持 `is_pinned` 字段
- API 排序策略：`hot_score DESC, is_pinned DESC, pinned_at DESC NULLS LAST, published_at DESC`
- 热度评分平衡调整（V1.1 acceptance 最终定稿）：
  - GitHub 星数分档整体降 5 分（≤100→20, 500→40, 2K→45, 10K→50, 50K→55, 100K→60），减少 GitHub 霸占首页
  - 图片/标签加分收窄：+5 → +3
  - 各源 base 微调：news 55, podcast 60, 36kr/sv101 50, official blog 65, HN 50, PH 55
  - 长青榜封顶 70°C（抓取 + 单篇重算 + 批量重算三路覆盖）
- 数据源内容质量增强：
  - Hacker News 新增 AI 关键词过滤（正则 `(?<!\.)\bAI\b(?!\.)` 避免 .ai TLD 误匹配）
  - 36氪/Product Hunt AI 过滤正则统一增强（`\bAI\b` / `\bRAG\b` 避免子串误匹配）
  - Hacker News 空摘要处理：RSS 中 summary 仅含 "Comments" 时置为空字符串
- 数据库 `articles` 表新增字段：
  - `title_zh` / `summary_zh` 翻译字段（TEXT NOT NULL DEFAULT ''）
  - `is_pinned` / `pinned_at` 置顶字段
- 环境变量新增 `BAIDU_TRANSLATE_APPID`、`BAIDU_TRANSLATE_KEY`、`GITHUB_TOKEN`

### 变更
- 清理中间版本文件：删除一次性迁移脚本 `_fix_render_pg.py` 及旧版验收清单（`验收清单_20260529.xlsx`、`验收清单_20260601.xlsx`）

### 修复
- 置顶贴热度不衰减问题：`PATCH` 置顶后触发 `scoreArticle()` 重算热度，旧置顶按时间衰减
- 置顶贴排序问题：`ORDER BY` 增加 `is_pinned DESC, pinned_at DESC NULLS LAST` 确保置顶排在前面
- 长青榜封顶未覆盖批量重算：`reheatAll()` 和 `scoreArticle()` 均增加 evergreen cap 检查
- 36氪非 AI 内容泄漏：数据库清除 139 条财经噪音数据，增强过滤正则
