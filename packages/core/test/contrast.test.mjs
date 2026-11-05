'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// contrast.test.mjs — 손으로 계산한 명암비 사례로 엔진을 검증한다.
// 기준선 바로 위 · 바로 아래를 한 쌍씩 둔 이유: 한쪽만 두면 기준을 잘못 옮겨도 통과한다.
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { AUDIT, AA } from '../dist/index.js';

// 작업 공간이 설치한 playwright 를 쓴다. 특정 기기의 절대 경로를 적으면
// 그 기기에서만 도는 테스트가 된다 — CI 에서 ERR_MODULE_NOT_FOUND 로 터진 자리다.
// PLAYWRIGHT_MODULE 은 러너가 다른 곳에 설치한 경우를 위해 남긴다
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = (pw.default ?? pw).chromium;
const url = pathToFileURL(new URL('./fixtures/contrast.html', import.meta.url).pathname).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await page.goto(url);
const result = await page.evaluate(AUDIT, { ...AA, allowedColors: ['#a8b820'] });
await browser.close();

// 선택자 경로에서 id 를 꺼내 사례별로 묶는다
const by = new Map();
for (const f of result.findings) {
  const id = (f.selector.match(/#([\w-]+)/) || [])[1];
  if (id) by.set(id, f);
}

test('기준선 바로 위는 걸리지 않는다 (4.54 ≥ 4.5)', () => {
  assert.equal(by.has('pass'), false);
});

test('기준선 바로 아래는 걸린다 (4.48 < 4.5)', () => {
  assert.equal(by.get('fail')?.verdict, 'fail');
  assert.equal(by.get('fail')?.required, 4.5);
});

test('큰 글씨는 3.0 기준을 적용한다', () => {
  assert.equal(by.has('large-pass'), false, '24px 3.03 은 통과해야 한다');
  assert.equal(by.has('bold-large'), false, '19px 굵게도 큰 글씨다');
  // 같은 색인데 작으면 걸린다 — 기준 분기가 실제로 동작하는지 보는 짝
  assert.equal(by.get('large-as-normal')?.verdict, 'fail');
  assert.equal(by.get('large-as-normal')?.large, false);
});

test('그림 위 글자는 추측하지 않고 "잴 수 없음" 으로 넘긴다', () => {
  assert.equal(by.get('onimage')?.verdict, 'undeterminable');
  assert.equal(by.get('onimage')?.ratio, null);
});

test('투명 조상을 거쳐 어두운 바탕을 찾는다', () => {
  assert.equal(by.has('dark'), false, '흰색으로 가정하면 흰 글자가 전부 걸린다');
});

test('조상의 opacity 를 글자에 반영한다', () => {
  assert.equal(by.get('faded')?.verdict, 'fail');
});

test('합의된 예외 색은 allowed 로 가른다', () => {
  assert.equal(by.get('allowed')?.verdict, 'allowed');
});

test('훑은 개수를 보고한다', () => {
  assert.ok(result.scanned >= 9, `훑은 요소 ${result.scanned}개`);
});
