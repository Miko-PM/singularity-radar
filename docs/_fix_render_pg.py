import re

with open('/Users/miko/Desktop/AI文档/6.热搜/Singularity-Radar/docs/PRD_草稿_20260527.md', 'r') as f:
    content = f.read()

replacements = [
    # Tech stack - no longer has SQLite line, update related references

    # 数据库设计标题
    ('#### 5.2.1 数据库设计（SQLite）', '#### 5.2.1 数据库设计（PostgreSQL）'),

    # INTEGER PK → SERIAL PK (in table definitions)
    ('| id | INTEGER PK | 自增主键 |\n| source_id | INTEGER FK | 关联 sources |\n| name | TEXT | 数据源名称（GitHub Trending / arXiv / 机器之心 / 新智元 / Lenny\'s Podcast）',
     '| id | SERIAL PRIMARY KEY | 自增主键 |\n| source_id | INTEGER REFERENCES sources(id) | 关联 sources |\n| name | TEXT | 数据源名称（GitHub Trending / arXiv / 机器之心 / 新智元 / Lenny\'s Podcast）'),

    # articles table PK
    ('| id | INTEGER PK | 自增主键 |\n| source_id | INTEGER FK | 关联 sources |',
     '| id | SERIAL PRIMARY KEY | 自增主键 |\n| source_id | INTEGER REFERENCES sources(id) | 关联 sources |'),

    # BOOLEAN defaults: 0 → FALSE
    ('| hot_score | INTEGER DEFAULT 0 | 热度评分 |',
     '| hot_score | INTEGER DEFAULT 0 | 热度评分 |'),
    ('| likes_count | INTEGER DEFAULT 0 | 点赞数（预留，MVP 不展示） |',
     '| likes_count | INTEGER DEFAULT 0 | 点赞数（预留，MVP 不展示） |'),
    ('| views_count | INTEGER DEFAULT 0 | 浏览数（预留，MVP 不展示） |',
     '| views_count | INTEGER DEFAULT 0 | 浏览数（预留，MVP 不展示） |'),
    ('| is_admin_post | BOOLEAN DEFAULT 0 | 是否为管理员手动录入 |',
     '| is_admin_post | BOOLEAN DEFAULT FALSE | 是否为管理员手动录入 |'),
    ('| is_featured | BOOLEAN DEFAULT 0 | 编辑精选标记 |',
     '| is_featured | BOOLEAN DEFAULT FALSE | 编辑精选标记 |'),
    ('| created_at | DATETIME DEFAULT NOW | 记录创建时间 |',
     '| created_at | TIMESTAMP DEFAULT NOW() | 记录创建时间 |'),

    # DATETIME in hot_topics
    ('| updated_at | DATETIME | 本次聚合更新时间 |',
     '| updated_at | TIMESTAMP | 本次聚合更新时间 |'),
    ('| created_at | DATETIME | 创建时间 |',
     '| created_at | TIMESTAMP | 创建时间 |'),
    ('| updated_at | DATETIME | 最后修改时间 |',
     '| updated_at | TIMESTAMP | 最后修改时间 |'),
    ('| created_at | DATETIME | 创建时间 |\n| updated_at | DATETIME | 最后修改时间 |',
     '| created_at | TIMESTAMP | 创建时间 |\n| updated_at | TIMESTAMP | 最后修改时间 |'),

    # hot_topics PK
    ('| id | INTEGER PK | 自增主键 |\n| keyword | TEXT UNIQUE | 聚合关键词（如 Agent）',
     '| id | SERIAL PRIMARY KEY | 自增主键 |\n| keyword | TEXT UNIQUE | 聚合关键词（如 Agent）'),

    # tags table PK
    ('| id | INTEGER PK | 自增主键 |\n| name | TEXT UNIQUE | 标签名（不含 #）',
     '| id | SERIAL PRIMARY KEY | 自增主键 |\n| name | TEXT UNIQUE | 标签名（不含 #）'),

    # tag_keywords PK
    ('| id | INTEGER PK | 自增主键 |\n| tag_name | TEXT | 标签名（如"大模型"）',
     '| id | SERIAL PRIMARY KEY | 自增主键 |\n| tag_name | TEXT | 标签名（如"大模型"）'),

    # WAL → PostgreSQL native concurrency
    ('- **并发抓取冲突**：SQLite WAL 模式支持并发读，写入由顺序抓取保证无冲突',
     '- **并发抓取冲突**：PostgreSQL 原生支持并发读写，无需特殊配置'),

    # Railway restart → Render restart
    ('- **Railway 重启**：SQLite 文件存储在持久化 Volume 中，重启或部署不丢失\n- **SQLite 备份**：建议定期手动导出 `.db` 文件，无自动备份机制',
     '- **Render 重启**：服务 15 分钟无流量休眠，冷启动约 30s。数据库在 Supabase 远程不受影响\n- **数据库备份**：Supabase 自动备份，无需手动导出'),

    # Performance: SQLite → PostgreSQL
    ('| API 响应时间（缓存命中） | < 200ms（SQLite 索引查询） |',
     '| API 响应时间（缓存命中） | < 200ms（PostgreSQL 索引查询） |'),

    # Interface dependencies
    ('| SQLite | — | 数据库 | ✅ 是 | 本地文件，无需外部服务 |',
     '| Supabase PostgreSQL | Supabase Inc. | 数据库 | ✅ 是 | 免费版 500MB 存储，SSL 连接 |'),

    # Section 8 table - add DATABASE_URL note
    # Actually the env vars are in RESEARCH.md, not PRD
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f'OK: {old[:40]}...')
    else:
        print(f'MISS: {old[:40]}...')

with open('/Users/miko/Desktop/AI文档/6.热搜/Singularity-Radar/docs/PRD_草稿_20260527.md', 'w') as f:
    f.write(content)

print('\nDone')
