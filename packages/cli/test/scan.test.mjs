'use strict';

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function scan(scenarios, flags = []) {
  const dir = mkdtempSync(join(tmpdir(), 'a11y-lens-cli-'));
  const output = join(dir, 'report.json');
  try {
    const child = spawnSync(process.execPath, [
      fileURLToPath(new URL('../dist/index.js', import.meta.url)),
      ...flags,
      ...scenarios.map((scenario) => 'https://example.test/' + scenario),
      '--json', output,
    ], {
      env: {
        ...process.env,
        PLAYWRIGHT_MODULE: new URL('./fixtures/playwright.mjs', import.meta.url).href,
      },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.ifError(child.error);
    assert.equal(child.signal, null, child.stderr);
    return {
      code: child.status,
      stdout: child.stdout,
      stderr: child.stderr,
      report: JSON.parse(readFileSync(output, 'utf8')),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('두 검사를 마친 깨끗한 페이지는 종료코드 0이다', () => {
  const r = scan(['clean']);
  assert.equal(r.code, 0);
  assert.equal(r.report.pages[0].status, 'complete');
  assert.deepEqual(r.report.pages[0].errors, []);
  assert.equal(r.report.pages[0].axe.rules.tested, 1);
  assert.match(r.stdout, /켠 규칙에 걸리는 자리 없음/);
});

for (const [scenario, stage] of [['navigation-error', 'navigation'], ['contrast-error', 'contrast']]) {
  test(stage + ' 실패는 통과 문구 없이 종료코드 2와 원인을 남긴다', () => {
    const r = scan([scenario]);
    assert.equal(r.code, 2);
    assert.equal(r.report.pages[0].status, 'failed');
    assert.equal(r.report.pages[0].errors[0].stage, stage);
    assert.ok(r.report.pages[0].errors[0].message);
    assert.equal(r.report.pages[0].axe, null);
    assert.doesNotMatch(r.stdout, /✅/);
    assert.match(r.stdout, /검사 실패/);
  });
}

for (const scenario of ['axe-inject-error', 'axe-run-error', 'axe-string-error']) {
  test(scenario + '는 명암비 결과를 보존하되 규칙 통과를 표시하지 않는다', () => {
    const r = scan([scenario]);
    assert.equal(r.code, 2);
    assert.equal(r.report.pages[0].status, 'partial');
    assert.equal(r.report.pages[0].scanned, 7);
    assert.equal(r.report.pages[0].errors[0].stage, 'axe');
    assert.ok(r.report.pages[0].errors[0].message);
    assert.equal(r.report.pages[0].axe, null);
    assert.doesNotMatch(r.stdout, /켠 규칙에 걸리는 자리 없음/);
    assert.match(r.stdout, /검사 일부 실패/);
  });
}

test('실패한 URL 뒤의 페이지도 검사하고 전체는 실패로 종료한다', () => {
  const r = scan(['navigation-error', 'clean']);
  assert.equal(r.code, 2);
  assert.deepEqual(r.report.pages.map((p) => p.status), ['failed', 'complete']);
  assert.equal(r.report.pages[1].scanned, 7);
});

test('--no-axe는 URL을 삼키지 않고 규칙 검사를 생략한다', () => {
  const r = scan(['axe-inject-error'], ['--no-axe']);
  assert.equal(r.code, 0);
  assert.equal(r.report.pages[0].status, 'complete');
  assert.equal(r.report.pages[0].axe, null);
  assert.deepEqual(r.report.pages[0].errors, []);
  assert.equal(r.report.options.axe, null);
  assert.doesNotMatch(r.stdout, /규칙 검사 미완료|켠 규칙에 걸리는 자리 없음/);
});

for (const scenario of ['contrast-fail', 'axe-fail']) {
  test(scenario + ' 위반 발견은 기존 종료코드 1을 유지한다', () => {
    const r = scan([scenario]);
    assert.equal(r.code, 1);
    assert.equal(r.report.pages[0].status, 'complete');
    assert.deepEqual(r.report.pages[0].errors, []);
  });
}

test('실행 실패와 위반이 함께 있으면 종료코드 2이고 찾은 위반도 남긴다', () => {
  const r = scan(['axe-inject-error-contrast-fail']);
  assert.equal(r.code, 2);
  assert.equal(r.report.pages[0].findings.length, 1);
  assert.equal(r.report.pages[0].status, 'partial');
});

test('합의된 규칙 예외는 위반 종료코드에 포함하지 않는다', () => {
  const r = scan(['axe-fail'], ['--axe-allow', 'image-alt']);
  assert.equal(r.code, 0);
  assert.equal(r.report.pages[0].axe.issues[0].verdict, 'allowed');
});

test('규칙 판단 불가는 사람 확인 목록에 남긴다', () => {
  const r = scan(['axe-review']);
  assert.equal(r.code, 0);
  assert.equal(r.report.pages[0].axe.review[0].verdict, 'undeterminable');
  assert.match(r.stdout, /사람이 볼 자리/);
  assert.doesNotMatch(r.stdout, /켠 규칙에 걸리는 자리 없음/);
});
