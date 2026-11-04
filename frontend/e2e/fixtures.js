/** Capture browser failures before a journey makes its first navigation. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    const captureConsole = (message) => {
      if (message.type() === 'error') errors.push(message.text());
    };
    const capturePageError = (error) => errors.push(error.message);
    page.on('console', captureConsole);
    page.on('pageerror', capturePageError);
    await use(errors);
    page.off('console', captureConsole);
    page.off('pageerror', capturePageError);
    expect(errors, 'No browser console or uncaught errors').toEqual([]);
  }, { auto: true }],
});

export { expect };
