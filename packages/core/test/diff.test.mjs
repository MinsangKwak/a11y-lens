'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// diff.test.mjs — 이력 대조. 보고서의 숫자가 틀리면 도구를 못 쓰므로 경계마다 못을 박는다.
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { diff } from '../dist/index.js';

/** 검사 결과 한 건을 간단히 만든다 */
const at = (selector, ratio, verdict = 'fail') => ({
  verdict, ratio, required: 4.5, large: false, selector,
  fg: 'rgb(119, 119, 119)', bg: 'rgb(255, 255, 255)',
  text: selector, rect: { x: 0, y: 0, w: 10, h: 10 }, font: { px: 16, weight: 400 },
});

test('고친 것 · 남은 것 · 새로 생긴 것을 가른다', () => {
  const d = diff(
    [at('#a', 2.1), at('#b', 3.0), at('#c', 4.0)],
    [at('#b', 3.0), at('#c', 4.2), at('#d', 1.5)],
  );
  assert.deepEqual(d.fixed.map((f) => f.selector), ['#a']);
  assert.deepEqual(d.remaining.map((r) => r.after.selector), ['#b', '#c']);
  assert.deepEqual(d.added.map((f) => f.selector), ['#d']);
  assert.deepEqual(d.summary, { before: 3, after: 3, fixed: 1, added: 1 });
});

test('색을 고쳐도 같은 자리로 알아본다', () => {
  // 색을 열쇠에 넣으면 "1건 해결 + 1건 신규" 가 되어 수정한 사람을 벌준다
  const before = at('#a', 2.1);
  const after = { ...at('#a', 4.1), fg: 'rgb(90, 90, 90)' };
  const d = diff([before], [after]);
  assert.equal(d.fixed.length, 0);
  assert.equal(d.added.length, 0);
  assert.equal(d.remaining[0].gained, 2.0, '나아진 양을 적는다');
});

test('합의된 예외는 양쪽에서 빼고 센다', () => {
  // 고치지 않기로 한 것을 미해결로 세면 보고서 숫자가 영원히 줄지 않는다
  const d = diff([at('#a', 2.0, 'allowed'), at('#b', 2.0)], [at('#a', 2.0, 'allowed'), at('#b', 2.0)]);
  assert.deepEqual(d.summary, { before: 1, after: 1, fixed: 0, added: 0 });
});

test('잴 수 없는 자리는 변화량을 내지 않는다', () => {
  const unknown = { ...at('#hero', null, 'undeterminable'), bg: null };
  const d = diff([unknown], [unknown]);
  assert.equal(d.remaining[0].gained, null);
});

test('전부 고쳐지면 남은 것이 없다', () => {
  const d = diff([at('#a', 2.1), at('#b', 3.0)], []);
  assert.deepEqual(d.summary, { before: 2, after: 0, fixed: 2, added: 0 });
});
