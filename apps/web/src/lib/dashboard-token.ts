const STORAGE_KEY = 'dashboardToken';

export function getDashboardToken(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setDashboardToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearDashboardToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}
