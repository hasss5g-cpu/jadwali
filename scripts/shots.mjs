import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:4173/';
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function makePage(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, locale: 'ar-SA' });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return page;
}

const page = await makePage({ width: 1360, height: 940 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/dashboard.png` });

const tab = async (name) => {
  await page.getByRole('button', { name, exact: false }).first().click();
  await page.waitForTimeout(500);
};

await tab('الجدول');
await page.screenshot({ path: `${out}/schedule.png` });

await tab('توليد الجداول');
await page.screenshot({ path: `${out}/generate.png` });
await page.locator('button.btn-primary').filter({ hasText: 'توليد الجداول' }).click();
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/generate-report.png`, fullPage: true });

await tab('الإسنادات');
await page.screenshot({ path: `${out}/assignments.png` });

await tab('الانتظار');
await page.getByRole('button', { name: 'إبراهيم الأحمدي' }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'توزيع الانتظار' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/coverage.png`, fullPage: true });

await tab('الاختبارات');
await page.getByRole('button', { name: 'توليد' }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/exams.png` });

await tab('البيانات');
await page.screenshot({ path: `${out}/data.png` });

await tab('المشاركة');
await page.screenshot({ path: `${out}/share.png` });

await tab('الجدول');
await page.getByRole('button', { name: 'طباعة' }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/print-preview.png` });
await page.getByRole('button', { name: 'إغلاق' }).click();

const mobile = await makePage({ width: 390, height: 844 });
await mobile.goto(base, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: `${out}/mobile-dashboard.png`, fullPage: true });
await mobile.getByRole('button', { name: 'الجدول', exact: true }).click();
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: `${out}/mobile-schedule.png`, fullPage: true });

const publicClasses = await makePage({ width: 1280, height: 900 });
await publicClasses.goto(`${base}#/classes`, { waitUntil: 'networkidle' });
await publicClasses.waitForTimeout(400);
await publicClasses.screenshot({ path: `${out}/public-classes.png` });

const publicLookup = await makePage({ width: 1280, height: 900 });
await publicLookup.goto(`${base}#/lookup`, { waitUntil: 'networkidle' });
await publicLookup.waitForTimeout(400);
await publicLookup.screenshot({ path: `${out}/public-lookup.png` });

await browser.close();

if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('OK: screenshots written, no console errors');
}


