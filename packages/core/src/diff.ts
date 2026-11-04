'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// diff.ts — **두 차례 검사를 대조한다.** 이 도구의 차별점이 여기 있다.
//
// 외주 검수의 본질은 "1차에 지적한 12건 중 9건이 수정됐다" 를 자동으로 내는 것이다.
// 한 번 재서 목록을 내는 건 누구나 한다. 두 번째가 어려운 이유는 **같은 자리를 알아보는 일**이다.
//
// 무엇을 같은 자리로 볼 것인가 — 선택자로 잡는다. 색은 쓰지 않는다.
// 색을 키에 넣으면 외주사가 색을 고친 순간 "1건 해결 + 1건 신규" 가 되어
// 수정한 사람을 벌주는 보고서가 나온다. 선택자는 고쳐도 남아 있는 쪽이다.
//
// 선택자가 바뀌는 경우(구조 개편)는 알아보지 못한다. 그건 신규로 잡히는 게 맞다 —
// 자리가 옮겨졌으면 다시 봐야 하기 때문이다.
// ─────────────────────────────────────────────────────────────────────────────

import type { Finding } from './types.js';

/** 양쪽에 남은 자리. 나아졌는지까지 적는다 */
export interface Remaining {
  before: Finding;
  after: Finding;
  /** 명암비가 올랐으면 양수. 둘 중 하나라도 잴 수 없으면 null */
  gained: number | null;
}

export interface Diff {
  /** 1차에 있었고 2차에 없다 — 고쳤다 */
  fixed: Finding[];
  /** 아직 남았다 */
  remaining: Remaining[];
  /** 2차에 새로 생겼다 — 고치는 과정에서 번진 것도 여기 걸린다 */
  added: Finding[];
  /** 보고서 첫 줄에 쓸 수치 */
  summary: { before: number; after: number; fixed: number; added: number };
}

/** 같은 자리인지 가르는 열쇠. DOM 위치만 본다 */
const keyOf = (f: Finding): string => f.selector;

/**
 * 두 차례 검사를 대조한다.
 * `allowed`(합의된 예외)는 양쪽에서 빼고 센다 — 고치지 않기로 한 것을 미해결로 세면
 * 보고서의 숫자가 영원히 줄지 않는다.
 */
export function diff(before: Finding[], after: Finding[]): Diff {
  const live = (list: Finding[]) => list.filter((f) => f.verdict !== 'allowed');
  const was = new Map(live(before).map((f) => [keyOf(f), f]));
  const now = new Map(live(after).map((f) => [keyOf(f), f]));

  const fixed: Finding[] = [];
  const remaining: Remaining[] = [];
  const added: Finding[] = [];

  for (const [key, f] of was) {
    const next = now.get(key);
    if (!next) { fixed.push(f); continue; }
    // 둘 다 수치가 있을 때만 변화량을 낸다 — 잴 수 없는 자리는 비교 대상이 아니다
    const gained = f.ratio !== null && next.ratio !== null ? +(next.ratio - f.ratio).toFixed(2) : null;
    remaining.push({ before: f, after: next, gained });
  }
  for (const [key, f] of now) if (!was.has(key)) added.push(f);

  return {
    fixed,
    remaining,
    added,
    summary: { before: was.size, after: now.size, fixed: fixed.length, added: added.length },
  };
}
