// API 基础地址（生产环境由 Vercel 环境变量 VITE_API_BASE 指定）
export const API_BASE = import.meta.env.VITE_API_BASE || '';

export function getToken(): string | null {
  return sessionStorage.getItem('admin_token');
}

export function setToken(token: string) {
  sessionStorage.setItem('admin_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('admin_token');
}
