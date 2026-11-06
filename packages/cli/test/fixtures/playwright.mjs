'use strict';

// 외부 사이트나 브라우저 상태에 기대지 않고 셸의 실패 처리를 재현한다.
export const chromium = {
  async launch() {
    return {
      async newPage() {
        let scenario;
        return {
          async goto(url) {
            scenario = new URL(url).pathname.slice(1);
            if (scenario === 'navigation-error') throw new Error('이동 실패');
          },
          async addStyleTag() {},
          async evaluate(fn) {
            if (typeof fn === 'string') {
              if (scenario.startsWith('axe-inject-error')) throw new Error('주입 실패');
              return;
            }
            if (fn.name === 'AUDIT') {
              if (scenario === 'contrast-error') throw new Error('명암비 실행 실패');
              return {
                scanned: 7,
                findings: scenario.includes('contrast-fail') ? [{
                  verdict: 'fail', ratio: 2, required: 4.5, large: false,
                  selector: '#text', fg: '#aaa', bg: '#fff', text: '본문',
                  rect: { x: 0, y: 0, w: 10, h: 10 }, font: { px: 16, weight: 400 },
                }] : [],
              };
            }
            if (fn.name === 'RUN_AXE') {
              if (scenario === 'axe-run-error') throw new Error('규칙 실행 실패');
              if (scenario === 'axe-string-error') throw '문자열 실행 실패';
              const violation = {
                id: 'image-alt', impact: 'critical', help: '대체 텍스트 필요',
                helpUrl: 'https://example.test/image-alt',
                nodes: [{ target: ['#image'], html: '<img id="image">', failureSummary: 'alt 필요' }],
              };
              return {
                violations: scenario === 'axe-fail' ? [violation] : [],
                incomplete: scenario === 'axe-review' ? [violation] : [],
                passes: [{ id: 'label', nodes: [] }],
                inapplicable: [],
              };
            }
            throw new Error('예상하지 않은 평가 함수');
          },
          async close() {},
        };
      },
      async close() {},
    };
  },
};
