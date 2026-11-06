import type { AuditOptions, AuditResult, AxeResult } from '@a11y-lens/core';

export type ScanResult = AuditResult & { axe: AxeResult };

export interface ScanEngines {
  audit(opts: AuditOptions): Promise<AuditResult>;
  axe(): Promise<AxeResult>;
}

// 같은 화면을 순서대로 검사한다. 어느 엔진이든 실패하면 완성된 결과로 반환하지 않는다.
export async function runScan(engines: ScanEngines, opts: AuditOptions): Promise<ScanResult> {
  const contrast = await engines.audit(opts);
  const axe = await engines.axe();
  return { ...contrast, axe };
}

// 접근성 HTML과 실패 사유를 기존 명암비 이력으로 보내지 않는다.
export function contrastOnly(result: ScanResult): AuditResult {
  return { findings: result.findings, scanned: result.scanned };
}
