'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Findings — 결과 목록. 수백 건이 나오므로 묶음과 가름이 없으면 쓸 수 없다.
//
// 같은 결함이 공통 머리줄 · 바닥글에서 페이지마다 반복된다. 선택자+색으로 묶어
// "N 곳에서 발견" 으로 접는다. 안 하면 항목이 수백 개가 되어 아무도 안 본다.
// ─────────────────────────────────────────────────────────────────────────────

import type { Finding, Verdict } from '@a11y-lens/core';

const LABEL: Record<Verdict, string> = {
  fail: '기준 미달',
  undeterminable: '사람이 볼 자리',
  allowed: '합의된 예외',
};

/** 선택자와 색이 같으면 한 건으로 본다 */
function groupOf(f: Finding): string {
  return `${f.selector}|${f.fg}|${f.bg ?? '-'}`;
}

export function Findings({ items, onPick }: { items: Finding[]; onPick: (f: Finding) => void }) {
  const groups = new Map<string, Finding[]>();
  for (const f of items) {
    const key = groupOf(f);
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  if (!groups.size) return <p className="empty">기준 아래로 떨어지는 글자가 없습니다.</p>;

  return (
    <ul className="findings">
      {[...groups.values()].map((same) => {
        const f = same[0];
        return (
          <li key={groupOf(f)} className={`finding ${f.verdict}`}>
            <button type="button" onClick={() => onPick(f)}>
              <span className="head">
                <b>{f.verdict === 'undeterminable' ? '잴 수 없음' : `${f.ratio} / ${f.required}`}</b>
                {f.large && <em>큰 글씨</em>}
                {same.length > 1 && <em>{same.length}곳</em>}
              </span>
              <span className="text">“{f.text}”</span>
              <span className="meta">{f.selector}</span>
              <span className="swatch">
                <i style={{ background: f.fg }} />
                {f.bg && <i style={{ background: f.bg }} />}
                {f.font.px}px · {f.font.weight}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export { LABEL };
