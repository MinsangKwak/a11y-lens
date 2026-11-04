'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Gate — 로그인 화면.
//
// 이 화면은 보안 장치가 아니라 안내다. 검사 엔진은 기기 안에 있어 막을 수 없다.
// 실제 통제는 **이력과 보고서가 계정에 있다**는 사실이다 — 로그인 없이 검사해도
// 1차 · 2차 대조를 못 하니 외주 검수에 쓸 수 없다.
// 그래서 이 화면은 "막는다" 가 아니라 "왜 계정이 필요한지" 를 말한다.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';

export function Gate() {
  const [busy, setBusy] = useState<string | null>(null);

  async function go(provider: 'github' | 'google') {
    setBusy(provider);
    try {
      // 브라우저가 열리고, 끝나면 커스텀 스킴으로 앱에 돌아온다
      await window.auth.signIn(provider);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="gate">
      <h1>a11y-lens</h1>
      <p className="lead">검사 이력을 계정에 모읍니다.</p>
      <p className="why">
        1차 검수와 2차 검수를 대조해 <b>“지적한 12건 중 9건 수정됨”</b>을 자동으로 냅니다.
        그러려면 어느 기기에서 보든 같은 이력이 있어야 합니다.
      </p>
      <div className="providers">
        <button type="button" onClick={() => void go('github')} disabled={!!busy}>
          {busy === 'github' ? '브라우저에서 계속…' : 'GitHub 로 계속'}
        </button>
        <button type="button" onClick={() => void go('google')} disabled={!!busy}>
          {busy === 'google' ? '브라우저에서 계속…' : 'Google 로 계속'}
        </button>
      </div>
      <p className="note">
        로그인 창은 기본 브라우저에서 열립니다. 검사 결과의 수치와 선택자만 저장하며
        <b> 화면 캡처는 올리지 않습니다.</b>
      </p>
    </div>
  );
}
