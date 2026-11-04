// 이 파일의 이름은 index.d.ts 가 아니어야 한다 —
// 같은 폴더의 index.ts 가 우선 해석되어 아래 전역 선언이 통째로 무시된다
import type { AuditOptions, AuditResult, Finding } from '@a11y-lens/core';

export type Who = { email: string | null } | null;
export type Project = { id: string; name: string };
export type Snapshot = { at: string; findings: Finding[] };

declare global {
  interface Window {
    lens: {
      navigate(url: string): Promise<void>;
      setBounds(b: { x: number; y: number; width: number; height: number }): Promise<void>;
      run(opts: AuditOptions): Promise<AuditResult>;
      reveal(selector: string): Promise<void>;
      shot(rect: { x: number; y: number; w: number; h: number }): Promise<string>;
    };
    auth: {
      who(): Promise<Who>;
      signIn(provider: 'github' | 'google'): Promise<void>;
      signOut(): Promise<void>;
      onChange(fire: (w: Who) => void): () => void;
    };
    lensHistory: {
      projects(): Promise<Project[]>;
      addProject(name: string): Promise<string>;
      save(a: { projectId: string; url: string; opts: AuditOptions; result: AuditResult }): Promise<string>;
      lastTwo(a: { projectId: string; url: string }): Promise<Snapshot[]>;
    };
  }
}
