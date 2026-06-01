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

内容国际化、数据广度增强、管理体验提升。

### 新增
- 英文内容自动翻译：接入百度翻译 API，非中文标题/摘要自动翻译为中文展示，CJK 汉字占比 ≤30% 判定为非中文
- GitHub 历史热门 AI 仓库：GitHub Search API 双通道搜索（topic 标签 + 描述关键词兜底），首批种子 50 条高星项目，每周增量更新
- 爆料编辑/预览：发布后可编辑标题/摘要/标签/图片，管理表单实时渲染卡片预览
- 爆料表单前端验证：提交前实时校验必填字段和 URL 格式
- 新增 5 个 RSS 数据源：Product Hunt、Hacker News、OpenAI Blog、Google AI Blog、HuggingFace Blog

### 变更
- 数据源从 7 个扩展至 12 个（含 5 个新增源，机器之心仍禁用）
- API 新增 `PATCH /api/admin/articles/:id` 管理员编辑接口
- 环境变量新增 `BAIDU_TRANSLATE_APPID`、`BAIDU_TRANSLATE_KEY`
- 数据库 `articles` 表新增 `title_zh`、`summary_zh` 翻译字段
