/** Capture representative rendered theme states for human and source review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.VITE_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const output = [];
await mkdir('../screenshots', { recursive: true });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(baseURL);
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') {
        if (width < 640) await page.getByRole('button', { name: 'Open navigation' }).click();
        await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      }
      output.push(`LANDING ${width} ${theme}\n${await page.locator('body').ariaSnapshot()}`);
      output.push(JSON.stringify(await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const main = getComputedStyle(document.querySelector('main'));
        return { font: body.fontFamily, mainColor: main.color, mainBackground: main.backgroundColor };
      })));
      output.push(await page.content());
      await page.screenshot({ path: `../screenshots/landing-${width}-${theme}.png`, fullPage: true });
    }
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    output.push(`LOGIN ERROR ${width}\n${await page.locator('body').ariaSnapshot()}\n${await page.content()}`);
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'Manage users' }).click();
    output.push(`ADMIN USERS ${width}\n${await page.locator('body').ariaSnapshot()}\n${await page.content()}`);
    await page.screenshot({ path: `../screenshots/users-${width}-dark.png`, fullPage: true });
    await page.close();
  }
  await writeFile('../ui-preflight.txt', output.join('\n\n'), 'utf8');
} finally {
  await browser.close();
}
