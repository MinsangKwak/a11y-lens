'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// main — 창 하나, 그 안에 검사 대상 뷰 하나. IPC 는 전부 handle(요청-응답)로 둔다.
//
// 뷰의 자리는 렌더러가 알려 준다. 메인이 레이아웃을 계산하면 React 쪽과 두 벌이 되어
// 창 크기를 바꿀 때마다 어긋난다 — 자리의 원본은 한 곳이어야 한다.
//
// 로그인 게이트는 렌더러에 있다. 그건 **보안 장치가 아니라 안내**다 —
// 데스크톱 앱의 분기는 우회된다. 실제 통제는 이력과 보고서가 계정에 있다는 사실이고,
// 그건 RLS(db/schema.sql)가 서버에서 지킨다.
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { AuditOptions } from '@a11y-lens/core';
import { Inspector } from './inspector.js';
import { finish, onChange, registerScheme, signIn, signOut, who } from './auth.js';
import * as history from './history.js';

const here = dirname(fileURLToPath(import.meta.url));
let inspector: Inspector | null = null;
let win: BrowserWindow | null = null;

// 커스텀 스킴 콜백이 두 번째 실행으로 들어오므로 단일 인스턴스를 잡아야 한다.
// quit 이 아니라 exit 인 이유 — quit 은 즉시 끝나지 않아 아래 코드가 마저 돌고,
// 로그인 콜백으로 뜬 두 번째 실행이 빈 창을 하나 더 띄운다
if (!app.requestSingleInstanceLock()) app.exit(0);

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 940,
    show: false,
    webPreferences: { preload: join(here, '../preload/index.js'), sandbox: false },
  });

  inspector = new Inspector();
  win.contentView.addChildView(inspector.view);
  // 렌더러가 자리를 알려 주기 전에는 보이지 않게 둔다
  inspector.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  win.once('ready-to-show', () => win?.show());

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(here, '../renderer/index.html'));
}

// ── 검사 대상 ────────────────────────────────────────────────────────────────
ipcMain.handle('target:navigate', (_e, url: string) => inspector?.go(url));
ipcMain.handle('target:bounds', (_e, b: { x: number; y: number; width: number; height: number }) => {
  inspector?.view.setBounds({
    x: Math.round(b.x), y: Math.round(b.y),
    width: Math.round(b.width), height: Math.round(b.height),
  });
});
ipcMain.handle('audit:run', (_e, opts: AuditOptions) => inspector?.audit(opts));
ipcMain.handle('audit:reveal', (_e, selector: string) => inspector?.reveal(selector));
ipcMain.handle('audit:shot', (_e, rect: { x: number; y: number; w: number; h: number }) => inspector?.shot(rect));

// ── 계정 ─────────────────────────────────────────────────────────────────────
ipcMain.handle('auth:who', () => who());
ipcMain.handle('auth:signIn', (_e, provider: 'github' | 'google') => signIn(provider));
ipcMain.handle('auth:signOut', () => signOut());

// ── 이력 ─────────────────────────────────────────────────────────────────────
ipcMain.handle('history:projects', () => history.projects());
ipcMain.handle('history:addProject', (_e, name: string) => history.addProject(name));
ipcMain.handle('history:save', (_e, a: { projectId: string; url: string; opts: AuditOptions; result: never }) =>
  history.save(a.projectId, a.url, a.opts, a.result));
ipcMain.handle('history:lastTwo', (_e, a: { projectId: string; url: string }) =>
  history.lastTwo(a.projectId, a.url));

app.whenReady().then(() => {
  registerScheme((url) => void finish(url));
  // 토큰은 보내지 않는다 — 신원만 알린다
  onChange((w) => win?.webContents.send('auth:changed', w));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
