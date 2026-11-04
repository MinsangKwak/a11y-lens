'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Compare — 1차 · 2차 대조 결과. 이 도구의 차별점이 보이는 화면.
//
// 첫 줄에 수치를 둔다. 외주사에 보내는 메일의 첫 문장이 여기서 나온다.
// ─────────────────────────────────────────────────────────────────────────────

import { diff, type Finding } from '@a11y-lens/core';
import type { Snapshot } from '../../preload/index.js';

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR');

export function Compare({ pair }: { pair: Snapshot[] }) {
  if (pair.length < 2) return <p className="empty">대조할 이력이 아직 한 차례뿐입니다.</p>;

  const [before, after] = pair;
  const d = diff(before.findings, after.findings);
  const label = (f: Finding) => `${f.selector} · “${f.text}”`;

  return (
    <section className="compare">
      <p className="headline">
        1차 <b>{d.summary.before}건</b> 중 <b>{d.summary.fixed}건 수정</b>
        {d.summary.added > 0 && <> · 새로 생긴 것 <b>{d.summary.added}건</b></>}
      </p>
      <p className="when">{when(before.at)} → {when(after.at)}</p>

      {d.fixed.length > 0 && (
        <details open>
          <summary>고쳐진 자리 {d.fixed.length}건</summary>
          <ul>{d.fixed.map((f) => <li key={f.selector}>{label(f)}</li>)}</ul>
        </details>
      )}

      {d.remaining.length > 0 && (
        <details open>
          <summary>아직 남은 자리 {d.remaining.length}건</summary>
          <ul>
            {d.remaining.map((r) => (
              <li key={r.after.selector}>
                {label(r.after)}
                {/* 나아졌지만 기준에는 못 미친 경우 — 외주사가 손댄 흔적이니 구분해 준다 */}
                {r.gained !== null && r.gained > 0 && <em> {r.before.ratio} → {r.after.ratio}</em>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {d.added.length > 0 && (
        <details open>
          <summary>새로 생긴 자리 {d.added.length}건</summary>
          <ul>{d.added.map((f) => <li key={f.selector}>{label(f)}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
