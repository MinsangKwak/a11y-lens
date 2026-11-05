import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, stat } from 'node:fs/promises';
import { rendererServer, rendererBrowser, rendererBridge } from './helpers/renderer.mjs';

let server;
let browser;
before(async () => { server = await rendererServer(); browser = await rendererBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

test('JavaScript 응답 전에도 스타일이 적용된 시작 화면을 보여 준다', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await rendererBridge(page, { authDelay: 150 });
  let release;
  const scripts = new Promise((done) => { release = done; });
  await page.route('**/*.js', async (route) => { await scripts; await route.continue(); });
  try {
    await page.goto(server.origin, { waitUntil: 'commit' });
    await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(22, 24, 29)' && document.querySelector('h1'));
    assert.equal((await page.locator('[role="status"]').innerText()).replace(/\n+/g, '\n'), 'a11y-lens\n확인 중…');
    assert.equal(await page.locator('.providers').count(), 0);
    const before = await page.locator('h1').boundingBox();
    release();
    await page.locator('.providers button').first().waitFor();
    const after = await page.locator('h1').boundingBox();
    assert.deepEqual(after, before, 'HTML 시작 화면에서 React 로그인 화면으로 바뀌어도 제목은 움직이지 않는다');
    assert.deepEqual(errors, []);
  } finally {
    release();
    await page.close();
  }
});

test('좁은 화면과 느린 로그인 응답에서도 버튼 크기와 키보드 조작을 유지한다', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
  try {
    await rendererBridge(page);
    await page.goto(server.origin);
    const button = page.getByRole('button', { name: 'GitHub 로 계속' });
    await button.waitFor();
    const before = await button.boundingBox();
    await page.keyboard.press('Tab');
    assert.equal(await button.evaluate((el) => document.activeElement === el), true);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '브라우저에서 계속…' }).waitFor();
    assert.deepEqual(await page.getByRole('button', { name: '브라우저에서 계속…' }).boundingBox(), before);
    await page.waitForFunction(() => !document.querySelector('.providers button').disabled);
    assert.deepEqual(await page.evaluate(() => window.__rendererTest.signIns), ['github']);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally { await page.close(); }
});

test('같은 프레임의 resize와 ResizeObserver 알림은 배치 IPC 한 번으로 합친다', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  try {
    await rendererBridge(page, { signedIn: true });
    await page.goto(server.origin);
    await page.waitForFunction(() => window.__rendererTest.bounds.some((b) => b.width > 0));
    await settle(page);
    await page.evaluate(() => {
      window.__rendererTest.bounds.length = 0;
      document.querySelector('.app').style.gridTemplateColumns = '400px 1fr';
      for (let i = 0; i < 100; i++) dispatchEvent(new Event('resize'));
    });
    await settle(page);
    assert.deepEqual(await page.evaluate(() => window.__rendererTest.bounds), [{ x: 400, y: 0, width: 1040, height: 940 }]);
  } finally { await page.close(); }
});

test('배치가 바뀌지 않은 resize 알림에는 같은 좌표를 다시 전송하지 않는다', async () => {
  const page = await browser.newPage();
  try {
    await rendererBridge(page, { signedIn: true });
    await page.goto(server.origin);
    await page.waitForFunction(() => window.__rendererTest.bounds.some((b) => b.width > 0));
    await settle(page);
    await page.evaluate(() => {
      window.__rendererTest.bounds.length = 0;
      for (let i = 0; i < 100; i++) dispatchEvent(new Event('resize'));
    });
    await settle(page);
    assert.equal(await page.evaluate(() => window.__rendererTest.bounds.length), 0);
  } finally { await page.close(); }
});

test('로그아웃 뒤에는 대상 뷰를 숨기고 이전 배치 감시를 해제한다', async () => {
  const page = await browser.newPage();
  try {
    await rendererBridge(page, { signedIn: true });
    await page.goto(server.origin);
    await page.waitForFunction(() => window.__rendererTest.bounds.some((b) => b.width > 0));
    await page.getByRole('button', { name: '로그아웃' }).click();
    await page.locator('.providers button').first().waitFor();
    await settle(page);
    assert.deepEqual(await page.evaluate(() => window.__rendererTest.bounds.at(-1)), { x: 0, y: 0, width: 0, height: 0 });
    await page.evaluate(() => {
      window.__rendererTest.bounds.length = 0;
      dispatchEvent(new Event('resize'));
    });
    await settle(page);
    assert.equal(await page.evaluate(() => window.__rendererTest.bounds.length), 0);
  } finally { await page.close(); }
});

test('배포 renderer의 JavaScript와 CSS 용량이 시작 화면 예산을 넘지 않는다', async () => {
  const directory = new URL('../out/renderer/assets/', import.meta.url);
  let javascript = 0;
  let css = 0;
  for (const file of await readdir(directory)) {
    const bytes = (await stat(new URL(file, directory))).size;
    if (file.endsWith('.js')) javascript += bytes;
    if (file.endsWith('.css')) css += bytes;
  }
  assert.ok(javascript > 0 && javascript < 250_000, '초기 JavaScript는 250KB 미만이어야 한다: ' + javascript);
  assert.ok(css > 0 && css < 6_000, '전체 스타일은 6KB 미만이어야 한다: ' + css);
  await access(new URL('../out/preload/index.mjs', import.meta.url));
});

test('프로젝트 선택은 네이티브 키보드 동작과 44px 조작 높이를 유지한다', async () => {
  const page = await browser.newPage({ viewport: { width: 800, height: 940 } });
  try {
    await rendererBridge(page, { signedIn: true, projects: [{ id: 'first', name: '첫 프로젝트' }, { id: 'second', name: '두 번째 프로젝트' }] });
    await page.goto(server.origin);
    const select = page.getByRole('combobox', { name: '프로젝트' });
    await page.waitForFunction(() => document.querySelector('select')?.options.length === 2);
    await select.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await select.inputValue(), 'second');
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    assert.equal(await select.evaluate((el) => document.activeElement === el), true);
    assert.ok((await select.boundingBox()).height >= 44);
  } finally { await page.close(); }
});
