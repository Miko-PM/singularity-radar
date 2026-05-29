interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function EmptyState({ message = '暂无内容，雷达扫描中…', onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 mb-4 rounded-full border-2 border-[var(--border-secondary)] border-t-[#d4af37] animate-spin" />
      <p className="text-sm text-[var(--text-muted)] font-label">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 font-label text-xs text-[var(--gold)] px-3 py-1.5 rounded border border-[var(--gold)]/20 hover:bg-[var(--gold-bg)]/5 transition-colors"
        >
          点击重试
        </button>
      )}
    </div>
  );
}
