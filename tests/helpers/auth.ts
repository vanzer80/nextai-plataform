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

  // Suppress onboarding modal so it doesn't block test interactions
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('auth-token')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) ?? '{}');
          const userId = data?.user?.id;
          if (userId) {
            localStorage.setItem(`onboarding_v1_done_${userId}`, 'true');
          }
        } catch { /* ignore */ }
      }
    }
  });
}
