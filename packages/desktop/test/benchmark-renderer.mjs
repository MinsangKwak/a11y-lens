import { writeFile } from 'node:fs/promises';
import { rendererServer, rendererBrowser, rendererBridge } from './helpers/renderer.mjs';

const [baselineDirectory, currentDirectory, output] = process.argv.slice(2);
if (!baselineDirectory || !currentDirectory || !output) throw new Error('사용법: node test/benchmark-renderer.mjs 변경전폴더 변경후폴더 결과파일');

const baseline = await rendererServer(baselineDirectory);
const current = await rendererServer(currentDirectory);
const browser = await rendererBrowser();
const profile = { downloadKbps: 400, uploadKbps: 400, latencyMs: 400, cpuSlowdown: 4, cache: false };
const runs = [];

try {
  for (let repeat = 1; repeat <= 3; repeat++) {
    for (const [version, origin] of [['before', baseline.origin], ['after', current.origin]]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
      try {
        const page = await context.newPage();
        await rendererBridge(page);
        await page.addInitScript(() => {
          window.__layoutShift = 0;
          new PerformanceObserver((entries) => {
            for (const entry of entries.getEntries()) if (!entry.hadRecentInput) window.__layoutShift += entry.value;
          }).observe({ type: 'layout-shift', buffered: true });
        });
        const session = await context.newCDPSession(page);
        await session.send('Network.enable');
        await session.send('Network.setCacheDisabled', { cacheDisabled: true });
        await session.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latencyMs, downloadThroughput: profile.downloadKbps * 1000 / 8, uploadThroughput: profile.uploadKbps * 1000 / 8 });
        await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown });
        await page.goto(origin, { waitUntil: 'commit', timeout: 60_000 });
        await page.locator('.providers button').first().waitFor({ timeout: 60_000 });
        const readyMs = await page.evaluate(() => performance.now());
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        const metrics = await page.evaluate(() => ({
          fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          cls: window.__layoutShift,
          resourceBytes: performance.getEntriesByType('resource').reduce((sum, resource) => sum + resource.encodedBodySize, 0),
        }));
        const run = { repeat, version, readyMs, ...metrics };
        runs.push(run);
        console.log(JSON.stringify(run));
      } finally { await context.close(); }
    }
  }
  await writeFile(output, JSON.stringify({ profile, browser: browser.version(), runs }, null, 2) + '\n');
} finally {
  await browser.close();
  await baseline.close();
  await current.close();
}
