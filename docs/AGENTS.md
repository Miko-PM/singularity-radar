# Singularity Radar — 开发公约

## 项目概述

AI 资讯聚合平台，自动采集 GitHub Trending、arXiv、AI 新闻（机器之心/新智元）、播客（Lenny's Podcast/硅谷101），跨源聚合热门议题。MVP 4 天交付（5/28 ~ 5/31）。

## 技术栈

| 层 | 技术 | 备注 |
|---|------|------|
| 前端 | React 18 + Vite + TypeScript | 同一代码库响应式适配 PC + 移动端 |
| 样式 | Tailwind CSS v4 | 暗色模式，无 CSS Modules / styled-components |
| 后端 | Node.js + Express + TypeScript | 轻量 API，无 ORM |
| 数据库 | PostgreSQL（Supabase 免费版） | 使用 `pg`（node-postgres）驱动 |
| 定时任务 | node-cron | 内置于后端进程，UTC+8 8/12/18/22 执行 |
| 部署 | Vercel（前端）+ Render（后端） | |

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
│   │   ├── services/      # RSS 抓取、标签匹配
│   │   ├── db/            # 数据库连接、Schema、迁移
│   │   ├── types/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── docs/                  # 文档
    ├── PRD_草稿_20260527.md
    ├── AGENTS.md
    └── _fix_render_pg.py
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

### 样式（Tailwind CSS v4）

- **暗色模式**：通过 `<body class="dark">` 控制，Tailwind `dark:` 前缀
- 不使用 CSS Modules、styled-components 或内联 `style={}`
- 颜色使用 Tailwind 变量或自定义 CSS 变量：

```css
:root {
  --bg-primary: #0c0c0c;
  --accent-gold: #d4af37;
  --text-primary: #ececeb;
}
```

### 数据库

- 使用 `pg` 连接池，无 ORM
- SQL 查询写在 `server/src/db/` 下，以 `.sql` 文件或模板字符串形式
- 所有查询使用参数化查询（`$1, $2`），禁止拼接 SQL
- Schema 迁移：初始 Schema 用 `server/src/db/schema.sql`，后续变更追加到 `migrations/`
- `sources` 表包含 `fallback_urls TEXT` 字段，存储 JSON 数组备用 RSS 地址
- `tag_keywords` 初始词库见 PRD 标签体系章节，首次部署通过 `server/src/db/seed.sql` 写入
- `npm run seed` 执行完毕后，再运行 `npm run fetch` 触发全量 RSS 抓取 + `generateHotTopics()`，确保上线即有首批内容

### 后端 API

- 路由层（`routes/`）只负责请求解析和响应返回，不包含 SQL
- 业务逻辑和 SQL 查询封装在 `services/` 或 `db/queries.ts` 中
  ```ts
  // routes/articles.ts ✅ 正确
  router.get('/', async (req, res) => {
    const articles = await ArticleService.getArticles(req.query);
    res.json({ data: articles, error: null });
  });

  // routes/articles.ts ❌ 禁止：SQL 写在路由层
  ```
- 所有接口返回统一 JSON 格式
- 错误处理：`try/catch` → 返回 `{ data: null, error: message }`
- 鉴权：管理员接口使用 Bearer Token，token 在启动时从环境变量读取

## 设计规范（前端）

### 布局
- **≥768px**：左侧栏 `w-64` + 内容区
- **<768px**：单列，汉堡菜单触发侧栏
- 侧栏包含：Logo、Tab 导航、筛选器、底部版权信息

### 导航 Tab（4 个，点击切换内容区）
| Tab | 内容 | 数据源映射 |
|-----|------|-----------|
| 今日热点 | 综合 feed，多源混排 | GitHub + arXiv + 资讯 + 播客 |
| 工具榜 | 聚焦工具/开源项目 | GitHub Trending |
| 人物动态 | 大咖视角 | 播客/访谈 |
| 深度专题 | 热门议题聚合 | 所有数据源交叉 |

### 筛选器（对当前 Tab 内容二次过滤，位于 Tab 导航下方）
| 筛选项 | 说明 |
|--------|------|
| 最新情报 | 按时间倒序，默认 |
| 高热爆料 | 按热度指标排序 |
| 编辑精选 | 管理员标记（预留），数据为空时自动隐藏 |

### 暗色主题
- 背景：`#0c0c0c`
- 强调色：`#d4af37`（金色）
- 正文：`#ececeb`
- 字体：
  - 标题：Playfair Display（英文）/ 系统默认（中文 fallback）
  - 正文：Inter
  - 标签/代码：JetBrains Mono

### 文章卡片
- 封面图（可选）+ 标题 + 摘要（截断 2 行）+ 元信息
- 元信息行：标签列表 | 热度（°C） | 数据源 | 时间
- 点击新窗口跳转原文
- 数据源以 "via xx" 格式展示

### 图片兜底与滤镜
RSS 抓取的文章配图风格不一，需统一视觉处理：
- **有图**：强制叠加暗色滤镜 `brightness-75 contrast-125 grayscale-[20%]`，融入黑金 UI
- **无图**：根据 `category` 使用预设抽象几何背景图作为 fallback，禁止图片位空白或隐藏
  - `opensource` → 代码/网格类抽象底图
  - `paper` → 学术/数据流类抽象底图
  - `news` → 资讯/波形类抽象底图
  - `podcast` → 声波/圆环类抽象底图
- fallback 图片以内联 SVG 或 `public/images/` 静态资源形式提供，不依赖外部 CDN

## 数据获取规范

### RSS 抓取
- 使用 `node-fetch` 或 `axios` 请求 RSS XML
- 解析使用 `fast-xml-parser`
- 抓取顺序：单线程顺序遍历所有启用的数据源，非并行
- 去重依据：`url` 字段唯一索引
- 单源失败只记录日志，不影响其他源

### 标签匹配
- 从 `tag_keywords` 表读取关键词词典
- 匹配范围：标题 + 摘要 + content:encoded 前 200 字
- 正则匹配：`new RegExp('\\b' + escapeRegex(keyword) + '\\b', 'i')`
- `escapeRegex` 工具函数定义（`server/src/utils/string.ts`）：
  ```ts
  export const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  ```
- 匹配上的标签存入 `article_tags` 关联表

### 热度评分（抓取时计算）

```
hot_score = base_score × recency_boost

base_score（数据源基础权重）:
  - GitHub Trending: 65 + star_count / 10000
  - arXiv 论文: 55
  - 机器之心: 60
  - 新智元: 50
  - Lenny's Podcast: 70
  - 硅谷101: 60（同播客类，略低于 Lenny）
  - 管理员爆料: 75

recency_boost（时间衰减）:
  - 12 小时内: 1.5
  - 24 小时内: 1.3
  - 48 小时内: 1.1
  - 超过 48 小时: 1.0
```

## 注意事项

- **User-Agent**：所有外部 HTTP 请求设置 `User-Agent: Singularity-Radar/1.0`，避免被 ban
- **API Key 管理**：不硬编码任何 Key 到代码中，全部通过环境变量注入
- **版权**：只展示标题与摘要（< 200 字），点击新窗口跳转原文
- **缓存**：前端 API 始终从数据库读缓存数据，RSS 抓取是后台独立路径，与前端请求解耦
- **时区**：所有时间以 UTC 存储，显示时转换为 UTC+8（北京时区）
- **CORS**：后端配置 `cors()` 允许前端域名访问
- **原型图仅为愿景参考**：`docs/prototype.jpg` 是早期概念设计，不代表最终 MVP 范围。开发以 PRD 为准，不做超出 MVP 的视觉和交互实现
- **原型图中明确不实现的功能**：MY SUBSCRIPTIONS（我的订阅）、点赞/推荐数按钮、搜索栏、亮色/暗色切换开关（MVP 固定暗色）
- **数据库与部署**：Supabase PostgreSQL 为远程数据库，与 Render 后端分离。Render 冷启动约 30s 只影响 API 首次响应，数据不丢失。UptimeRobot 保活为可选（上线后若介意冷启动延迟再配）

## 部署配置

### Render 环境变量
- `DATABASE_URL` — Supabase 连接字符串
- `ADMIN_TOKEN` — 管理员 Token
- `CACHE_TTL` — 缓存时间（默认 72）
- `RSSHUB_BASE` — RSSHub 主实例
- `RSSHUB_FALLBACK` — RSSHub 备用实例
- `NODE_ENV` — `production`
- `PORT` — 3001

### Vercel 环境变量
- `VITE_API_BASE` — 后端 API 地址

## 测试要求

- 手动验证 ≥ 10 条真实数据（覆盖所有数据源）
- 验证标签匹配准确性
- 验证移动端响应式布局
- 验证暗色模式正常
- 验证管理员登录和爆料功能
