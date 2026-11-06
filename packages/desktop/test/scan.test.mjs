import test from 'node:test';
import assert from 'node:assert/strict';
import { runScan, contrastOnly } from '../out/test/scan.js';

const opts = { minNormal: 4.5, minLarge: 3, allowedColors: [] };
const contrast = { scanned: 4, findings: [] };
const issue = {
  rule: 'image-alt', verdict: 'fail', impact: 'serious',
  what: '이미지에 대체 텍스트가 없다', help: '이미지 대체 텍스트',
  helpUrl: 'https://example.test/help', selector: '#image',
  html: '<img id="image">', reason: '대체 텍스트가 없다',
};
const review = { ...issue, rule: 'video-caption', verdict: 'undeterminable' };
const axe = {
  issues: [issue], review: [review],
  rules: { tested: 3, passed: 1, violated: 1 },
};

test('일반 검사는 명암비 다음 접근성을 실행하고 두 결과를 보존한다', async () => {
  const calls = [];
  const engines = {
    async audit(received) {
      calls.push('audit');
      assert.equal(received, opts);
      assert.equal(this, engines);
      return contrast;
    },
    async axe() {
      calls.push('axe');
      assert.equal(this, engines);
      return axe;
    },
  };
  const result = await runScan(engines, opts);
  assert.deepEqual(calls, ['audit', 'axe']);
  assert.deepEqual(result, { ...contrast, axe });
  assert.equal(result.axe.issues[0], issue);
  assert.equal(result.axe.review[0], review);
});

test('명암비 실패를 성공 결과로 바꾸거나 접근성을 계속 실행하지 않는다', async () => {
  const failure = new Error('명암비 검사 실패');
  let axeCalled = false;
  await assert.rejects(runScan({
    async audit() { throw failure; },
    async axe() { axeCalled = true; return axe; },
  }, opts), (error) => error === failure);
  assert.equal(axeCalled, false);
});

test('접근성 실패 시 명암비만 담은 성공 결과를 반환하지 않는다', async () => {
  const failure = new Error('접근성 검사 실패');
  await assert.rejects(runScan({
    async audit() { return contrast; },
    async axe() { throw failure; },
  }, opts), (error) => error === failure);
});

test('위반이 없어도 접근성 검사를 실행하고 완료 결과를 보존한다', async () => {
  const empty = { issues: [], review: [], rules: { tested: 3, passed: 3, violated: 0 } };
  let called = 0;
  const result = await runScan({
    async audit() { return contrast; },
    async axe() { called += 1; return empty; },
  }, opts);
  assert.equal(called, 1);
  assert.deepEqual(result.axe, empty);
});

test('이력에는 명암비만 전달하고 접근성 HTML과 사유는 제외한다', () => {
  const result = { ...contrast, axe };
  assert.deepEqual(contrastOnly(result), contrast);
  assert.deepEqual(Object.keys(contrastOnly(result)).sort(), ['findings', 'scanned']);
  assert.equal(result.axe, axe);
});
