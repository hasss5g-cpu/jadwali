import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 940 }, locale: 'ar-SA' });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'التقارير', exact: true }).click();
await page.waitForTimeout(500);
const cards = await page.getByRole('button', { name: 'معاينة وطباعة' }).count();
await page.screenshot({ path: 'docs/screenshots/reports.png', fullPage: true });

// تقرير النصاب على ورق A3 عرضي
await page.locator('select').nth(0).selectOption('landscape');
await page.locator('select').nth(1).selectOption('A3');
await page.getByRole('button', { name: 'معاينة وطباعة' }).nth(8).click();
await page.waitForTimeout(600);
const pageName = await page.locator('.print-sheet').evaluate((el) => getComputedStyle(el).page);
const sheetSize = await page.locator('.print-sheet').evaluate((el) => {
  const style = getComputedStyle(el);
  return { width: style.width, fontSize: style.fontSize };
});
await page.screenshot({ path: 'docs/screenshots/reports-load-a3.png' });
await page.getByRole('button', { name: 'إغلاق' }).click();

// تقرير التدقيق مضغوط A4 طولي
await page.locator('select').nth(0).selectOption('portrait');
await page.locator('select').nth(1).selectOption('A4');
const compact = page.getByRole('checkbox').last();
await compact.check();
await page.getByRole('button', { name: 'معاينة وطباعة' }).nth(9).click();
await page.waitForTimeout(600);
const compactAttr = await page.locator('.print-sheet').getAttribute('data-compact');
await page.screenshot({ path: 'docs/screenshots/reports-audit.png', fullPage: true });

console.log(JSON.stringify({ cards, pageName, sheetSize, compactAttr, errors }, null, 1));
await browser.close();
