export function getToken(): string | null {
  return sessionStorage.getItem('admin_token');
}

export function setToken(token: string) {
  sessionStorage.setItem('admin_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('admin_token');
}
