'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// cli — 같은 엔진을 Playwright 로 배치 실행한다. CI 에 붙이는 길.
//
// 데스크톱이 사람의 눈을 빌리는 자리라면 여기는 기계가 반복하는 자리다.
// 둘이 같은 core 를 쓰기 때문에 "앱에서는 통과인데 CI 는 빨갛다" 가 생기지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';
import {
  AUDIT, AA, AXE_RULES, AXE_SKIPPED, RUN_AXE, toIssues,
  type AuditOptions, type AxeOptions, type AxeResult, type Finding, type Issue,
} from '@a11y-lens/core';

// 자리는 환경마다 다르다 — 러너가 설치한 곳을 환경변수로 받는다
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = pw.default ?? pw;

// 규칙 엔진은 셸이 들고 있다 — core 는 의존성 0 을 지켜야 하므로 라이브러리를 품지 않는다
const axeMod = await import('axe-core');
const axeSource: string = (axeMod.default ?? axeMod).source;

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
};
// 값을 받지 않는 플래그. 여기 적지 않으면 파서가 뒤의 인자를 값으로 삼켜 URL 이 사라진다
const BARE = new Set(['--no-axe']);
const takesValue = (a: string | undefined): boolean => !!a?.startsWith('--') && !BARE.has(a);
const urls = argv.filter((a, i) => !a.startsWith('--') && !takesValue(argv[i - 1]));

if (!urls.length) {
  console.error('쓰는 법: a11y-lens <url...> [--min 4.5] [--min-large 3.0] [--allow "#a8b820,#705848"]');
  console.error('         [--no-axe] [--axe-rules image-alt,label] [--axe-allow bypass] [--json 파일]');
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

// 접근성 규칙은 기본으로 켠다 — 이름값을 하는 쪽이 기본이어야 한다
const useAxe = !argv.includes('--no-axe');
const axeOpts: AxeOptions = {
  rules: (flag('axe-rules') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  allowedRules: (flag('axe-allow') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
};
const axeIds = axeOpts.rules?.length ? axeOpts.rules : AXE_RULES.map((r) => r.id);

/** 빈 결과. 주입이 막힌 페이지에서도 명암비 결과는 내보내야 한다 */
const NO_AXE: AxeResult = { issues: [], review: [], rules: { tested: 0, passed: 0, violated: 0 } };

/** 심각한 것부터 보여 주려는 가중치 */
const WEIGHT: Record<string, number> = { critical: 3, serious: 2, moderate: 1, minor: 0 };

/** 접근성 위반 한 건을 사람이 읽을 한 줄로 */
const rule = (i: Issue): string => `  [${i.impact}] ${i.what} · ${i.selector} · ${i.rule}`;

const browser = await chromium.launch();
const report: { url: string; findings: Finding[]; scanned: number; axe: AxeResult }[] = [];

for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    // content-visibility:auto 로 건너뛴 자리도 전부 켜서 잰다
    await page.addStyleTag({ content: '* { content-visibility: visible !important; }' }).catch(() => {});
    const result = await page.evaluate(AUDIT, opts);

    let axe = NO_AXE;
    if (useAxe) {
      try {
        // addScriptTag 가 아니라 evaluate 로 넣는다 — 대상 페이지의 CSP 가 script 태그를 막는다
        await page.evaluate(axeSource);
        axe = toIssues(await page.evaluate(RUN_AXE, axeIds), axeOpts);
      } catch (error) {
        // 규칙 검사만 실패해도 명암비 결과는 살린다. 둘은 서로의 전제가 아니다
        console.error(`접근성 규칙을 돌리지 못함 · ${url} → ${(error as Error).message.split('\n')[0]}`);
      }
    }
    report.push({ url, ...result, axe });
  } catch (error) {
    console.error(`열리지 않음 · ${url} → ${(error as Error).message.split('\n')[0]}`);
    report.push({ url, findings: [], scanned: 0, axe: NO_AXE });
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

  const issues = page.axe.issues.filter((i) => i.verdict === 'fail');
  const allowedRules = page.axe.issues.filter((i) => i.verdict === 'allowed');
  failed += issues.length;

  const range = useAxe ? ` · 규칙 ${page.axe.rules.tested}개` : '';
  console.log(`\n${page.url} — 훑은 글자 ${page.scanned}개 · 기준 ${opts.minNormal}/${opts.minLarge}${range}`);
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

  if (issues.length) {
    // 심각한 것부터 — 외주사는 목록 위에서부터 고친다
    console.log(`접근성 위반 ${issues.length}건:`);
    for (const i of [...issues].sort((a, b) => WEIGHT[b.impact] - WEIGHT[a.impact])) console.log(rule(i));
  }
  if (page.axe.review.length) {
    console.log(`사람이 볼 자리 ${page.axe.review.length}건 (규칙으로 판단 불가):`);
    for (const i of page.axe.review) console.log(rule(i));
  }
  if (allowedRules.length) console.log(`합의된 예외 ${allowedRules.length}건 (규칙, 고치지 않는다)`);
  if (useAxe && !page.axe.issues.length && !page.axe.review.length) console.log('켠 규칙에 걸리는 자리 없음 ✅');
}

const out = flag('json');
if (out) {
  // 끈 규칙까지 적는다 — 무엇을 보지 않았는지 모르면 보고서를 신뢰할 수 없다
  const meta = { contrast: opts, axe: useAxe ? { rules: axeIds, skipped: AXE_SKIPPED } : null };
  writeFileSync(out, JSON.stringify({ options: meta, at: new Date().toISOString(), pages: report }, null, 2));
  console.log(`\n${out} 에 적었다`);
}

// CI 에서 쓰려면 미달이 있을 때 실패해야 한다
process.exit(failed > 0 ? 1 : 0);
