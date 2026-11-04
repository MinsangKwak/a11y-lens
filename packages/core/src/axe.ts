'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// axe.ts — **접근성 규칙 어댑터.** 규칙은 자작하지 않고 axe-core 를 빌려 쓴다.
//
// 왜 빌려 쓰나 — 접근성 규칙은 판정 경계가 많고, 그 경계는 ARIA 명세와 함께 움직인다.
// 직접 쓰면 유지가 안 되고, 틀린 지적 한 건이 보고서 전체의 신뢰를 깎는다.
//
// 왜 어댑터가 core 에 있나 — 잣대는 한 벌이어야 한다. 규칙 선별과 결과 정규화가
// cli · desktop 에 흩어지면 "앱에서는 통과인데 CI 는 빨갛다" 가 생긴다.
//
// axe-core **패키지 자체는 core 의 의존성이 아니다.** core 는 의존성 0 을 지킨다.
// 라이브러리 소스를 페이지에 넣는 일은 셸(cli · desktop)이 한다 — 셸이 axe.source 를
// 주입한 뒤 RUN_AXE 를 돌리고, 날것의 결과를 toIssues 가 보고서 모양으로 바꾼다.
// ─────────────────────────────────────────────────────────────────────────────

import type { AxeResult, Impact, Issue } from './types.js';

/** 켠 규칙 하나. ko 는 보고서에 그대로 나갈 한 줄이다 — 외주사는 영문 규칙명을 읽지 않는다 */
export interface AxeRule {
  readonly id: string;
  readonly ko: string;
}

/**
 * 켜는 규칙.
 *
 * 고르는 기준은 셋이다 — **WCAG A·AA 에 걸릴 것**, **수정 요청으로 바로 옮길 수 있을 것**,
 * **거짓 양성이 드물 것.** axe 의 best-practice · experimental · AAA 태그는 전부 뺐다.
 * 전체(105개)를 돌리면 "이론상 위반" 이 수십 건 나오고, 그런 보고서는 아무도 읽지 않는다.
 *
 * 규칙 ID 는 axe-core 4.14.0 의 getRules() 에서 그대로 옮겼다 — 기억으로 적지 않는다.
 */
export const AXE_RULES: readonly AxeRule[] = [
  // ── 대체 텍스트. 스크린리더가 그림을 읽는 유일한 길이다
  { id: 'image-alt', ko: '이미지에 대체 텍스트(alt)가 없다' },
  { id: 'input-image-alt', ko: '이미지 버튼(input type=image)에 대체 텍스트가 없다' },
  { id: 'area-alt', ko: '이미지맵 영역(area)에 대체 텍스트가 없다' },
  { id: 'object-alt', ko: 'object 요소에 대체 텍스트가 없다' },
  { id: 'role-img-alt', ko: 'role="img" 요소에 읽을 이름이 없다' },
  { id: 'svg-img-alt', ko: '그림 역할의 SVG 에 읽을 이름이 없다' },
  { id: 'server-side-image-map', ko: '서버측 이미지맵을 썼다 — 키보드로 쓸 수 없다' },
  { id: 'video-caption', ko: '동영상에 자막(track)이 없다' },

  // ── 이름 · 역할 · 값. 이름 없는 조작 요소는 "버튼" 이라고만 읽힌다
  { id: 'button-name', ko: '버튼에 읽을 이름이 없다' },
  { id: 'link-name', ko: '링크에 읽을 이름이 없다' },
  { id: 'input-button-name', ko: '입력 버튼에 읽을 이름이 없다' },
  { id: 'select-name', ko: '선택 상자(select)에 이름표가 없다' },
  { id: 'summary-name', ko: 'summary 에 읽을 이름이 없다' },
  { id: 'aria-command-name', ko: 'ARIA 조작 요소(button·link·menuitem)에 이름이 없다' },
  { id: 'aria-input-field-name', ko: 'ARIA 입력 요소에 이름이 없다' },
  { id: 'aria-toggle-field-name', ko: 'ARIA 토글 요소(체크박스·스위치)에 이름이 없다' },
  { id: 'aria-tab-name', ko: '탭(role=tab)에 이름이 없다' },
  { id: 'aria-meter-name', ko: 'role="meter" 에 이름이 없다' },
  { id: 'aria-progressbar-name', ko: '진행 막대에 이름이 없다' },
  { id: 'aria-tooltip-name', ko: '툴팁에 이름이 없다' },

  // ── 폼. 이름표가 없으면 무엇을 적는 칸인지 알 수 없다
  { id: 'label', ko: '입력 칸에 이름표(label)가 연결되지 않았다' },
  { id: 'form-field-multiple-labels', ko: '한 입력 칸에 이름표가 여럿이다 — 무엇이 읽힐지 정해지지 않는다' },
  { id: 'autocomplete-valid', ko: 'autocomplete 값이 명세에 없는 값이다' },

  // ── ARIA 유효성. 잘못 쓴 ARIA 는 안 쓴 것보다 나쁘다 — 엉뚱한 역할로 읽힌다
  { id: 'aria-allowed-attr', ko: '그 역할에 허용되지 않는 ARIA 속성을 썼다' },
  { id: 'aria-conditional-attr', ko: '조건이 맞지 않는 자리에 ARIA 속성을 썼다' },
  { id: 'aria-deprecated-role', ko: '폐기된 ARIA 역할을 썼다' },
  { id: 'aria-prohibited-attr', ko: '그 요소에 금지된 ARIA 속성을 썼다' },
  { id: 'aria-required-attr', ko: '그 역할에 반드시 필요한 ARIA 속성이 없다' },
  { id: 'aria-required-children', ko: '그 역할이 요구하는 자식 요소가 없다' },
  { id: 'aria-required-parent', ko: '그 역할이 요구하는 부모 요소 안에 있지 않다' },
  { id: 'aria-roles', ko: '존재하지 않는 ARIA 역할 이름을 썼다' },
  { id: 'aria-valid-attr', ko: '존재하지 않는 ARIA 속성 이름을 썼다' },
  { id: 'aria-valid-attr-value', ko: 'ARIA 속성 값이 유효하지 않다' },
  { id: 'aria-braille-equivalent', ko: '점자용 속성에 대응하는 일반 이름이 없다' },
  { id: 'aria-hidden-body', ko: 'body 에 aria-hidden 을 걸었다 — 페이지 전체가 읽히지 않는다' },
  { id: 'aria-hidden-focus', ko: 'aria-hidden 안에 초점이 가는 요소가 있다 — 보이지 않는 곳에 초점이 갇힌다' },
  { id: 'duplicate-id-aria', ko: 'ARIA 가 가리키는 id 가 중복이다 — 엉뚱한 요소를 가리킨다' },

  // ── 구조. 목록 · 표의 뼈대가 틀리면 읽는 순서가 무너진다
  { id: 'list', ko: '목록(ul·ol) 안에 li 가 아닌 요소가 있다' },
  { id: 'listitem', ko: 'li 가 목록 밖에 있다' },
  { id: 'definition-list', ko: '정의 목록(dl)의 구성이 올바르지 않다' },
  { id: 'dlitem', ko: 'dt·dd 가 dl 밖에 있다' },
  { id: 'th-has-data-cells', ko: '표의 제목 칸(th)에 대응하는 데이터 칸이 없다' },
  { id: 'td-headers-attr', ko: 'headers 속성이 같은 표의 칸을 가리키지 않는다' },

  // ── 언어. 선언이 없으면 음성합성이 엉뚱한 발음으로 읽는다
  { id: 'html-has-lang', ko: 'html 에 lang 선언이 없다' },
  { id: 'html-lang-valid', ko: 'html 의 lang 값이 유효한 언어 코드가 아니다' },
  { id: 'html-xml-lang-mismatch', ko: 'lang 과 xml:lang 의 값이 다르다' },
  { id: 'valid-lang', ko: '본문 안 lang 값이 유효한 언어 코드가 아니다' },

  // ── 제목 · 프레임. 탭과 프레임을 구별하는 유일한 단서다
  { id: 'document-title', ko: '페이지에 title 이 없다' },
  { id: 'frame-title', ko: 'iframe 에 title 이 없다' },
  { id: 'frame-title-unique', ko: 'iframe 의 title 이 서로 겹친다' },
  { id: 'frame-focusable-content', ko: 'tabindex="-1" 인 프레임 안에 초점이 가는 요소가 있다' },

  // ── 키보드. 마우스를 쓸 수 없는 사람이 막히는 자리다
  { id: 'bypass', ko: '반복 영역을 건너뛸 수단(건너뛰기 링크·랜드마크·제목)이 없다' },
  { id: 'nested-interactive', ko: '조작 요소 안에 조작 요소가 들어 있다 — 안쪽에 초점이 가지 않는다' },
  { id: 'scrollable-region-focusable', ko: '스크롤되는 영역에 키보드 초점이 가지 않는다' },

  // ── 시간 · 자동 재생. 멈출 수 없는 움직임은 읽기를 막는다
  { id: 'blink', ko: 'blink 요소를 썼다 — 멈출 수 없이 깜빡인다' },
  { id: 'marquee', ko: 'marquee 요소를 썼다 — 멈출 수 없이 흐른다' },
  { id: 'meta-refresh', ko: 'meta refresh 로 자동 새로고침한다 — 읽던 자리를 잃는다' },
  { id: 'no-autoplay-audio', ko: '소리가 자동 재생되고 멈출 수단이 없다' },

  // ── 확대 · 간격. 저시력 사용자가 글씨를 키우는 길을 막는 설정이다
  { id: 'meta-viewport', ko: 'viewport 설정이 확대를 막는다' },
  { id: 'avoid-inline-spacing', ko: '인라인 !important 로 글자 간격 조정을 막는다' },
];

/**
 * 일부러 끄는 규칙. **무엇을 껐는지 적지 않으면 "검사했다" 는 말이 과장이 된다.**
 * README 의 한계 절과 이 목록이 같은 내용을 말해야 한다.
 */
export const AXE_SKIPPED: readonly { readonly id: string; readonly why: string }[] = [
  { id: 'color-contrast', why: '자작 엔진이 같은 것을 재고 기준값(minNormal·minLarge)이 설정으로 움직인다 — 둘을 함께 켜면 같은 자리에 다른 수치가 두 번 나온다' },
  { id: 'color-contrast-enhanced', why: 'AAA 기준이다. 외주 계약이 가리키는 수준을 넘는다' },
  { id: 'link-in-text-block', why: '색만으로 링크를 구분했는지 보는 규칙이라 명암비 엔진과 판정이 겹친다' },
  { id: 'target-size', why: '인라인 링크에서 거짓 양성이 잦다. 손으로 재는 편이 정확하다' },
  { id: 'heading-order', why: 'best-practice 다. 디자인상 정당한 건너뛰기를 전부 위반으로 잡는다' },
  { id: 'region', why: 'best-practice 다. 랜드마크 밖 텍스트를 모두 잡아 건수만 부풀린다' },
];

/** 한 번 돌릴 때의 설정 */
export interface AxeOptions {
  /** 켤 규칙 ID. 비우면 AXE_RULES 전체 */
  rules?: string[];
  /** 고치지 않기로 합의한 규칙. 보고는 하되 미해결로 세지 않는다 — allowedColors 와 같은 뜻이다 */
  allowedRules?: string[];
}

/**
 * 페이지 안에서 돌 함수. **AUDIT 과 같은 제약을 받는다 — 바깥 스코프의 값을 쓸 수 없다.**
 * 셸이 axe-core 소스를 먼저 넣어 window.axe 를 만들어 둔 뒤에 부른다.
 */
export const RUN_AXE = async (ids: string[]): Promise<unknown> => {
  const axe = (globalThis as unknown as { axe?: Record<string, Function> }).axe;
  if (!axe) throw new Error('axe-core 가 주입되지 않았다 — 셸이 axe.source 를 먼저 넣어야 한다');
  return await axe.run(document, {
    runOnly: { type: 'rule', values: ids },
    // 보고서에 쓰지 않는 것은 받지 않는다 — 날것의 결과는 한 페이지에 수 MB 가 된다
    resultTypes: ['violations', 'incomplete'],
    elementRef: false,
    selectors: true,
    ancestry: false,
    xpath: false,
    performanceTimer: false,
  });
};

/** axe 의 심각도. 모르는 값이 오면 중간으로 둔다 — 등급 때문에 건을 버리지 않는다 */
const impactOf = (v: unknown): Impact =>
  v === 'critical' || v === 'serious' || v === 'moderate' || v === 'minor' ? v : 'moderate';

/**
 * 그 자리를 다시 찾을 경로.
 * axe 의 target 은 프레임 경로라 중첩 배열로 온다 — 평탄화해 한 줄로 펴야
 * 이력 대조의 열쇠로 쓸 수 있다.
 */
const targetOf = (t: unknown): string =>
  Array.isArray(t)
    ? (t.flat(9) as unknown[]).filter((x): x is string => typeof x === 'string').join(' → ')
    : String(t ?? '');

/** 날것의 결과에서 쓸 것만 꺼낸다. 모양이 달라도 터지지 않게 전부 방어적으로 읽는다 */
type RawNode = { target?: unknown; html?: unknown; failureSummary?: unknown; impact?: unknown };
type RawRule = { id?: unknown; help?: unknown; helpUrl?: unknown; impact?: unknown; nodes?: unknown };
type RawResult = { violations?: unknown; incomplete?: unknown; passes?: unknown; inapplicable?: unknown };

const list = (v: unknown): RawRule[] => (Array.isArray(v) ? (v as RawRule[]) : []);

/**
 * 날것의 axe 결과를 보고서 모양으로 바꾼다.
 *
 * **incomplete 를 버리지 않는다.** axe 가 "판단할 수 없다" 고 한 자리는 명암비 엔진의
 * undeterminable 과 같은 성격이고, 조용히 건너뛰면 틀린 통과가 된다.
 */
export function toIssues(raw: unknown, opts: AxeOptions = {}): AxeResult {
  const ko = new Map(AXE_RULES.map((r) => [r.id, r.ko]));
  const allowed = new Set(opts.allowedRules ?? []);
  const r = (raw ?? {}) as RawResult;

  const unpack = (rules: RawRule[], undeterminable: boolean): Issue[] => {
    const out: Issue[] = [];
    for (const rule of rules) {
      const id = String(rule.id ?? '');
      const nodes = Array.isArray(rule.nodes) ? (rule.nodes as RawNode[]) : [];
      for (const n of nodes) {
        out.push({
          rule: id,
          // 합의된 예외는 미달로 세지 않는다 — 고치지 않기로 한 것을 세면 숫자가 줄지 않는다
          verdict: allowed.has(id) ? 'allowed' : undeterminable ? 'undeterminable' : 'fail',
          impact: impactOf(n.impact ?? rule.impact),
          what: ko.get(id) ?? String(rule.help ?? id),
          help: String(rule.help ?? ''),
          helpUrl: String(rule.helpUrl ?? ''),
          selector: targetOf(n.target),
          // 보고서에 붙일 증거 한 조각. 통째로 담으면 이력 표가 터진다
          html: String(n.html ?? '').slice(0, 200),
          reason: String(n.failureSummary ?? '').replace(/\s+/g, ' ').trim(),
        });
      }
    }
    return out;
  };

  const violations = list(r.violations);
  const incomplete = list(r.incomplete);
  const passes = list(r.passes);
  const inapplicable = list(r.inapplicable);

  return {
    issues: unpack(violations, false),
    review: unpack(incomplete, true),
    rules: {
      tested: violations.length + incomplete.length + passes.length + inapplicable.length,
      passed: passes.length,
      violated: violations.length,
    },
  };
}

/**
 * 두 차례의 접근성 검사를 대조한다. 명암비 쪽 diff 와 같은 생각이되 열쇠가 다르다 —
 * **규칙 + 자리**를 함께 본다. 같은 자리에서 다른 규칙이 걸릴 수 있어 선택자만으로는 겹친다.
 */
export interface IssueDiff {
  fixed: Issue[];
  remaining: Issue[];
  added: Issue[];
  summary: { before: number; after: number; fixed: number; added: number };
}

const issueKey = (i: Issue): string => i.rule + '@' + i.selector;

export function diffIssues(before: Issue[], after: Issue[]): IssueDiff {
  // allowed 는 양쪽에서 뺀다 — 명암비 쪽과 같은 규칙이어야 보고서가 한 벌로 읽힌다
  const live = (l: Issue[]) => l.filter((i) => i.verdict !== 'allowed');
  const was = new Map(live(before).map((i) => [issueKey(i), i]));
  const now = new Map(live(after).map((i) => [issueKey(i), i]));

  const fixed: Issue[] = [];
  const remaining: Issue[] = [];
  const added: Issue[] = [];

  for (const [key, i] of was) (now.has(key) ? remaining : fixed).push(now.get(key) ?? i);
  for (const [key, i] of now) if (!was.has(key)) added.push(i);

  return {
    fixed,
    remaining,
    added,
    summary: { before: was.size, after: now.size, fixed: fixed.length, added: added.length },
  };
}
