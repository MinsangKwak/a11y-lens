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
    history: {
      projects(): Promise<Project[]>;
      addProject(name: string): Promise<string>;
      save(a: { projectId: string; url: string; opts: AuditOptions; result: AuditResult }): Promise<string>;
      lastTwo(a: { projectId: string; url: string }): Promise<Snapshot[]>;
    };
  }
}
