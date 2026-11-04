'use strict';
// 렌더러에 열어 주는 창구. 노출하는 것만 노출한다 — ipcRenderer 를 통째로 주지 않는다
import { contextBridge, ipcRenderer } from 'electron';

const lens = {
  navigate: (url: string) => ipcRenderer.invoke('target:navigate', url),
  setBounds: (b: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('target:bounds', b),
  run: (opts: unknown) => ipcRenderer.invoke('audit:run', opts),
  reveal: (selector: string) => ipcRenderer.invoke('audit:reveal', selector),
  shot: (rect: { x: number; y: number; w: number; h: number }) => ipcRenderer.invoke('audit:shot', rect),
};

const auth = {
  who: () => ipcRenderer.invoke('auth:who'),
  signIn: (provider: 'github' | 'google') => ipcRenderer.invoke('auth:signIn', provider),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  // 로그인 상태 변화는 메인에서 밀어 준다. 해지 함수를 돌려줘야 렌더러가 새면 정리된다
  onChange: (fire: (w: { email: string | null } | null) => void) => {
    const relay = (_e: unknown, w: { email: string | null } | null) => fire(w);
    ipcRenderer.on('auth:changed', relay);
    return () => ipcRenderer.removeListener('auth:changed', relay);
  },
};

const history = {
  projects: () => ipcRenderer.invoke('history:projects'),
  addProject: (name: string) => ipcRenderer.invoke('history:addProject', name),
  save: (a: unknown) => ipcRenderer.invoke('history:save', a),
  lastTwo: (a: { projectId: string; url: string }) => ipcRenderer.invoke('history:lastTwo', a),
};

contextBridge.exposeInMainWorld('lens', lens);
contextBridge.exposeInMainWorld('auth', auth);
// history 라는 이름은 쓸 수 없다 — 브라우저 내장 window.history 를 가린다.
// 가리면 내장 History API 가 사라지고, d.ts 의 전역 선언도 내장 타입에 밀려 적용되지 않는다
contextBridge.exposeInMainWorld('lensHistory', history);
