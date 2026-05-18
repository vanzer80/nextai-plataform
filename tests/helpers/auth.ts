import { type Page } from '@playwright/test';

export const SUPERMASTER = {
  email: process.env.TEST_SUPERMASTER_EMAIL!,
  password: process.env.TEST_SUPERMASTER_PASSWORD!,
};

export const MASTER_MOPAR = {
  email: process.env.TEST_MASTER_MOPAR_EMAIL!,
  password: process.env.TEST_MASTER_MOPAR_PASSWORD!,
};

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForSelector('#email');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
}
