import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '@a11y-lens/core';

const require = createRequire(import.meta.url);
const src = fileURLToPath(new URL('../src/', import.meta.url));
const options = { minNormal: 4.5, minLarge: 3, allowedColors: [] };

// 실제 IPC와 Inspector 소스를 실행하되 Electron 창과 대상 페이지만 모의 객체로 둔다.
function appHarness({ failAxe = false } = {}) {
  const handlers = new Map();
  const calls = [];
  let preferences;
  class WebContentsView {
    constructor(opts) {
      preferences = opts.webPreferences;
      let evaluation = 0;
      this.webContents = {
        async insertCSS(css) { calls.push({ css }); },
        async executeJavaScriptInIsolatedWorld(world, scripts) {
          calls.push({ world, code: scripts[0].code });
          evaluation += 1;
          if (evaluation === 1) return { scanned: 4, findings: [] };
          if (evaluation === 2) return;
          if (failAxe) throw new Error('접근성 실행 실패');
          return {
            violations: [{
              id: 'image-alt', impact: 'serious', help: '대체 텍스트 필요',
              nodes: [{ target: ['#image'], html: '<img id="image">' }],
            }],
            incomplete: [], passes: [], inapplicable: [],
          };
        },
      };
    }
    setBounds() {}
  }
  class BrowserWindow {
    contentView = { addChildView() {} };
    webContents = { send() {} };
    once() {}
    loadFile() {}
    loadURL() {}
    show() {}
  }
  const electron = {
    WebContentsView, BrowserWindow,
    session: { fromPartition: (name) => name },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    app: {
      requestSingleInstanceLock: () => true,
      whenReady: () => Promise.resolve(),
      on() {},
    },
  };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    // CJS 테스트 로더에서도 원래 소스의 파일 위치를 보존한다.
    const source = readFileSync(path, 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path).href));
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
      fileName: path,
    }).outputText;
    const localRequire = (name) => {
      if (name === 'electron') return electron;
      if (name === '@a11y-lens/core') return core;
      if (name === 'axe-core') return { source: '/* 접근성 라이브러리 */' };
      if (name === './auth.js') return {
        finish() {}, onChange() {}, registerScheme() {}, signIn() {}, signOut() {}, who() {},
      };
      if (name === './history.js') return { projects() {}, addProject() {}, save() {}, lastTwo() {} };
      if (name.startsWith('.')) return load(resolve(dirname(path), name.replace(/\.js$/, '.ts')));
      return require(name);
    };
    vm.runInNewContext(compiled, {
      exports: module.exports, module, require: localRequire,
      process: { env: {}, platform: 'linux' }, console,
    }, { filename: path });
    return module.exports;
  }
  load(resolve(src, 'main/index.ts'));
  return { handlers, calls, preferences: () => preferences };
}

test('일반 검사 IPC가 실제 Inspector의 명암비와 접근성 어댑터를 함께 호출한다', async () => {
  const app = appHarness();
  await Promise.resolve();
  const result = await app.handlers.get('audit:run')(null, options);
  assert.equal(result.scanned, 4);
  assert.equal(result.axe.issues[0].rule, 'image-alt');
  assert.equal(result.axe.issues[0].selector, '#image');
  const runs = app.calls.filter((call) => call.code);
  assert.equal(runs.length, 3, '명암비 실행·axe 주입·규칙 실행이 모두 필요하다');
  assert.ok(runs.every((call) => call.world === 999));
  assert.equal(runs[1].code, '/* 접근성 라이브러리 */');
  assert.equal(app.preferences().nodeIntegration, false);
  assert.equal(app.preferences().contextIsolation, true);
  assert.equal(app.preferences().session, 'persist:target');
});

test('일반 검사 IPC는 접근성 실행 실패를 성공 결과로 바꾸지 않는다', async () => {
  const app = appHarness({ failAxe: true });
  await Promise.resolve();
  await assert.rejects(app.handlers.get('audit:run')(null, options), /접근성 실행 실패/);
});

test('검사 대상이 아직 없으면 일반 검사 IPC는 명시적으로 실패한다', () => {
  const app = appHarness();
  assert.throws(() => app.handlers.get('audit:run')(null, options), /검사 대상이 준비되지/);
});
