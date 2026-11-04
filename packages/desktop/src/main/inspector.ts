'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// inspector.ts — 검사 대상 페이지를 띄우고, 그 안에서 엔진을 돌린다.
//
// 대상은 **남의 사이트**다. iframe 으로 띄우면 X-Frame-Options 에 막히므로
// WebContentsView 를 쓴다. 그리고 그 안에서는 어떤 특권도 주지 않는다 —
// nodeIntegration 끄고, preload 도 붙이지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

import { WebContentsView, session } from 'electron';
import { AUDIT, type AuditOptions, type AuditResult } from '@a11y-lens/core';

// 격리 월드 번호. 0 은 페이지의 메인 월드이고 낮은 번호는 Electron · 확장이 쓴다 —
// 충돌하면 주입이 조용히 실패하므로 넉넉히 떨어진 값을 쓴다
const WORLD = 999;

export class Inspector {
  readonly view: WebContentsView;

  constructor() {
    this.view = new WebContentsView({
      webPreferences: {
        // 검사 대상에게 특권을 주지 않는다. 로그인 세션만 유지한다
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        // 관리자 화면 · 결제 완료처럼 세션이 필요한 자리를 검사하려면 로그인이 남아야 한다
        session: session.fromPartition('persist:target'),
      },
    });
  }

  async go(url: string): Promise<void> {
    await this.view.webContents.loadURL(url);
  }

  /** 엔진을 페이지 안에서 돌린다. 페이지 CSP 가 주입을 막아도 격리 월드는 통과한다 */
  async audit(opts: AuditOptions): Promise<AuditResult> {
    // content-visibility:auto 로 그리지 않은 자리도 켜야 잴 수 있다
    await this.view.webContents.insertCSS('* { content-visibility: visible !important; }').catch(() => {});
    // AUDIT 은 바깥 스코프를 쓰지 않으므로 소스만 넘기면 그대로 돈다
    const code = `(${AUDIT.toString()})(${JSON.stringify(opts)})`;
    return (await this.view.webContents.executeJavaScriptInIsolatedWorld(WORLD, [{ code }])) as AuditResult;
  }

  /** 목록에서 고른 자리를 대상 페이지에서 보여 준다 — 윤곽은 측정이 끝난 뒤에만 그린다 */
  async reveal(selector: string): Promise<void> {
    const code = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const box = el.getBoundingClientRect();
        // 대상 DOM 을 건드리지 않으려면 겹쳐 그리고 스스로 지워야 한다
        const mark = document.createElement('div');
        mark.style.cssText = [
          'position:fixed', 'z-index:2147483647', 'pointer-events:none',
          'outline:3px solid #ff2d55', 'outline-offset:2px',
          'left:' + box.x + 'px', 'top:' + box.y + 'px',
          'width:' + box.width + 'px', 'height:' + box.height + 'px',
        ].join(';');
        document.body.appendChild(mark);
        setTimeout(() => mark.remove(), 2000);
        return true;
      })()`;
    await this.view.webContents.executeJavaScriptInIsolatedWorld(WORLD, [{ code }]);
  }

  /** 증거 사진. 수치만 보낸 보고서와 그 자리가 보이는 보고서는 처리 속도가 다르다 */
  async shot(rect: { x: number; y: number; w: number; h: number }): Promise<string> {
    const pad = 8;
    const image = await this.view.webContents.capturePage({
      x: Math.max(0, Math.round(rect.x) - pad),
      y: Math.max(0, Math.round(rect.y) - pad),
      width: Math.round(rect.w) + pad * 2,
      height: Math.round(rect.h) + pad * 2,
    });
    return image.toDataURL();
  }
}
