export interface Article {
  id: number;
  source_id: number;
  title: string;
  url: string;
  summary: string;
  author: string;
  published_at: string;
  image_url: string;
  hot_score: number;
  is_admin_post: boolean;
  is_featured: boolean;
  created_at: string;
  tags: string[];
  source_name: string;
  source_slug: string;
  category: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  article_count: number;
}

export interface Source {
  id: number;
  name: string;
  slug: string;
  feed_url: string;
  category: string;
  enabled: boolean;
  article_count: number;
  last_fetch: string;
}

export interface HotTopic {
  id: number;
  keyword: string;
  master_title: string;
  master_url: string;
  master_image_url: string;
  article_count: number;
  source_types: string;
  total_hot_score: number;
  last_updated: string;
  articles: Article[];
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type TabType = 'hot' | 'tools' | 'people' | 'deep';
export type FilterType = 'latest' | 'hot' | 'featured';
