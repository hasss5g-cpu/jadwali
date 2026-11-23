import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

/**
 * ينشر dist/ على فرع gh-pages مباشرة (لا يحتاج صلاحية workflow في GitHub).
 * الاستخدام: pnpm build && pnpm deploy:pages
 */
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
if (!existsSync('dist/index.html')) {
  console.error('لا يوجد بناء في dist/. شغّل pnpm build أولًا.');
  process.exit(1);
}

writeFileSync('dist/.nojekyll', '');
const git = (...args) => execFileSync('git', ['-C', 'dist', ...args], { stdio: 'pipe' });

if (!existsSync('dist/.git')) git('init', '-q', '-b', 'gh-pages');
git('checkout', '-q', '-B', 'gh-pages');
git('add', '-A');
try {
  git('commit', '-q', '-m', 'نشر جدولي');
} catch {
  console.log('لا تغييرات جديدة للنشر.');
}
execFileSync('git', [
  '-C', 'dist',
  '-c', 'user.name=jadwali-deploy',
  '-c', 'user.email=deploy@users.noreply.github.com',
  'push', '-f', remote, 'HEAD:gh-pages',
], { stdio: 'inherit' });

console.log('نُشر البناء على فرع gh-pages.');
