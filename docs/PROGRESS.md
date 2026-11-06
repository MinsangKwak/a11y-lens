# 진행 상황과 다음 할 일

마지막 갱신: **2026-11-06**. 저장소 코드·열린 PR·기존 CI 기록을 기준으로 정리했습니다.

[서비스와 설계 배경](../README.md) · [검증 기록](VALIDATION.md) · [작업 지침](../CLAUDE.md) · [Notion](https://app.notion.com/p/40fcbbdd109b8192bf4fcd1b6efac6f8)

## 프로젝트의 역할

외주 산출물의 명암비와 웹 접근성 규칙을 검사하는 Electron·React 도구입니다. 동일한 판정 엔진을 CLI에서도 사용하며, 계정별 명암비 이력을 대조해 수정된 항목과 남은 항목을 구분합니다. 자동 접근성 인증을 대신하지 않습니다.

## 브랜치별 반영 상태

| 위치 | 상태 |
| --- | --- |
| `main` · `8c2daec` | 공통 엔진·CLI·데스크톱·계정·명암비 이력 구조, axe 어댑터. 실질 테스트는 core 22건 |
| `dev` · `0ab0e7e` | 검사 실패 처리, 데스크톱 axe 결과 연결, CI·lockfile·회귀 검사 43건 |
| [PR #6](https://github.com/MinsangKwak/a11y-lens/pull/6) · `d6ca648` | CI 중복 빌드·브라우저 다운로드 개선. 기존 43건 유지. `dev` 대상 초안, 미병합 |
| [PR #7](https://github.com/MinsangKwak/a11y-lens/pull/7) · `69f0cb6` | 첫 화면·압축·배치 갱신 개선. 기존 43건과 추가 8건, 합계 51건. `dev` 대상 초안, 미병합 |

PR #6과 #7은 같은 `dev`에서 나뉜 독립 변경입니다. 각각 통과한 상태이며, 두 변경을 합친 상태의 검증은 병합 후 다시 확인해야 합니다. 별도 자동 배포 워크플로는 없습니다.

## 구현 범위

| 구성 | 완료된 코드 | 남은 확인·구현 |
| --- | --- | --- |
| `packages/core` | 명암비 판정·큰 글씨 기준·판단 불가·예외 처리, axe 규칙 60개 선별·정규화, 명암비 대조 | 지침 원문을 확인한 KWCAG 항목 매핑 |
| `packages/cli` | Playwright URL 검사, JSON 보고서. `dev`에서 오류 단계·종료코드 2 지원 | 사람이 읽는 HTML 보고서 |
| `packages/desktop` | Electron·React, 계정, 위치 표시·캡처·명암비 이력. `dev`에서 두 엔진 결과 연결 | 실제 Electron 창·로그인·검사·캡처·저장·대조 실행 |
| `db/schema.sql` | `projects`·`scans`·`findings`, 계정별 RLS 정책 | 실제 환경 적용 여부·RLS·OAuth·계정 간 격리 확인 |

axe 결과는 CLI 보고서와 `dev`의 데스크톱 화면에 표시합니다. **서버 이력과 지난 검사 대조는 명암비만** 지원합니다.

화면 캡처는 로컬에 저장합니다. 서버 이력에는 URL·검사 옵션·수치·선택자·텍스트 일부·글꼴 정보가 포함됩니다.

## 자동 검증과 실행 명령

검사 건수와 측정 조건·로그는 [검증 기록](VALIDATION.md)에 모았습니다. 이번 문서 수정에서는 실행 코드를 바꾸지 않았으며, 기록된 검증을 새 실행 결과로 표현하지 않습니다.

`main`:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

`dev` · Node 22 · pnpm 12.16.1:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm build
pnpm typecheck
pnpm test
```

`pnpm verify`·`pnpm test:ci`는 PR #6 전용 추가 명령이고, `pnpm --filter @a11y-lens/desktop test:render`는 PR #7에 추가되어 있습니다. 해당 브랜치에서 사용합니다.

## 남은 일

1. PR #6·#7 검토 후 `dev`에서 합친 상태로 빌드·타입·전체 검사 확인
2. 실제 Electron에서 로그인·대상 페이지·두 엔진 결과·위치·캡처·명암비 이력 대조 확인
3. Supabase 스키마·RLS·계정별 격리와 OAuth 복귀 확인
4. axe 결과의 이력 저장·조회·대조 구현
5. HTML 보고서와 검사 근거 연결, KWCAG 매핑
6. 실제 실행을 확인한 스크린샷과 플랫폼별 확인 결과 추가

데스크톱 변경의 `main` 승격·태그는 실제 앱 확인 뒤 진행합니다. 브랜치·PR·릴리스의 상세 운영 규칙은 [개발 브랜치 작업 지침](https://github.com/MinsangKwak/a11y-lens/blob/0ab0e7e4936fc2a7fb2e3ace27a734df87cacbb6/CLAUDE.md#9-브랜치--pr--릴리스)에 있습니다.

## Supabase 연결 메모

아래 값은 기존 문서의 설정 메모입니다. 이번 작업에서는 대시보드·DB를 조회하지 않아 현재 활성 상태나 적용 완료를 단정하지 않습니다.

| 항목 | 기존 기록 |
| --- | --- |
| 프로젝트 | `a11y-lens` |
| 지역 | Sydney · `ap-southeast-2` |
| Project ref | `mhdwrryywwunrppzknxo` |
| GitHub OAuth callback | `https://mhdwrryywwunrppzknxo.supabase.co/auth/v1/callback` |
| Supabase Redirect URL | `a11ylens://auth` |
| 환경 변수 | `.env.example`의 `MAIN_VITE_` 주소·공개 키, DB 작업용 `SUPABASE_DB_URL` |
| Data API·자동 RLS | 기존 기록은 켜짐. 실제 테이블 정책·계정 간 격리 확인 필요 |

새 DB에 스키마를 적용한 뒤에는 세 테이블과 RLS 정책을 조회합니다. 기존 DB에는 적용 상태를 먼저 확인합니다. OAuth callback과 앱 Redirect URL은 서로 다른 설정입니다.

GUI를 사용하지 않는 설치·검증 환경에서는 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`로 Electron 다운로드를 생략할 수 있습니다. 실제 앱 실행 환경에서는 바이너리가 필요합니다.

## 문서 이미지와 저장소 설정

존재하지 않던 `docs/screenshot.png` 참조를 저장소의 [구조 설명도](assets/architecture.png)로 교체했습니다. [검증 요약도](assets/verification.png)는 PR별 실측과 검증 수를 구분합니다. 두 그림 모두 코드·검증 기록을 설명하는 자료이며 실제 앱 스크린샷이 아닙니다.

공개 저장소의 Topics는 설정되어 있어 이전의 미설정 할 일에서 제외했습니다. 브랜치 보호는 아직 미적용이며 [적용안과 확인 조건](BRANCH_PROTECTION.md)을 정리했습니다. 로그인한 관리 화면에서 실제 적용 후 상태를 갱신해야 합니다.
