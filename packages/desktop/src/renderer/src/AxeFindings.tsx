import type { AxeResult, Impact, Issue } from '@a11y-lens/core';
import { LABEL } from './Findings.js';

const IMPACT: Record<Impact, string> = {
  minor: '낮음',
  moderate: '보통',
  serious: '높음',
  critical: '매우 높음',
};

function IssueList({ items }: { items: Issue[] }) {
  if (!items.length) return <p className="empty">이 자동 검사에서 감지된 항목이 없습니다.</p>;

  return (
    <ul className="findings">
      {items.map((issue, index) => (
        <li className={`finding axe-finding ${issue.verdict}`} key={`${issue.rule}:${issue.selector}:${index}`}>
          <p><b>{issue.what}</b></p>
          <p>{LABEL[issue.verdict]} · 심각도 {IMPACT[issue.impact]}</p>
          <p className="meta">{issue.rule} · {issue.selector}</p>
          {issue.reason && <p>{issue.reason}</p>}
          {issue.html && <pre>{issue.html}</pre>}
        </li>
      ))}
    </ul>
  );
}

export function AxeFindings({ result }: { result: AxeResult }) {
  const failed = result.issues.filter((issue) => issue.verdict === 'fail');
  const review = result.review.filter((issue) => issue.verdict === 'undeterminable');
  const allowed = [...result.issues, ...result.review].filter((issue) => issue.verdict === 'allowed');

  return (
    <section aria-label="접근성 규칙 검사 결과">
      <h2>접근성 규칙</h2>
      <p className="scanned">
        검사한 규칙 {result.rules.tested}개 · 통과한 규칙 {result.rules.passed}개
      </p>
      <h3>기준 미달 {failed.length}건</h3>
      <IssueList items={failed} />
      <h3>사람이 볼 자리 {review.length}건</h3>
      <IssueList items={review} />
      {allowed.length > 0 && (
        <>
          <h3>합의된 예외 {allowed.length}건</h3>
          <IssueList items={allowed} />
        </>
      )}
      <p className="scanned">자동 검사는 접근성 문제의 일부만 찾습니다. 감지된 항목이 없어도 접근성 준수를 뜻하지 않습니다.</p>
    </section>
  );
}
