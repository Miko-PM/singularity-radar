import { HotTopic } from '../types/index.ts';
import { getCategoryLabel } from '../utils/index.ts';

interface Props {
  topic: HotTopic;
  onTagClick: (tag: string) => void;
}

export default function HotTopicCard({ topic, onTagClick }: Props) {
  const sourceTypes: string[] = (() => {
    try {
      return typeof topic.source_types === 'string'
        ? JSON.parse(topic.source_types)
        : topic.source_types;
    } catch {
      return [];
    }
  })();

  return (
    <div className="bg-[#0e0e0e] border border-[#222] rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#d4af37]/45 hover:-translate-y-0.5">
      <div className="p-5">
        {/* Master title */}
        <a
          href={topic.master_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="font-headline text-lg md:text-xl text-[#ececeb] hover:text-[#d4af37] transition-colors line-clamp-2"
        >
          {topic.master_title}
        </a>

        {/* Subtitle */}
        <p className="font-label text-xs text-[#d4af37] mt-1.5">
          话题：#<button onClick={() => onTagClick(topic.keyword)} className="hover:underline">{(topic as any).keyword || topic.master_title}</button> · 共 {topic.article_count} 篇跨源探讨
        </p>

        {/* Source distribution */}
        {topic.articles && topic.articles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {sourceTypes.map((type: string) => {
              const count = topic.articles?.filter((a: any) => a.category === type).length || 0;
              return (
                <span key={type} className="font-label text-[11px] px-2 py-0.5 rounded bg-[#1a1a1a] text-[#888] border border-[#333]">
                  {getCategoryLabel(type)} ×{count}
                </span>
              );
            })}
          </div>
        )}

        {/* Article previews */}
        {topic.articles && topic.articles.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-[#222] pt-3">
            {topic.articles.slice(0, 4).map((article: any) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-sm text-[#777] hover:text-[#ececeb] transition-colors group"
              >
                <span className="text-[10px] mt-0.5 text-[#555] shrink-0">
                  {getCategoryLabel(article.category)}
                </span>
                <span className="line-clamp-1 group-hover:text-[#d4af37]">
                  {article.title}
                </span>
              </a>
            ))}
            {topic.articles.length > 4 && (
              <p className="text-xs text-[#555] font-label pl-12">
                +{topic.articles.length - 4} 篇更多内容
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
