export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export function heatToColor(score: number): string {
  if (score >= 80) return '#f97316'; // orange → super hot
  if (score >= 60) return '#d4af37'; // gold → hot
  if (score >= 40) return '#64748b'; // gray → warm
  return '#444'; // dim
}

export function getPlaceholderImage(category: string): string {
  const map: Record<string, string> = {
    opensource: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect fill='%231a1a1a' width='400' height='200'/%3E%3Cpath d='M50 100 L100 60 L150 120 L200 70 L250 110 L300 80 L350 100' stroke='%23d4af37' stroke-width='2' fill='none' opacity='0.3'/%3E%3Ccircle cx='100' cy='60' r='3' fill='%23d4af37' opacity='0.5'/%3E%3Ccircle cx='200' cy='70' r='3' fill='%23d4af37' opacity='0.5'/%3E%3Ccircle cx='300' cy='80' r='3' fill='%23d4af37' opacity='0.5'/%3E%3C/svg%3E",
    paper: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect fill='%231a1a1a' width='400' height='200'/%3E%3Crect x='50' y='40' width='300' height='120' rx='4' fill='none' stroke='%23d4af37' stroke-width='1' opacity='0.3'/%3E%3Cline x1='80' y1='70' x2='320' y2='70' stroke='%23d4af37' stroke-width='1' opacity='0.2'/%3E%3Cline x1='80' y1='90' x2='260' y2='90' stroke='%23d4af37' stroke-width='1' opacity='0.2'/%3E%3Cline x1='80' y1='110' x2='290' y2='110' stroke='%23d4af37' stroke-width='1' opacity='0.2'/%3E%3Cline x1='80' y1='130' x2='220' y2='130' stroke='%23d4af37' stroke-width='1' opacity='0.2'/%3E%3C/svg%3E",
    news: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect fill='%231a1a1a' width='400' height='200'/%3E%3Cpath d='M30 160 Q100 30 200 100 Q300 170 370 60' stroke='%23d4af37' stroke-width='2' fill='none' opacity='0.3'/%3E%3Ccircle cx='200' cy='100' r='40' fill='none' stroke='%23d4af37' stroke-width='1' opacity='0.2'/%3E%3C/svg%3E",
    podcast: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect fill='%231a1a1a' width='400' height='200'/%3E%3Ccircle cx='200' cy='100' r='60' fill='none' stroke='%23d4af37' stroke-width='2' opacity='0.3'/%3E%3Ccircle cx='200' cy='100' r='35' fill='none' stroke='%23d4af37' stroke-width='1' opacity='0.2'/%3E%3Ccircle cx='200' cy='100' r='12' fill='%23d4af37' opacity='0.2'/%3E%3C/svg%3E",
  };
  return map[category] || map.news || '';
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    opensource: '开源',
    paper: '论文',
    news: '资讯',
    podcast: '播客',
  };
  return labels[category] || category;
}
