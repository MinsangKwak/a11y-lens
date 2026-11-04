'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// cli — 같은 엔진을 Playwright 로 배치 실행한다. CI 에 붙이는 길.
//
// 데스크톱이 사람의 눈을 빌리는 자리라면 여기는 기계가 반복하는 자리다.
// 둘이 같은 core 를 쓰기 때문에 "앱에서는 통과인데 CI 는 빨갛다" 가 생기지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';
import { AUDIT, AA, type AuditOptions, type Finding } from '@a11y-lens/core';

// 자리는 환경마다 다르다 — 러너가 설치한 곳을 환경변수로 받는다
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = pw.default ?? pw;

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const urls = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));

if (!urls.length) {
  console.error('쓰는 법: a11y-lens <url...> [--min 4.5] [--min-large 3.0] [--allow "#a8b820,#705848"] [--json 파일]');
  process.exit(2);
}

const opts: AuditOptions = {
  minNormal: Number(flag('min') ?? AA.minNormal),
  minLarge: Number(flag('min-large') ?? AA.minLarge),
  allowedColors: (flag('allow') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
};

/** 한 건을 사람이 읽을 한 줄로. 선택자와 수치가 없으면 고칠 수 없다 */
const line = (f: Finding): string =>
  f.verdict === 'undeterminable'
    ? `  [잴 수 없음] ${f.selector} · 글자 ${f.fg} · "${f.text}"`
    : `  ${f.ratio} / ${f.required}${f.large ? ' (큰 글씨)' : ''} · ${f.selector} · 글자 ${f.fg} / 바탕 ${f.bg} · "${f.text}"`;

const browser = await chromium.launch();
const report: { url: string; findings: Finding[]; scanned: number }[] = [];

for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    // content-visibility:auto 로 건너뛴 자리도 전부 켜서 잰다
    await page.addStyleTag({ content: '* { content-visibility: visible !important; }' }).catch(() => {});
    const result = await page.evaluate(AUDIT, opts);
    report.push({ url, ...result });
  } catch (error) {
    console.error(`열리지 않음 · ${url} → ${(error as Error).message.split('\n')[0]}`);
    report.push({ url, findings: [], scanned: 0 });
  }
  await page.close();
}
await browser.close();

let failed = 0;
for (const page of report) {
  const fail = page.findings.filter((f) => f.verdict === 'fail');
  const unknown = page.findings.filter((f) => f.verdict === 'undeterminable');
  const allowed = page.findings.filter((f) => f.verdict === 'allowed');
  failed += fail.length;

  console.log(`\n${page.url} — 훑은 글자 ${page.scanned}개 · 기준 ${opts.minNormal}/${opts.minLarge}`);
  if (fail.length) {
    console.log(`기준 미달 ${fail.length}건:`);
    for (const f of fail) console.log(line(f));
  }
  if (unknown.length) {
    // 버리지 않고 사람에게 넘기는 목록 — 히어로 · 배너가 여기 걸린다
    console.log(`사람이 볼 자리 ${unknown.length}건 (배경 그림 위 글자):`);
    for (const f of unknown) console.log(line(f));
  }
  if (allowed.length) console.log(`합의된 예외 ${allowed.length}건 (고치지 않는다)`);
  if (!page.findings.length) console.log('기준 아래로 떨어지는 글자 없음 ✅');
}

const out = flag('json');
if (out) {
  writeFileSync(out, JSON.stringify({ options: opts, at: new Date().toISOString(), pages: report }, null, 2));
  console.log(`\n${out} 에 적었다`);
}

// CI 에서 쓰려면 미달이 있을 때 실패해야 한다
process.exit(failed > 0 ? 1 : 0);
