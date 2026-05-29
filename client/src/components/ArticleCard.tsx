import { useState } from 'react';
import { Article } from '../types/index.ts';
import { timeAgo, heatToColor, getPlaceholderImage, getCategoryLabel } from '../utils/index.ts';

/** Image with load/error handling — spinner while loading, hide on error */
function SafeImage({ src, alt, className, wrapperClass }: { src: string; alt: string; className: string; wrapperClass?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'hidden'>('loading');

  if (status === 'hidden') return null;

  return (
    <div className={wrapperClass}>
      {status === 'loading' && (
        <div className="absolute inset-0 bg-[#111] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#333] border-t-[#d4af37] rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${status === 'loading' ? 'opacity-0' : 'opacity-100'}`}
        referrerPolicy="no-referrer"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('hidden')}
      />
    </div>
  );
}

interface Props {
  article: Article;
  onTagClick: (tag: string) => void;
  variant?: 'default' | 'compact' | 'hero';
  layout?: 'vertical' | 'horizontal';
}

export default function ArticleCard({ article, onTagClick, variant = 'default', layout = 'vertical' }: Props) {
  const isAdmin = article.is_admin_post;
  const hasImage = !!article.image_url;
  const isHero = variant === 'hero';

  // Hero card — featured style, full-width banner
  if (isHero) {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group mb-6"
      >
        <article
          className="bg-[#0e0e0e] border border-[#222] rounded-2xl overflow-hidden transition-all duration-300
            group-hover:border-[#d4af37]/45 group-hover:-translate-y-0.5"
        >
          {hasImage && (
            <div className="relative h-56 md:h-72 overflow-hidden bg-[#111]">
              <SafeImage
                src={article.image_url}
                alt=""
                className="w-full h-full object-cover brightness-50 contrast-125 grayscale-[10%] group-hover:scale-105 transition-transform duration-500"
                wrapperClass="absolute inset-0"
              />
              {/* Overlay gradient for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent" />
              {/* Source badge */}
              <span className="absolute top-4 left-4 font-label text-[11px] px-3 py-1 rounded-full bg-black/60 text-[#aaa] backdrop-blur-sm border border-white/10 z-10">
                {article.source_name || getCategoryLabel(article.category)}
              </span>
              {isAdmin && (
                <span className="absolute top-4 right-4 font-label text-[11px] px-3 py-1 rounded-full bg-red-900/60 text-red-300 backdrop-blur-sm border border-red-500/30 z-10">
                  爆料
                </span>
              )}
            </div>
          )}
          <div className="p-6 md:p-8">
            <h2 className="font-headline text-2xl md:text-3xl leading-tight text-[#ececeb] group-hover:text-[#d4af37] transition-colors duration-300 line-clamp-2">
              {article.title}
            </h2>
            {article.summary && (
              <p className="mt-3 text-sm text-[#777] leading-relaxed line-clamp-3 max-w-3xl">
                {article.summary}
              </p>
            )}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#222]">
              <div className="flex items-center gap-3">
                <span className="font-label text-sm" style={{ color: heatToColor(article.hot_score) }}>
                  ● {article.hot_score}°C
                </span>
                <span className="text-xs text-[#555]">
                  via {article.source_name || getCategoryLabel(article.category)}
                </span>
              </div>
              <span className="font-label text-xs text-[#555]">
                {timeAgo(article.published_at)}
              </span>
            </div>
          </div>
        </article>
      </a>
    );
  }

  // Horizontal layout (1-column mode) — text left, image right (floating frame)
  if (layout === 'horizontal') {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group mb-4"
      >
        <article
          className="bg-[#0e0e0e] border border-[#222] rounded-2xl transition-all duration-300
            group-hover:border-[#d4af37]/45 group-hover:-translate-y-0.5"
        >
          <div className="flex flex-row">
            {/* Text area — left side */}
            <div className="flex-1 min-w-0 p-5 md:p-6 flex flex-col justify-between">
              <div>
                {/* Admin badge */}
                {isAdmin && (
                  <span className="inline-block font-label text-[10px] px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 mb-2 border border-red-500/30">
                    爆料
                  </span>
                )}
                <h2 className="font-headline text-base md:text-lg leading-snug text-[#ececeb] group-hover:text-[#d4af37] transition-colors duration-300 line-clamp-2">
                  {article.title}
                </h2>
                {article.summary && (
                  <p className="mt-2 text-sm text-[#777] leading-relaxed line-clamp-2">
                    {article.summary}
                  </p>
                )}
              </div>

              <div>
                {/* Tags */}
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {article.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onTagClick(tag);
                        }}
                        className="px-2 py-0.5 rounded-full bg-[#d4af37]/8 text-[#d4af37]/80 text-[11px] border border-[#d4af37]/15 cursor-pointer hover:bg-[#d4af37]/15 hover:text-[#d4af37] transition-colors font-label"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#222]">
                  <div className="flex items-center gap-2">
                    <span className="font-label text-xs" style={{ color: heatToColor(article.hot_score) }}>
                      ● {article.hot_score}°C
                    </span>
                    <span className="text-[11px] text-[#555]">
                      via {article.source_name || getCategoryLabel(article.category)}
                    </span>
                  </div>
                  <span className="font-label text-[11px] text-[#555]">
                    {timeAgo(article.published_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Image — floating frame on the right */}
            {hasImage && (
              <div className="w-28 md:w-44 shrink-0 p-3 md:p-4 pl-0 self-center">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#333] bg-[#111] shadow-lg">
                  <SafeImage
                    src={article.image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    wrapperClass="absolute inset-0"
                  />
                </div>
              </div>
            )}
          </div>
        </article>
      </a>
    );
  }

  // Vertical layout (3-column mode) — current default
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block group ${variant === 'compact' ? 'mb-3' : 'mb-5'}`}
    >
      <article
        className={`bg-[#0e0e0e] border border-[#222] rounded-2xl overflow-hidden transition-all duration-300
          group-hover:border-[#d4af37]/45 group-hover:-translate-y-0.5`}
      >
        {/* Image - 无图时完全隐藏 */}
        {hasImage && (
          <div className="relative h-40 md:h-48 overflow-hidden bg-[#111]">
            <SafeImage
              src={article.image_url}
              alt=""
              className="w-full h-full object-cover brightness-75 contrast-125 grayscale-[20%] group-hover:scale-105 transition-transform duration-500"
              wrapperClass="absolute inset-0"
            />
            {/* Source badge */}
            <span className="absolute top-3 left-3 font-label text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-[#aaa] backdrop-blur-sm border border-white/10">
              {article.source_name || getCategoryLabel(article.category)}
            </span>
            {/* Admin badge */}
            {isAdmin && (
              <span className="absolute top-3 right-3 font-label text-[10px] px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 backdrop-blur-sm border border-red-500/30">
                爆料
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 md:p-5">
          <h2 className={`font-headline text-lg md:text-xl leading-snug text-[#ececeb] group-hover:text-[#d4af37] transition-colors duration-300 ${variant === 'compact' ? 'line-clamp-1' : 'line-clamp-2'}`}>
            {article.title}
          </h2>

          {variant === 'default' && article.summary && (
            <p className="mt-2 text-sm text-[#777] leading-relaxed line-clamp-2">
              {article.summary}
            </p>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {article.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTagClick(tag);
                  }}
                  className="px-2 py-0.5 rounded-full bg-[#d4af37]/8 text-[#d4af37]/80 text-[11px] border border-[#d4af37]/15 cursor-pointer hover:bg-[#d4af37]/15 hover:text-[#d4af37] transition-colors font-label"
                >
                  #{tag}
                </span>
              ))}
              {article.tags.length > 4 && (
                <span className="text-[11px] text-[#555] font-label self-center">
                  +{article.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#222]">
            <div className="flex items-center gap-2">
              <span className="font-label text-xs" style={{ color: heatToColor(article.hot_score) }}>
                ● {article.hot_score}°C
              </span>
              <span className="text-[11px] text-[#555]">
                via {article.source_name || getCategoryLabel(article.category)}
              </span>
            </div>
            <span className="font-label text-[11px] text-[#555]">
              {timeAgo(article.published_at)}
            </span>
          </div>
        </div>
      </article>
    </a>
  );
}
