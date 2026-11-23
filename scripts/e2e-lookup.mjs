import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'البيانات', exact: true }).click();
await page.getByRole('button', { name: 'المعلمون', exact: true }).click();
const id = '1010101010';
await page.getByPlaceholder('السجل المدني').first().fill(id);
await page.getByRole('button', { name: 'تفعيل', exact: true }).first().click();
await page.waitForTimeout(1200);
const activated = await page.getByText('مفعّل', { exact: true }).count();
await page.screenshot({ path: 'docs/screenshots/data-teacher-code.png', fullPage: true });

await page.goto(`${base}#/lookup`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('••••••').fill(id);
await page.getByRole('button', { name: 'عرض', exact: true }).click();
await page.waitForTimeout(900);
const heading = await page.locator('h2').first().textContent().catch(() => null);
const cells = await page.locator('.schedule-cell').count();
await page.screenshot({ path: 'docs/screenshots/lookup-result.png', fullPage: true });

console.log(JSON.stringify({ activated, heading, cells, errors }, null, 1));
await browser.close();
