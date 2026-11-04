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
