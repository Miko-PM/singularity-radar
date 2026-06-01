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
- 数据库从 Supabase PostgreSQL 迁移至 Render 内置 PostgreSQL
- 数据源调整：禁用机器之心（源不稳定），启用雷峰网
- 文档更新：`PRD_V1.0_20260601.md`（替换草稿版本）、AGENTS.md、RESEARCH.md
