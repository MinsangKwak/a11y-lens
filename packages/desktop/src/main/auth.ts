'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// auth.ts — 계정 로그인. 토큰은 렌더러에 넘기지 않는다.
//
// 두 가지를 틀리기 쉽다.
//   1. OAuth 를 앱 안의 창으로 열면 Google 이 막는다(disallowed_useragent).
//      시스템 브라우저로 넘기고 커스텀 스킴으로 돌려받는다.
//   2. 토큰을 localStorage 에 두면 평문이고 렌더러에서 읽힌다.
//      safeStorage(macOS Keychain · Windows DPAPI)로 봉해 메인만 들고 있는다.
//
// SUPABASE_ANON_KEY 는 공개 브라우저 식별자이고 서버 비밀이 아니다 —
// 격리는 키를 숨겨서가 아니라 RLS(db/schema.sql)로 한다. 둘을 혼동하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

import { app, shell, safeStorage } from 'electron';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type Session } from '@supabase/supabase-js';

const SCHEME = 'a11ylens';
const vaultPath = () => join(app.getPath('userData'), 'session.bin');

/** supabase-js 가 쓰는 저장소를 OS 키체인 위에 올린다 */
const vault = {
  read(): Record<string, string> {
    try {
      if (!existsSync(vaultPath())) return {};
      const raw = readFileSync(vaultPath());
      return JSON.parse(safeStorage.decryptString(raw)) as Record<string, string>;
    } catch {
      // 키체인이 바뀌거나 파일이 깨지면 로그인을 다시 받는다 — 앱이 못 켜지는 쪽이 더 나쁘다
      return {};
    }
  },
  write(all: Record<string, string>): void {
    writeFileSync(vaultPath(), safeStorage.encryptString(JSON.stringify(all)));
  },
  getItem(key: string): string | null {
    return vault.read()[key] ?? null;
  },
  setItem(key: string, value: string): void {
    vault.write({ ...vault.read(), [key]: value });
  },
  removeItem(key: string): void {
    const all = vault.read();
    delete all[key];
    Object.keys(all).length ? vault.write(all) : rmSync(vaultPath(), { force: true });
  },
};

export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: {
    storage: vault,
    persistSession: true,
    autoRefreshToken: true,
    // 리디렉트를 우리가 직접 받아 코드를 교환한다
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/** 로그인 상태가 바뀌면 렌더러에 알린다. 토큰은 보내지 않고 신원만 보낸다 */
export type Who = { email: string | null } | null;
const whoOf = (s: Session | null): Who => (s ? { email: s.user.email ?? null } : null);

export async function who(): Promise<Who> {
  const { data } = await db.auth.getSession();
  return whoOf(data.session);
}

export function onChange(fire: (w: Who) => void): void {
  db.auth.onAuthStateChange((_event, session) => fire(whoOf(session)));
}

export async function signIn(provider: 'github' | 'google'): Promise<void> {
  const { data, error } = await db.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${SCHEME}://auth`, skipBrowserRedirect: true },
  });
  if (error) throw error;
  // 앱 안의 창으로 열면 막힌다 — 사용자의 브라우저로 넘긴다
  await shell.openExternal(data.url);
}

export async function signOut(): Promise<void> {
  await db.auth.signOut();
}

/** 커스텀 스킴으로 돌아온 주소에서 코드를 꺼내 세션으로 바꾼다 */
export async function finish(url: string): Promise<void> {
  const code = new URL(url).searchParams.get('code');
  if (!code) return;
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

/** 운영체제마다 콜백이 들어오는 길이 다르다 */
export function registerScheme(onUrl: (url: string) => void): void {
  app.setAsDefaultProtocolClient(SCHEME);
  // macOS
  app.on('open-url', (event, url) => { event.preventDefault(); onUrl(url); });
  // Windows · Linux 는 두 번째 실행의 argv 로 들어온다
  app.on('second-instance', (_event, argv) => {
    const hit = argv.find((a) => a.startsWith(`${SCHEME}://`));
    if (hit) onUrl(hit);
  });
}
