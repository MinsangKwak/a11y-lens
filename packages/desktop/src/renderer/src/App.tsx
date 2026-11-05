'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// App — 왼쪽은 조작과 결과, 오른쪽은 검사 대상이 서는 자리.
//
// 대상 뷰(WebContentsView)는 React 트리 밖에 있다. 그래서 자리를 React 가 재서
// 메인에게 알려 준다 — 메인이 따로 계산하면 레이아웃이 두 벌이 되어 어긋난다.
//
// 로그인 전에는 Gate 만 보인다. 대상 뷰의 자리를 0 으로 두어 게이트 위에 겹치지 않게 한다.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { Finding, Verdict } from '@a11y-lens/core';
import { contrastOnly, type ScanResult } from '../../shared/scan.js';
import { AxeFindings } from './AxeFindings.js';
import type { Project, Snapshot, Who } from '../../preload/api.js';
import { Findings, LABEL } from './Findings.js';
import { Compare } from './Compare.js';
import { Gate } from './Gate.js';

const AA = { minNormal: 4.5, minLarge: 3.0, allowedColors: [] as string[] };
const TABS: Verdict[] = ['fail', 'undeterminable', 'allowed'];

export function App() {
  // undefined = 확인 중. null = 로그아웃 상태. 셋을 구분해야 로그인 화면이 깜빡이지 않는다
  const [me, setMe] = useState<Who | undefined>(undefined);
  const stage = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('https://');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Verdict>('fail');
  const [shot, setShot] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [pair, setPair] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    void window.auth.who().then(setMe);
    return window.auth.onChange(setMe);
  }, []);

  // 로그인한 뒤에 프로젝트를 읽는다 — RLS 가 막으므로 미리 불러도 빈 배열이다
  useEffect(() => {
    if (!me) { setProjects([]); setProjectId(''); return; }
    void window.lensHistory.projects().then((list) => {
      setProjects(list);
      setProjectId((cur) => cur || list[0]?.id || '');
    });
  }, [me]);

  // 대상 뷰의 자리를 알려 준다. 로그인 전에는 0 으로 접어 게이트를 덮지 않게 한다
  useEffect(() => {
    const el = stage.current;
    const tell = () => {
      if (!el || !me) { void window.lens.setBounds({ x: 0, y: 0, width: 0, height: 0 }); return; }
      const r = el.getBoundingClientRect();
      void window.lens.setBounds({ x: r.x, y: r.y, width: r.width, height: r.height });
    };
    tell();
    if (!el) return;
    const ro = new ResizeObserver(tell);
    ro.observe(el);
    window.addEventListener('resize', tell);
    return () => { ro.disconnect(); window.removeEventListener('resize', tell); };
  }, [me]);

  if (me === undefined) return <div className="gate"><p className="lead">확인 중…</p></div>;
  if (me === null) return <Gate />;

  async function open() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setShot(null);
    setPair(null);
    setError('');
    try {
      await window.lens.navigate(url);
    } catch (cause) {
      setError(`페이지를 열지 못했습니다: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setShot(null);
    setPair(null);
    setError('');
    try {
      const got = await window.lens.run(AA);
      setResult(got);
      // 접근성 결과는 화면에만 표시한다. 이력은 기존 명암비 검사 범위로 유지한다.
      if (projectId) {
        try {
          await window.lensHistory.save({ projectId, url, opts: AA, result: contrastOnly(got) });
        } catch (cause) {
          setError(`검사는 완료했지만 명암비 이력을 저장하지 못했습니다: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
      }
    } catch (cause) {
      setError(`검사를 완료하지 못했습니다: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function compare() {
    if (!projectId) return;
    setPair(await window.lensHistory.lastTwo({ projectId, url }));
  }

  async function newProject() {
    const name = window.prompt('프로젝트 이름 (외주사 · 사이트 단위)');
    if (!name) return;
    const id = await window.lensHistory.addProject(name);
    setProjects(await window.lensHistory.projects());
    setProjectId(id);
  }

  // 목록에서 고르면 대상 페이지에서 그 자리를 보여 주고, 증거 사진을 뜬다
  async function pick(f: Finding) {
    await window.lens.reveal(f.selector);
    setShot(await window.lens.shot(f.rect));
  }

  const items = result?.findings.filter((f) => f.verdict === tab) ?? [];
  const countOf = (v: Verdict) => result?.findings.filter((f) => f.verdict === v).length ?? 0;

  return (
    <div className="app">
      <aside className="panel">
        <header className="me">
          <span>{me.email ?? '로그인됨'}</span>
          <button type="button" onClick={() => void window.auth.signOut()}>로그아웃</button>
        </header>

        <div className="bar">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {!projects.length && <option value="">프로젝트 없음</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" onClick={() => void newProject()}>＋</button>
        </div>

        <form className="bar" onSubmit={(e) => { e.preventDefault(); void open(); }}>
          <input disabled={busy} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          <button type="submit" disabled={busy}>열기</button>
        </form>

        <div className="bar">
          <button type="button" className="run" onClick={() => void run()} disabled={busy}>
            {busy ? '검사 중…' : '이 화면 검사'}
          </button>
          <button type="button" onClick={() => void compare()} disabled={!projectId || busy}>지난 명암비와 대조</button>
        </div>

        {error && <p role="alert">{error}</p>}
        {pair && <Compare pair={pair} />}

        {result && (
          <>
            <h2>명암비</h2>
            <p className="scanned">훑은 글자 {result.scanned}개 · 기준 {AA.minNormal} / {AA.minLarge}</p>
            <nav className="tabs">
              {TABS.map((v) => (
                <button key={v} type="button" className={v === tab ? 'on' : ''} onClick={() => setTab(v)}>
                  {LABEL[v]} {countOf(v)}
                </button>
              ))}
            </nav>
            <Findings items={items} onPick={(f) => void pick(f)} />
            <AxeFindings result={result.axe} />
            <p className="scanned">이력 저장과 지난 검사 대조에는 명암비 결과만 포함됩니다.</p>
          </>
        )}

        {shot && (
          <figure className="shot">
            <img src={shot} alt="걸린 자리" />
            <figcaption>보고서에 붙일 증거 · 서버에 올리지 않습니다</figcaption>
          </figure>
        )}
      </aside>

      {/* 검사 대상이 서는 자리. 비어 있는 게 맞다 — 실제 화면은 이 위에 겹친다 */}
      <div className="stage" ref={stage} />
    </div>
  );
}
