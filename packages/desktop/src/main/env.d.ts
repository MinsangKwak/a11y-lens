/// <reference types="vite/client" />

// electron-vite 가 메인 프로세스에 넘기는 값. 접두사가 곧 전달 범위다
interface ImportMetaEnv {
  readonly MAIN_VITE_SUPABASE_URL: string;
  readonly MAIN_VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
