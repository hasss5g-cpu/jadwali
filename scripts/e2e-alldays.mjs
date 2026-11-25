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
await page.getByRole('button', { name: 'توليد الجداول', exact: true }).click();
await page.locator('button.btn-primary').filter({ hasText: 'توليد الجداول' }).click();
await page.getByText('درجة الجودة').waitFor({ timeout: 30000 });
await page.waitForTimeout(600);

const stats = await page.evaluate(() =>
  [...document.querySelectorAll('.card')]
    .map((card) => {
      const label = card.querySelector('p.text-xs');
      const value = card.querySelector('.kpi-value');
      return label && value ? `${label.textContent}=${value.textContent}` : null;
    })
    .filter(Boolean),
);
const dayCells = await page.evaluate(() =>
  [...document.querySelectorAll('table tbody tr')]
    .map((row) => row.lastElementChild?.textContent?.trim())
    .filter(Boolean)
    .slice(0, 6),
);
await page.screenshot({ path: 'docs/screenshots/generate-alldays.png', fullPage: true });

// طباعة جدول الفصل: أفقي
await page.getByRole('button', { name: 'الجدول', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'طباعة' }).first().click();
await page.waitForTimeout(500);
await page.emulateMedia({ media: 'print' });
const classPageName = await page.locator('.print-sheet').evaluate((el) => getComputedStyle(el).page);
await page.emulateMedia({ media: 'screen' });
await page.screenshot({ path: 'docs/screenshots/class-print-landscape.png' });
await page.getByRole('button', { name: 'إغلاق' }).click();

// صفحة الفصل العامة: طباعة أفقية أيضًا
await page.goto(`${base}#/classes`, { waitUntil: 'networkidle' });
await page.locator('a[href^="#/class/"]').first().click();
await page.waitForTimeout(400);
await page.emulateMedia({ media: 'print' });
const publicPageName = await page
  .locator('.print-landscape')
  .evaluate((el) => getComputedStyle(el).page)
  .catch(() => 'missing');
await page.emulateMedia({ media: 'screen' });

console.log(JSON.stringify({ stats, dayCells, classPageName, publicPageName, errors }, null, 1));
await browser.close();


