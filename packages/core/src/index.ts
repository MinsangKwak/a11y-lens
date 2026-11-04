'use strict';
export { AUDIT } from './audit.js';
export { diff } from './diff.js';
export type { AuditOptions, AuditResult, Finding, Verdict } from './types.js';
export type { Diff, Remaining } from './diff.js';

/** WCAG 2.1 AA — 외주 검수의 기본값 */
export const AA = { minNormal: 4.5, minLarge: 3.0, allowedColors: [] };
/** "아예 안 보임" 만 건지는 자체 회귀 검사용 */
export const VISIBLE_ONLY = { minNormal: 3.0, minLarge: 3.0, allowedColors: [] };
