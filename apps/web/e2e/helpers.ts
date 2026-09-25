import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const OWNER = { email: 'dona@e2e.local', password: 'e2e-password-1' };
export const API = 'http://127.0.0.1:3210/api';

export async function login(page: Page, who = OWNER): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(who.email);
  await page.getByLabel('Senha').fill(who.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel$/);
}

// Direct API access with its own owner session, to prepare or inspect data.
export async function apiAs(request: APIRequestContext, who = OWNER) {
  const login = await request.post(`${API}/auth/login`, { data: who });
  expect(login.ok()).toBeTruthy();
  const cookie = (login.headers()['set-cookie'] ?? '').split(';')[0] as string;
  const headers = { Cookie: cookie };
  return {
    get: async <T>(path: string): Promise<T> => (await request.get(`${API}/${path}`, { headers })).json() as Promise<T>,
    post: async <T>(path: string, data: unknown = {}): Promise<T> => (await request.post(`${API}/${path}`, { headers, data })).json() as Promise<T>,
    put: async (path: string, data: unknown) => request.put(`${API}/${path}`, { headers, data }),
  };
}

export const nb = (s: string): string => s.replace(/ /g, ' ');

// Selects a school in the header filter by its visible name.
export async function pickSchool(page: Page, name: string): Promise<void> {
  await page.getByLabel('Escola', { exact: true }).selectOption({ label: name });
}

// Fails the test on any console error / uncaught page error.
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}
