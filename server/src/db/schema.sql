-- ============================================
-- Singularity Radar — Database Schema
-- PostgreSQL via Supabase
-- ============================================

-- 数据源表
CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  feed_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('opensource', 'paper', 'news', 'podcast')),
  update_interval TEXT NOT NULL DEFAULT 'daily',
  fallback_urls TEXT DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  summary TEXT DEFAULT '',
  author TEXT DEFAULT '',
  published_at TIMESTAMP DEFAULT NOW(),
  image_url TEXT DEFAULT '',
  hot_score INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_admin_post BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_hot_score ON articles(hot_score DESC);

-- V1.1: 英文翻译字段（NULL = 未处理，'' = 已处理/无需翻译）
ALTER TABLE articles ADD COLUMN IF NOT EXISTS title_zh TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary_zh TEXT;
ALTER TABLE articles ALTER COLUMN title_zh DROP NOT NULL;
ALTER TABLE articles ALTER COLUMN summary_zh DROP NOT NULL;
ALTER TABLE articles ALTER COLUMN title_zh SET DEFAULT NULL;
ALTER TABLE articles ALTER COLUMN summary_zh SET DEFAULT NULL;
-- 注意：以下 UPDATE 是 V1.1 上线时的一次性数据迁移，注释掉避免每部署重置
-- UPDATE articles SET title_zh = NULL WHERE title_zh = '';
-- UPDATE articles SET summary_zh = NULL WHERE summary_zh = '';

-- V1.1: GitHub 仓库星数字段（常青榜/新锐榜/趋势榜）
ALTER TABLE articles ADD COLUMN IF NOT EXISTS stars INTEGER DEFAULT 0;

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT ''
);

-- 文章-标签关联表
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- 标签关键词词库（匹配规则引擎）
CREATE TABLE IF NOT EXISTS tag_keywords (
  id SERIAL PRIMARY KEY,
  tag_name TEXT NOT NULL,
  keyword TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- V1.1.1: 翻译用量跟踪（代替本地文件，避免重启丢失）
CREATE TABLE IF NOT EXISTS translation_usage (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  month TEXT NOT NULL,
  chars INTEGER NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO translation_usage (id, month, chars, calls)
VALUES (1, '', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 热门议题（预计算）
CREATE TABLE IF NOT EXISTS hot_topics (
  id SERIAL PRIMARY KEY,
  keyword TEXT UNIQUE NOT NULL,
  master_title TEXT DEFAULT '',
  master_url TEXT DEFAULT '',
  master_image_url TEXT DEFAULT '',
  article_count INTEGER DEFAULT 0,
  source_types TEXT DEFAULT '[]',
  total_hot_score INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
