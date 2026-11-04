'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// audit.ts — **안 보이는 글자를 재는 자.** 브라우저 안에서 도는 자족적 함수 한 개.
//
// 왜 함수 하나로 묶여 있나 — 이 함수는 소스로 직렬화되어 남의 페이지 안에서 돈다.
// Playwright 는 page.evaluate(AUDIT, opts), Electron 은
// executeJavaScriptInIsolatedWorld(`(${AUDIT})(...)`) 로 같은 몸을 넘긴다.
// 그래서 **바깥 스코프의 값을 참조할 수 없다** — import 한 상수도, 모듈 안의 헬퍼도 못 쓴다.
// 타입은 빌드에서 사라지므로 마음껏 쓴다. 값만 안 된다.
//
// 기준은 호출하는 쪽이 넣는다. 자체 회귀 검사(3.0, "아예 안 보임")와
// 외주 검수(4.5, WCAG AA)가 같은 엔진을 쓰면서 잣대만 다를 수 있어야 한다.
// ─────────────────────────────────────────────────────────────────────────────

import type { AuditOptions, AuditResult, Finding, Verdict } from './types.js';

type Color = { rgb: number[]; a: number };

/** 페이지 안에서 돌 함수. 바깥 스코프의 값을 쓰지 않는다 */
export const AUDIT = (o: AuditOptions): AuditResult => {
  // 상대 휘도 — WCAG 2.1 정의 그대로
  const lum = (rgb: number[]): number => {
    const c = rgb.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };

  // 브라우저는 color-mix() 를 `color(srgb .94 .86 .83)` 로 돌려준다 — 0~1 이라 255 로 펴야 한다.
  // rgb() 처럼 읽으면 어떤 색이든 거의 검정이 되어 멀쩡한 글자가 전부 걸린다
  const parse = (value: string | null): Color | null => {
    if (!value || value === 'transparent' || value === 'none') return null;
    const m = value.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    const unit = value.startsWith('color(') ? 255 : 1;
    return { rgb: [+m[0] * unit, +m[1] * unit, +m[2] * unit], a: m[3] === undefined ? 1 : +m[3] };
  };

  // 반투명 색을 아래 색 위에 올린다
  const over = (top: Color, base: number[]): number[] => top.rgb.map((x, i) => x * top.a + base[i] * (1 - top.a));

  // 다시 찾을 수 있는 경로를 만든다. 클래스 나열만으론 그 요소를 특정할 수 없어
  // 외주사에 "어디요?" 를 되묻게 된다 — nth-of-type 으로 유일성을 준다
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    let rooted = false;
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); rooted = true; break; }
      const tag = n.tagName.toLowerCase();
      const kin = n.parentElement ? [...n.parentElement.children].filter((s) => s.tagName === n.tagName) : [n];
      parts.unshift(kin.length > 1 ? tag + ':nth-of-type(' + (kin.indexOf(n) + 1) + ')' : tag);
    }
    if (!rooted) parts.unshift('body');
    return parts.join(' > ');
  };

  // 뒤에 깔린 바탕을 조상까지 거슬러 합성한다.
  // 함께 돌려주는 fade 는 **글자에만** 걸릴 누적 투명도다 — 바탕을 준 조상의 opacity 는
  // 글자와 바탕을 함께 흐리므로 명암비를 바꾸지 않아 제외한다
  const backdrop = (el: Element): { rgb: number[] | null; fade: number } => {
    const layers: Color[] = [];
    const flatten = () => layers.reduceRight<number[]>((base, l) => over(l, base), [255, 255, 255]);
    let fade = 1;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      // 그림 · 그라데이션이 깔리면 단일 색으로 환산할 수 없다 — 추측하지 않고 사람에게 넘긴다
      if (cs.backgroundImage !== 'none') return { rgb: null, fade };
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 0.999) return { rgb: flatten(), fade };
      fade *= Number(cs.opacity) || 0;
    }
    // 끝까지 불투명한 바탕이 없으면 캔버스(흰색) 위에 올린다
    return { rgb: flatten(), fade };
  };

  // WCAG 의 큰 글씨 — 18pt(24px), 굵으면 14pt(18.66px).
  // 이 분기가 없으면 정당하게 통과한 제목을 전부 위반으로 잡아 보고서 신뢰를 잃는다
  const isLarge = (px: number, weight: number): boolean => px >= 24 || (weight >= 700 && px >= 18.66);

  const show = (c: number[]): string => 'rgb(' + c.map((x) => Math.round(x)).join(', ') + ')';

  // 합의된 예외 색을 화면에 그려진 표기로 바꿔 둔다 — 브라우저에게 변환을 시킨다
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const allowed = new Set<string>();
  for (const raw of o.allowedColors || []) {
    probe.style.color = '';
    probe.style.color = raw;
    const got = getComputedStyle(probe).color;
    if (got) allowed.add(got);
  }
  probe.remove();

  const findings: Finding[] = [];
  let scanned = 0;

  for (const el of document.querySelectorAll('body *')) {
    // 자기 자식 텍스트만 본다 — 조상까지 세면 같은 글귀를 깊이만큼 되짚는다
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent ?? '').trim())
      .join(' ')
      .trim();
    if (!text) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;

    const fg = parse(cs.color);
    if (!fg) continue;
    scanned += 1;

    const px = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = isLarge(px, weight);
    const required = large ? o.minLarge : o.minNormal;
    const rect = { x: box.x, y: box.y, w: box.width, h: box.height };
    const font = { px, weight };
    const base = { required, large, selector: pathOf(el), text: text.slice(0, 60), rect, font };

    const back = backdrop(el);
    if (!back.rgb) {
      // 잴 수 없다. 버리지 않고 "사람이 볼 자리" 로 넘긴다 — 히어로 · 배너가 여기 걸린다
      findings.push({ ...base, verdict: 'undeterminable', ratio: null, fg: show(fg.rgb), bg: null });
      continue;
    }

    // 글자의 알파와 누적 투명도를 바탕 위에 합성해야 실제로 보이는 색이 나온다
    const alpha = fg.a * back.fade;
    if (alpha <= 0.02) continue;
    const seen = over({ rgb: fg.rgb, a: alpha }, back.rgb);

    const [a, b] = [lum(seen), lum(back.rgb)];
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio >= required) continue;

    const verdict: Verdict = allowed.has(show(seen)) || allowed.has(show(back.rgb)) ? 'allowed' : 'fail';
    findings.push({ ...base, verdict, ratio: +ratio.toFixed(2), fg: show(seen), bg: show(back.rgb) });
  }

  return { findings, scanned };
};
