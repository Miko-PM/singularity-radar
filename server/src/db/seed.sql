-- ============================================
-- Singularity Radar — Seed Data
-- Initial sources, tag_keywords, and admin user
-- ============================================

-- 数据源
INSERT INTO sources (name, slug, feed_url, category, update_interval, fallback_urls, enabled) VALUES
  ('GitHub Trending', 'github_trending', 'https://rsshub.app/github/trending/daily', 'opensource', 'daily', '["https://rsshub.bili.xyz/github/trending/daily"]', true),
  ('arXiv cs.AI', 'arxiv', 'https://rss.arxiv.org/rss/cs.AI', 'paper', 'daily', '[]', true),
  ('机器之心', 'jiqizhixin', 'https://jiqizhixin.com/rss', 'news', 'daily', '[]', false),
  ('36氪', '36kr', 'https://36kr.com/feed', 'news', 'daily', '[]', true),
  ('雷峰网', 'leiphone', 'https://www.leiphone.com/feed', 'news', 'daily', '[]', true),
  ('Lenny''s Podcast', 'lennys_podcast', 'https://www.lennysnewsletter.com/feed', 'podcast', 'weekly', '[]', true),
  ('硅谷101', 'sv101', 'https://sv101.fireside.fm/rss', 'podcast', 'weekly', '[]', true),
  ('管理员爆料', 'admin_post', '', 'news', 'daily', '[]', true)
ON CONFLICT (slug) DO NOTHING;

-- 标签关键词词库
INSERT INTO tag_keywords (tag_name, keyword) VALUES
  -- LLM / 大模型
  ('大模型', '大模型'),
  ('大模型', 'LLM'),
  ('大模型', 'large language model'),
  ('大模型', 'foundation model'),
  ('大模型', '基础模型'),
  -- Agent
  ('Agent', 'Agent'),
  ('Agent', 'AI agent'),
  ('Agent', '自主智能体'),
  ('Agent', '智能体'),
  -- 多模态
  ('多模态', '多模态'),
  ('多模态', 'multimodal'),
  ('多模态', 'vision-language'),
  ('多模态', 'visual language'),
  -- 开源
  ('开源', 'open source'),
  ('开源', '开源'),
  -- AI 芯片 / 算力
  ('芯片', 'GPU'),
  ('芯片', 'TPU'),
  ('芯片', 'AI芯片'),
  ('芯片', '算力'),
  ('芯片', 'NVIDIA'),
  ('芯片', 'CUDA'),
  -- 具身智能 / 机器人
  ('机器人', '具身智能'),
  ('机器人', 'embodied'),
  ('机器人', '机器人'),
  ('机器人', 'humanoid'),
  ('机器人', '人形机器人'),
  -- AI 编程
  ('AI编程', 'AI编程'),
  ('AI编程', 'AI coding'),
  ('AI编程', 'Copilot'),
  ('AI编程', 'Cursor'),
  ('AI编程', 'Devin'),
  -- AI 安全 / 对齐
  ('安全', 'AI safety'),
  ('安全', 'alignment'),
  ('安全', 'AI对齐'),
  ('安全', '安全性'),
  -- 文生图 / 文生视频
  ('生成式AI', '生成式'),
  ('生成式AI', 'generative'),
  ('生成式AI', 'Sora'),
  ('生成式AI', '文生图'),
  ('生成式AI', '文生视频'),
  ('生成式AI', 'text-to-image'),
  ('生成式AI', 'text-to-video'),
  ('生成式AI', 'Diffusion'),
  -- AI 框架
  ('AI框架', 'PyTorch'),
  ('AI框架', 'TensorFlow'),
  ('AI框架', 'JAX'),
  ('AI框架', 'LangChain'),
  ('AI框架', 'LlamaIndex'),
  -- RAG
  ('RAG', 'RAG'),
  ('RAG', 'retrieval augmented'),
  ('RAG', '检索增强'),
  -- 自动驾驶
  ('自动驾驶', '自动驾驶'),
  ('自动驾驶', 'self-driving'),
  ('自动驾驶', 'autonomous driving'),
  ('自动驾驶', 'FSD'),
  ('自动驾驶', 'Waymo'),
  -- AI 应用
  ('AI应用', 'ChatGPT'),
  ('AI应用', 'Claude'),
  ('AI应用', 'Gemini'),
  ('AI应用', 'GPT'),
  ('AI应用', 'Sam Altman'),
  ('AI应用', 'OpenAI'),
  ('AI应用', 'Anthropic'),
  ('AI应用', 'Google AI'),
  ('AI应用', 'Meta AI'),
  -- AI 数学 / 推理
  ('推理', 'reasoning'),
  ('推理', '推理'),
  ('推理', 'chain-of-thought'),
  ('推理', '思维链')
ON CONFLICT (keyword) DO NOTHING;
