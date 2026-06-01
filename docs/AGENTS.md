# Singularity Radar — 开发公约

## 修订历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v0.1 | 2026-05-28 | Claude | 初稿 |
| v1.0 | 2026-06-01 | Claude | 正式发布：自定义域名、保活监控、published_at 修复、部署架构更新 |

## 项目概述

AI 资讯聚合平台，自动采集 GitHub Trending、arXiv、AI 新闻（36氪/雷峰网）、播客（Lenny's Podcast/硅谷101），跨源聚合热门议题。V1.0 已正式上线。

## 技术栈

| 层 | 技术 | 备注 |
|---|------|------|
| 前端 | React 19 + Vite 6 + TypeScript | 同一代码库响应式适配 PC + 移动端 |
| 样式 | Tailwind CSS v4 + CSS 变量 | 暗色/亮色模式 |
| 后端 | Node.js + Express + TypeScript | 轻量 API，无 ORM |
| 数据库 | PostgreSQL（Render 内置） | 使用 `pg`（node-postgres）驱动 |
| 定时任务 | node-cron | 内置于后端进程，UTC+8 8/12/18/22 执行 |
| 部署 | Vercel（前端，自定义域名）+ Render（后端 + PostgreSQL） | |
| 保活监控 | UptimeRobot | 每 5 分钟 ping /api/health，防止 Render 休眠 |

## 项目结构

```
singularity-radar/
├── client/                # Vite + React 前端
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面（Home, Admin）
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── types/         # TypeScript 类型定义
│   │   ├── utils/         # 工具函数
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/                # Express 后端
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── services/      # RSS 抓取、标签匹配、热度评分、热门议题
│   │   ├── db/            # 数据库连接、Schema、迁移
│   │   ├── types/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── docs/                  # 文档
    ├── PRD_V1.0_20260601.md
    ├── AGENTS.md
    ├── RESEARCH.md
    ├── blog_vibe_coding.md
    └── gen_checklist.py
```

## 代码规范

### TypeScript

- 所有文件使用 TypeScript，`strict: true`
- 避免 `any`，用 `unknown` 替代无法确定的类型
- API 响应统一类型：

```ts
interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}
```

### React 组件

- 函数组件 + Hooks，无 class 组件
- 文件名：`PascalCase.tsx`
- Props 类型定义在文件顶部，用 `interface` 非 `type`
- 组件只做展示和交互，数据获取放在 `hooks/` 或页面层

### 样式（Tailwind CSS v4 + CSS 变量）

- **主题模式**：通过 CSS 变量 + `data-theme` 属性控制，`localStorage` 持久化
- 暗色模式背景 `#0c0c0c`，亮色模式背景 `#f5f5f0`
- 自定义 CSS 变量定义在 `client/src/index.css`

### 数据库

- 使用 `pg` 连接池，无 ORM
- SQL 查询使用参数化查询（`$1, $2`），禁止拼接 SQL
- Schema 迁移：`server/src/db/schema.sql` 为初始 Schema，后续变更追加到 `migrations/`
- `sources` 表包含 `fallback_urls TEXT` 字段，存储 JSON 数组备用 RSS 地址
- **关键约定：RSS 抓取任务顺序执行（非并行）**，避免数据库连接争抢
- 数据源清单：GitHub Trending、arXiv、36氪、雷峰网、Lenny's Podcast、硅谷101、管理员爆料（机器之心已禁用）

### 后端 API

- 路由层（`routes/`）只负责请求解析和响应返回，不包含 SQL
- 所有接口返回统一 JSON 格式
- 错误处理：`try/catch` → 返回 `{ data: null, error: message }`
- 鉴权：管理员接口使用 Bearer Token

## 设计规范（前端）

### 布局
- **≥768px**：左侧栏 `w-64` + 内容区
- **<768px**：单列，汉堡菜单触发侧栏

### 导航 Tab（4 个）
| Tab | 内容 | 数据源映射 |
|-----|------|-----------|
| 今日热点 | 综合 feed，多源混排 | GitHub + arXiv + 资讯 + 播客 |
| 工具榜 | 聚焦工具/开源项目 | GitHub Trending |
| 人物动态 | 大咖视角 | 播客/访谈 |
| 深度专题 | 热门议题聚合 | 所有数据源交叉 |

### 筛选器
| 筛选项 | 说明 |
|--------|------|
| 最新情报 | 按时间倒序，默认 |
| 高热爆料 | 按热度指标排序 |
| 编辑精选 | 管理员标记（预留），数据为空时自动隐藏 |

### 文章卡片
- 封面图（可选）+ 标题 + 摘要（截断 2 行）+ 元信息
- 元信息行：标签列表 | 热度（°C） | 数据源 | 时间
- 点击新窗口跳转原文
- 数据源以 "via xx" 格式展示
- 水平布局（列表模式）和垂直布局（卡片模式）两种变体
- Hero 卡片（hot_score ≥ 80 时展示在顶部）

## 数据获取规范

### RSS 抓取
- 使用 `fetch` + `fast-xml-parser` 解析 RSS XML
- GitHub Trending 使用 `cheerio` HTML Scraper 直接解析 `github.com/trending`
- 抓取顺序：单线程顺序遍历所有启用的数据源，非并行
- 去重依据：`url` 字段唯一索引，`ON CONFLICT DO UPDATE`
- 单源失败记录日志，尝试备用地址，不影响其他源
- **published_at 更新**：ON CONFLICT 时同时更新 `published_at = EXCLUDED.published_at`，确保 GitHub Trending 时间戳不会停滞

### 标签匹配
- 从 `tag_keywords` 表读取关键词词典
- 匹配范围：标题 + 摘要 + content:encoded 前 200 字
- 正则匹配：`new RegExp('\\b' + escapeRegex(keyword) + '\\b', 'i')`

### 热度评分（抓取时计算）

```
hot_score = base_score × recency_boost

base_score（数据源基础权重）:
  - GitHub Trending: 65 + star_count / 10000
  - arXiv 论文: 55
  - 36氪: 60
  - 雷峰网: 50
  - Lenny's Podcast: 70
  - 硅谷101: 60
  - 管理员爆料: 75

recency_boost（时间衰减）:
  - 12 小时内: 1.5
  - 24 小时内: 1.3
  - 48 小时内: 1.1
  - 超过 48 小时: 1.0
```

## 注意事项

- **User-Agent**：所有外部 HTTP 请求设置 `User-Agent: Singularity-Radar/1.0`
- **版权**：只展示标题与摘要（< 200 字），点击新窗口跳转原文
- **时区**：所有时间以 UTC 存储，显示时转换为 UTC+8（北京时区）
- **CORS**：后端配置 `cors()` 允许前端域名访问
- **数据新鲜度**：GitHub Trending 的 `published_at` 使用 `new Date()`（抓取时间），ON CONFLICT 时一并更新

## 部署配置

### 前端（Vercel）
- 自定义域名：`https://sr.miko-ai.cn/`
- 环境变量：`VITE_API_BASE=https://singularity-radar-api.onrender.com`
- 构建命令：`npm run build`

### 后端（Render）
- Web Service 类型
- 环境变量：
  - `DATABASE_URL` — Render PostgreSQL 连接字符串
  - `ADMIN_TOKEN` — 管理员 Token
  - `CACHE_TTL` — 缓存时间（默认 72）
  - `RSSHUB_BASE` — RSSHub 主实例
  - `RSSHUB_FALLBACK` — RSSHub 备用实例
  - `NODE_ENV` — `production`
  - `PORT` — 3001
- 启动命令：`npm start`
- 健康检查：`/api/health`

### 保活监控（UptimeRobot）
- 监控地址：`https://singularity-radar-api.onrender.com/api/health`
- 监控频率：每 5 分钟
- 监控类型：HTTP(S)
- 目的：防止 Render 免费版因 15 分钟无流量而休眠

## 常见问题

### 数据新鲜度问题
**现象**：GitHub Trending 数据显示为"X小时前"，但实际是最近的热点。

**原因**：GitHub Trending 的 `published_at` 设为抓取时间（`new Date()`），但 `ON CONFLICT (url) DO UPDATE` 未更新该字段。当仓库连续多天上榜时，`published_at` 停滞在首次入库时间。

**修复**：在 `ON CONFLICT` 子句中添加 `published_at = EXCLUDED.published_at`（`server/src/services/fetcher.ts`）。

### Render 休眠问题
**现象**：长时间未访问后，首次打开页面加载缓慢（~30s）。

**原因**：Render 免费版 15 分钟无流量自动休眠。

**解决**：配置 UptimeRobot 每 5 分钟 ping `/api/health`。若保活生效，服务持续运行无冷启动。
