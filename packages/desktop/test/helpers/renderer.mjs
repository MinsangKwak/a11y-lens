import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export async function rendererServer(directory = fileURLToPath(new URL('../../out/renderer/', import.meta.url))) {
  const root = resolve(directory);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + sep)) throw new Error('문서 경로 밖 요청');
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    origin: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise((done) => { server.close(done); server.closeAllConnections(); }),
  };
}

export function rendererBrowser() {
  // CI는 고정 버전의 기본 브라우저를 사용하고 로컬 실행 파일은 환경 변수로만 지정한다.
  return chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
}

export async function rendererBridge(page, { signedIn = false, authDelay = 0, projects = [] } = {}) {
  await page.addInitScript(({ signedIn, authDelay, projects }) => {
    let changed = () => {};
    const state = { bounds: [], navigations: [], signIns: [], scans: 0, fireAuth: (who) => changed(who) };
    window.__rendererTest = state;
    window.auth = {
      who: () => new Promise((done) => setTimeout(() => done(signedIn ? { email: 'tester@example.test' } : null), authDelay)),
      onChange: (fire) => { changed = fire; return () => { changed = () => {}; }; },
      signIn: async (provider) => { state.signIns.push(provider); await new Promise((done) => setTimeout(done, 150)); },
      signOut: async () => changed(null),
    };
    window.lens = {
      setBounds: async (bounds) => { state.bounds.push(bounds); },
      navigate: async (url) => { state.navigations.push(url); },
      run: async () => {
        state.scans += 1;
        return { scanned: 1, findings: [], axe: { issues: [], review: [], rules: { tested: 60, passed: 60, violated: 0 } } };
      },
      reveal: async () => {}, shot: async () => '',
    };
    window.lensHistory = { projects: async () => projects, addProject: async () => '', save: async () => '', lastTwo: async () => [] };
  }, { signedIn, authDelay, projects });
}
