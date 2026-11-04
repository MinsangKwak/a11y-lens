'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// axe.test.mjs — 어댑터. 규칙 자체는 axe 가 검증하므로 여기서 재지 않는다.
// 우리가 책임지는 것은 **날것의 결과를 보고서 모양으로 옮기는 일**이다 —
// 버린 것이 없는지, 합의된 예외를 제대로 빼는지, 같은 자리를 알아보는지.
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { AXE_RULES, AXE_SKIPPED, toIssues, diffIssues } from '../dist/index.js';

/** axe 결과 한 덩어리를 간단히 만든다 */
const rule = (id, nodes, extra = {}) => ({
  id, help: 'help for ' + id, helpUrl: 'https://x/' + id, impact: 'serious',
  nodes: nodes.map((target) => ({ target: [target], html: '<img>', failureSummary: 'Fix any of\n  the following', ...extra })),
});

test('위반과 판단 불가를 각각의 목록으로 옮긴다', () => {
  const r = toIssues({
    violations: [rule('image-alt', ['#a', '#b'])],
    incomplete: [rule('aria-hidden-focus', ['#c'])],
    passes: [rule('link-name', [])],
    inapplicable: [rule('video-caption', [])],
  });
  assert.equal(r.issues.length, 2, '요소마다 한 건이다 — 규칙 단위로 묶으면 자리를 잃는다');
  assert.deepEqual(r.issues.map((i) => i.selector), ['#a', '#b']);
  assert.equal(r.review.length, 1);
  assert.equal(r.review[0].verdict, 'undeterminable', 'incomplete 를 버리면 틀린 통과가 된다');
  assert.deepEqual(r.rules, { tested: 4, passed: 1, violated: 1 });
});

test('합의된 예외는 allowed 로 적는다', () => {
  // 고치지 않기로 한 것을 미달로 세면 보고서 숫자가 영원히 줄지 않는다
  const r = toIssues({ violations: [rule('image-alt', ['#a'])] }, { allowedRules: ['image-alt'] });
  assert.equal(r.issues[0].verdict, 'allowed');
  assert.equal(diffIssues([], r.issues).summary.after, 0, '예외는 미해결 수에 들어가지 않는다');
});

test('켠 규칙에는 한국어 한 줄이 붙고, 모르는 규칙은 axe 설명으로 버틴다', () => {
  const r = toIssues({ violations: [rule('image-alt', ['#a']), rule('made-up-rule', ['#b'])] });
  assert.equal(r.issues[0].what, '이미지에 대체 텍스트(alt)가 없다');
  assert.equal(r.issues[1].what, 'help for made-up-rule', '목록에 없어도 건을 버리지 않는다');
});

test('프레임 안의 자리는 경로를 이어 붙인다', () => {
  // target 이 중첩 배열로 오는데 그대로 두면 이력 대조의 열쇠가 되지 못한다
  const r = toIssues({ violations: [{ id: 'label', nodes: [{ target: [['iframe#f', '#q']] }] }] });
  assert.equal(r.issues[0].selector, 'iframe#f → #q');
});

test('모양이 다른 결과가 와도 터지지 않는다', () => {
  // 주입 실패 · 버전 차이로 빈 응답이 올 수 있다. 여기서 터지면 검사 전체가 멎는다
  assert.deepEqual(toIssues(undefined).issues, []);
  assert.deepEqual(toIssues({ violations: 'nope' }).issues, []);
  assert.equal(toIssues({ violations: [{ nodes: [{}] }] }).issues[0].selector, '');
});

test('증거 HTML 은 잘라서 담는다', () => {
  // 통째로 담으면 이력 표가 터진다 — 자리를 알아볼 만큼만 남긴다
  const long = '<div>' + 'x'.repeat(500) + '</div>';
  const r = toIssues({ violations: [rule('label', ['#a'], { html: long })] });
  assert.equal(r.issues[0].html.length, 200);
});

const at = (rule, selector, verdict = 'fail') =>
  ({ rule, verdict, impact: 'serious', what: '', help: '', helpUrl: '', selector, html: '', reason: '' });

test('고친 것 · 남은 것 · 새로 생긴 것을 가른다', () => {
  const d = diffIssues(
    [at('image-alt', '#a'), at('label', '#b')],
    [at('label', '#b'), at('link-name', '#c')],
  );
  assert.deepEqual(d.fixed.map((i) => i.rule), ['image-alt']);
  assert.deepEqual(d.remaining.map((i) => i.rule), ['label']);
  assert.deepEqual(d.added.map((i) => i.rule), ['link-name']);
  assert.deepEqual(d.summary, { before: 2, after: 2, fixed: 1, added: 1 });
});

test('같은 자리의 다른 규칙을 한 건으로 뭉개지 않는다', () => {
  // 열쇠가 선택자뿐이면 alt 를 고친 순간 label 위반까지 해결로 세어 버린다
  const d = diffIssues([at('image-alt', '#a'), at('label', '#a')], [at('label', '#a')]);
  assert.deepEqual(d.fixed.map((i) => i.rule), ['image-alt']);
  assert.equal(d.remaining.length, 1);
});

test('켠 규칙과 끈 규칙이 서로 겹치지 않는다', () => {
  // 겹치면 "껐다" 고 적어 둔 README 가 거짓말이 된다
  const on = new Set(AXE_RULES.map((r) => r.id));
  for (const s of AXE_SKIPPED) assert.equal(on.has(s.id), false, s.id + ' 이 양쪽에 있다');
  assert.equal(on.size, AXE_RULES.length, '규칙 ID 가 중복이다');
  for (const r of AXE_RULES) assert.ok(r.ko.length > 0, r.id + ' 에 한국어 설명이 없다');
});
