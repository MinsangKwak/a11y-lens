'use strict';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { build: { rollupOptions: { input: 'src/main/index.ts' } } },
  preload: { build: { rollupOptions: { input: 'src/preload/index.ts' } } },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    // 기본값이 false이므로 배포 파일도 압축하지 않으면 초기 파싱과 전송 비용이 커진다.
    build: { minify: 'esbuild', cssMinify: true },
  },
});
