# Singularity Radar V1.1 发布说明

**发布日期：** 2026-06-02
**版本：** v1.1.0（server + client）

---

## 概述

V1.1 是 Singularity Radar 的第一个功能迭代版本，围绕"内容国际化、数据广度增强、管理体验提升、热度评分平衡"四个方向进行增强。

---

## 新增功能

### 英文内容自动翻译
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

## 变更

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

## 修复

- 置顶贴热度不衰减：`PATCH` 置顶后触发 `scoreArticle()` 重算热度
- 置顶贴排序问题：`ORDER BY` 增加置顶 tiebreaker 确保置顶在前
- 长青榜封顶未覆盖批量重算：`reheatAll()` 和 `scoreArticle()` 均增加 evergreen cap
- 36氪非 AI 内容泄漏：数据库清除 139 条财经噪音数据，增强过滤正则

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
DATABASE_URL          # Supabase PostgreSQL
ADMIN_TOKEN           # 管理员鉴权
BAIDU_TRANSLATE_APPID # 百度翻译 AppID（翻译功能）
BAIDU_TRANSLATE_KEY   # 百度翻译 Key
GITHUB_TOKEN          # GitHub Search API 认证
PORT=3001
NODE_ENV=production
```
