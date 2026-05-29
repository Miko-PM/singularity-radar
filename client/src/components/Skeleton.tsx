interface Props {
  count?: number;
  variant?: 'default' | 'compact';
}

export default function Skeleton({ count = 6, variant = 'default' }: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${variant === 'compact' ? 'mb-3' : 'mb-5'}`}>
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden">
            {variant === 'default' && (
              <div className="h-40 md:h-48 bg-[var(--bg-secondary)] animate-skeleton" />
            )}
            <div className="p-4 md:p-5 space-y-3">
              <div className="h-5 bg-[var(--bg-elevated)] rounded animate-skeleton w-3/4" />
              {variant === 'default' && (
                <>
                  <div className="h-3 bg-[var(--bg-elevated)] rounded animate-skeleton w-full" />
                  <div className="h-3 bg-[var(--bg-elevated)] rounded animate-skeleton w-2/3" />
                </>
              )}
              <div className="flex gap-2">
                <div className="h-4 w-12 bg-[var(--bg-elevated)] rounded-full animate-skeleton" />
                <div className="h-4 w-16 bg-[var(--bg-elevated)] rounded-full animate-skeleton" />
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--border-primary)]">
                <div className="h-3 w-20 bg-[var(--bg-elevated)] rounded animate-skeleton" />
                <div className="h-3 w-16 bg-[var(--bg-elevated)] rounded animate-skeleton" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
