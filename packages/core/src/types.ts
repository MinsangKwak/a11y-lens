'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// types.ts — core 가 주고받는 모양. 플랫폼(Electron · CLI · 브라우저)에 의존하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

/** 검사 기준. 계약서가 가리키는 지침에 따라 호출하는 쪽이 정한다 */
export interface AuditOptions {
  /** 본문 글씨 최소 명암비. WCAG 2.1 AA 는 4.5 */
  minNormal: number;
  /** 큰 글씨 최소 명암비. WCAG 2.1 AA 는 3.0 */
  minLarge: number;
  /** 고칠 수 없다고 합의한 색. CSS 색 값 그대로 넣는다 (예: 게임 원작 타입색) */
  allowedColors: string[];
}

/** 왜 이 항목이 여기 들어왔는지 */
export type Verdict =
  /** 기준 미달 — 수정 요청 대상 */
  | 'fail'
  /** 잴 수 없음 — 사람이 눈으로 봐야 한다 (배경 그림 · 그라데이션 위 글자) */
  | 'undeterminable'
  /** 미달이지만 합의된 예외 */
  | 'allowed';

/** 한 건의 검사 결과. 외주사가 이것만 보고 그 자리를 찾을 수 있어야 한다 */
export interface Finding {
  verdict: Verdict;
  /** 실측 명암비. undeterminable 이면 null */
  ratio: number | null;
  /** 이 글씨에 적용된 기준값 — 큰 글씨면 minLarge */
  required: number;
  /** 큰 글씨로 판정했는지. 기준이 왜 3.0 인지 설명하는 근거가 된다 */
  large: boolean;
  /** 그 요소를 다시 찾을 수 있는 경로. nth-of-type 을 포함해 유일성을 확보한다 */
  selector: string;
  /** 합성까지 끝난 실제 글자색 · 바탕색. undeterminable 이면 bg 는 null */
  fg: string;
  bg: string | null;
  /** 보고서에 인용할 글귀 앞부분 */
  text: string;
  /** 스크린샷을 잘라 붙일 자리 (뷰포트 기준) */
  rect: { x: number; y: number; w: number; h: number };
  /** 글씨 크기 정보 — 큰 글씨 판정을 검증할 수 있게 남긴다 */
  font: { px: number; weight: number };
}

export interface AuditResult {
  findings: Finding[];
  /** 글자를 가진 요소를 몇 개 훑었는지 — 검사 범위를 보고서에 적기 위해 */
  scanned: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 접근성 규칙(axe 어댑터)이 주고받는 모양. 명암비와 어휘를 맞춘다 —
// 보고서에 두 결과가 나란히 들어가므로 verdict 의 뜻이 서로 달라지면 안 된다.
// ─────────────────────────────────────────────────────────────────────────────

/** axe 가 매긴 심각도. 우선순위를 매길 때 쓴다 */
export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

/** 접근성 위반 한 건. 외주사가 이것만 보고 그 자리를 고칠 수 있어야 한다 */
export interface Issue {
  /** axe 규칙 ID. 이력 대조의 열쇠 절반이다 */
  rule: string;
  /** 명암비 쪽 Verdict 와 같은 뜻 — undeterminable 은 사람이 봐야 하는 자리다 */
  verdict: Verdict;
  impact: Impact;
  /** 무엇이 잘못됐는지 한 줄. 보고서에 그대로 나간다 */
  what: string;
  /** axe 의 영문 설명과 문서 주소 — 근거를 되짚을 길을 남긴다 */
  help: string;
  helpUrl: string;
  /** 그 요소를 다시 찾을 경로. 프레임 안이면 ' → ' 로 이어 붙는다 */
  selector: string;
  /** 증거로 인용할 HTML 조각 */
  html: string;
  /** axe 가 적은 실패 사유 */
  reason: string;
}

export interface AxeResult {
  /** 기준 미달 — 수정 요청 대상 */
  issues: Issue[];
  /** 판단할 수 없어 사람에게 넘기는 자리 */
  review: Issue[];
  /** 검사 범위를 보고서에 적기 위한 수치 */
  rules: { tested: number; passed: number; violated: number };
}
