import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const errors = [];

const page = await browser.newPage({ viewport: { width: 1360, height: 940 }, locale: 'ar-SA' });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'الجدول', exact: true }).click();
await page.waitForTimeout(500);
const periods = await page.locator('.schedule-period-head').allTextContents();
const days = await page.locator('.schedule-day').allTextContents();
await page.screenshot({ path: 'docs/screenshots/schedule-transposed.png' });

await page.getByRole('button', { name: 'طباعة' }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'docs/screenshots/print-transposed.png' });
const printHead = await page.locator('.print-sheet thead th').allTextContents();
const printRows = await page.locator('.print-sheet tbody th').allTextContents();
await page.getByRole('button', { name: 'إغلاق' }).click();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
await mobile.goto(base, { waitUntil: 'networkidle' });
await mobile.getByRole('button', { name: 'الجدول', exact: true }).click();
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: 'docs/screenshots/mobile-transposed.png', fullPage: true });

const publicPage = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
await publicPage.goto(`${base}#/classes`, { waitUntil: 'networkidle' });
await publicPage.locator('a[href^="#/class/"]').first().click();
await publicPage.waitForTimeout(500);
const publicPeriods = await publicPage.locator('.schedule-period-head').allTextContents();
await publicPage.screenshot({ path: 'docs/screenshots/public-transposed.png' });

console.log(JSON.stringify({ periods, days, printHead, printRows, publicPeriods, errors }, null, 1));
await browser.close();
