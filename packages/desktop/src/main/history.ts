'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// history.ts — 검사 이력을 계정에 모은다.
//
// **스크린샷은 올리지 않는다.** 증거 사진은 고객사 화면이고, 보고서를 만들 때
// 로컬에서 그 자리에 다시 떠서 붙인다. 서버에 남기는 것은 수치 · 선택자뿐이다.
//
// 이력을 원격에만 두는 이유 — 로컬 사본을 함께 두면 동기화 충돌이 생기고,
// 이력 비교의 요점은 "어느 기기에서 봐도 같은 이력" 이다. 오프라인 검사는 뒤에 붙일 일이다.
// ─────────────────────────────────────────────────────────────────────────────

import type { AuditOptions, AuditResult, Finding } from '@a11y-lens/core';
import { db } from './auth.js';

/** 저장된 줄을 core 가 아는 모양으로 되돌린다 */
type Row = {
  verdict: Finding['verdict']; ratio: number | null; required: number; large: boolean;
  selector: string; fg: string; bg: string | null; snippet: string; font: Finding['font'];
};

const toFinding = (r: Row): Finding => ({
  verdict: r.verdict, ratio: r.ratio === null ? null : Number(r.ratio), required: Number(r.required),
  large: r.large, selector: r.selector, fg: r.fg, bg: r.bg, text: r.snippet,
  // 좌표는 저장하지 않는다 — 화면이 바뀌면 틀린 값이 된다. 보고서는 그 자리에 다시 떠서 잡는다
  rect: { x: 0, y: 0, w: 0, h: 0 }, font: r.font,
});

async function ownerId(): Promise<string> {
  const { data } = await db.auth.getUser();
  if (!data.user) throw new Error('로그인이 필요합니다');
  return data.user.id;
}

export async function projects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.from('projects').select('id, name').order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function addProject(name: string): Promise<string> {
  const owner = await ownerId();
  const { data, error } = await db.from('projects').insert({ owner, name }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function save(projectId: string, url: string, opts: AuditOptions, result: AuditResult): Promise<string> {
  const owner = await ownerId();
  const { data, error } = await db
    .from('scans')
    // 어떤 기준으로 쟀는지 함께 남긴다 — 기준이 바뀐 뒤의 대조는 대조가 아니다
    .insert({ owner, project_id: projectId, url, options: opts, scanned: result.scanned })
    .select('id')
    .single();
  if (error) throw error;

  const scanId = data.id as string;
  if (result.findings.length) {
    const rows = result.findings.map((f) => ({
      owner, scan_id: scanId,
      verdict: f.verdict, ratio: f.ratio, required: f.required, large: f.large,
      selector: f.selector, fg: f.fg, bg: f.bg, snippet: f.text, font: f.font,
    }));
    const { error: bad } = await db.from('findings').insert(rows);
    if (bad) throw bad;
  }
  return scanId;
}

/** 같은 프로젝트 · 같은 URL 의 최근 두 차례. 대조의 재료다 */
export async function lastTwo(projectId: string, url: string): Promise<{ at: string; findings: Finding[] }[]> {
  const { data, error } = await db
    .from('scans')
    .select('id, at')
    .eq('project_id', projectId)
    .eq('url', url)
    .order('at', { ascending: false })
    .limit(2);
  if (error) throw error;

  const out: { at: string; findings: Finding[] }[] = [];
  for (const scan of data ?? []) {
    const { data: rows, error: bad } = await db
      .from('findings')
      .select('verdict, ratio, required, large, selector, fg, bg, snippet, font')
      .eq('scan_id', scan.id);
    if (bad) throw bad;
    out.push({ at: scan.at as string, findings: (rows ?? []).map((r) => toFinding(r as Row)) });
  }
  // 오래된 것이 앞 — diff(before, after) 의 순서에 맞춘다
  return out.reverse();
}
