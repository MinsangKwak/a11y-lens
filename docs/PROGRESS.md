# 진행 상황과 다음 할 일

> 마지막 갱신: 2026-11-05. 저장소 코드와 GitHub Actions 기록을 기준으로 정리했습니다. 외부 서비스 설정과 Electron 화면은 확인한 범위를 별도로 표시합니다.

작업 규칙은 [CLAUDE.md](../CLAUDE.md), 설계 판단은 [README](../README.md), 검증 명령과 시간 비교는 [CI 검증 구조](CI.md)에 있습니다.

## 프로젝트 목적

배포된 웹사이트의 명암비와 웹 접근성 규칙을 검사하는 Electron 도구입니다. 외주 산출물 검수에서 문제 위치와 수치를 확인하고, 두 차례의 검사 결과를 비교하는 용도입니다.

검사 이력과 대조 화면은 현재 명암비 결과만 다룹니다. 접근성 규칙 결과는 CLI 보고서와 데스크톱 화면에 표시하며, 서버 이력 저장까지 구현된 것은 아닙니다.

## 브랜치와 적용 상태

| 위치 | 확인한 상태 |
| --- | --- |
| `main` · `8c2daec` | 명암비 엔진, axe 어댑터, CLI 규칙 검사, 데스크톱 기본 구조와 로그인 콜백 수정 |
| `dev` · `0ab0e7e` | CI·lockfile, CLI 실행 실패 처리, 데스크톱 일반 검사와 접근성 결과 연결, 회귀 검사, 브랜치 운영 지침 |
| `ci/reduce-validation-minutes` | CI 중복 빌드·다운로드 개선과 문서 최신화. [PR #6](https://github.com/MinsangKwak/a11y-lens/pull/6)은 `dev` 대상 초안이며 미병합 |

공개 저장소의 기본 브랜치는 `main`입니다. 자동화는 `.github/workflows/check.yml`의 검사 CI이며, 별도 자동 배포 워크플로는 없습니다. 개선 브랜치에서 통과했다는 기록을 운영 반영 완료로 해석하지 않습니다.

## 구현한 범위

| 구성 | 구현 내용 | 현재 한계 |
| --- | --- | --- |
| `packages/core` | 명암비 판정, 그림·그라데이션의 판단 불가 표시, axe 규칙 60개 선별·정규화, 결과 대조 | 키보드 전체 조작, 대체 텍스트 내용 적절성 등은 수동 확인 |
| `packages/cli` | 여러 URL 검사, 명암비·접근성 결과와 JSON 보고서, 실패 단계와 종료코드 | 사람이 읽는 HTML 보고서는 미구현 |
| `packages/desktop` | Electron·React 화면, 계정, 검사 대상 뷰, 명암비·접근성 결과 표시, 문제 위치·캡처, 명암비 이력 대조 | 실제 창·로그인·격리 월드 동작은 별도 GUI 검증 필요 |
| `db/schema.sql` | `projects`·`scans`·`findings`와 계정별 RLS 정책 | 실서비스 적용 여부와 실제 계정 간 격리는 이번 작업에서 미확인 |

`core`는 외부 라이브러리 의존성 없이 판정과 정규화를 담당합니다. axe-core 소스 주입과 브라우저 실행은 CLI·desktop이 맡습니다. 판정 기준을 두 곳에 나누지 않기 위한 구조입니다.

## 최근 변경

### 검사 실패를 통과와 구분

CLI는 URL 이동·명암비·접근성 실행 실패를 JSON의 `status`와 `errors`에 기록합니다. 접근성만 실패한 경우 명암비 결과는 보존하되 전체 검사를 성공으로 종료하지 않습니다.

| 종료코드 | 의미 |
| --- | --- |
| `0` | 요청한 검사를 완료했고 기준 미달을 찾지 않음. 사람이 볼 항목은 별도 확인 |
| `1` | 검사를 완료했고 기준 미달을 찾음 |
| `2` | 검사 실행 실패 또는 잘못된 사용법 |

데스크톱의 일반 검사도 명암비 다음에 접근성 엔진을 실행합니다. 실패하면 이전 결과를 지우고 오류를 표시하며, 저장 실패와 검사 실패를 구분합니다. 서버에는 기존 명암비 결과만 전달합니다.

### 같은 검사를 더 짧게 실행

- PR과 `dev`·`main` push의 실행 조건, 전체 빌드·타입 검사와 테스트 43건을 유지했습니다.
- CI에서 이미 빌드한 core·CLI를 다시 컴파일하지 않고 같은 산출물로 검사합니다.
- 세 패키지 테스트를 Ubuntu 작업 하나 안에서 병렬 실행합니다. desktop의 테스트 전용 컴파일은 유지합니다.
- 기존 테스트가 실제 사용하는 Chromium headless shell과 시스템 의존성을 준비하고, 사용하지 않는 GUI용 Chromium 다운로드를 제외합니다.

[개선 검증](https://github.com/MinsangKwak/a11y-lens/actions/runs/41981764347)에서 전체 작업은 47초에서 38초로 줄었습니다. 이번 실행 기준 약 19%이며, 반복 실행의 고정 절감률은 아닙니다. 상세 단계와 근거는 [CI 실측 결과](CI.md#실측-결과)에 있습니다.

## 검증 상태

| 항목 | 확인 결과 |
| --- | --- |
| 전체 패키지 빌드 | GitHub CI 통과 |
| 전체 패키지 타입 검사 | GitHub CI 통과 |
| core 테스트 | 22건 통과 |
| CLI 회귀 | 13건 통과 |
| desktop 자동 회귀 | 8건 통과. 창은 모의 객체 사용 |
| 실패·취소·생략 | 각 0건 |
| Electron 실제 화면·로그인 | 이번 작업에서 미검증 |
| Supabase 스키마·OAuth 외부 설정 | 이번 작업에서 미확인 |

검증 근거: [변경 전 CI](https://github.com/MinsangKwak/a11y-lens/actions/runs/41979605154) · [개선 브랜치 CI](https://github.com/MinsangKwak/a11y-lens/actions/runs/41981764347).

## 실행과 설정

Node 22, `package.json`에 고정한 pnpm 12.16.1을 사용합니다.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps --only-shell chromium
pnpm verify
```

`pnpm verify`는 전체 빌드 → 타입 검사 → 테스트 43건을 실행합니다. `pnpm test`는 단독 사용을 위한 자체 빌드 경로도 유지합니다. 이전 산출물에 기대지 않는 검증은 [작업 지침](../CLAUDE.md#6-검증)을 따릅니다.

데스크톱은 `.env.example`을 참고해 `.env`를 작성한 뒤 `pnpm dev`로 실행합니다. Supabase 주소와 공개 키는 `MAIN_VITE_` 접두사를 사용하며, 스크린샷과 인증 토큰을 서버 이력에 넣지 않습니다. CI에서는 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`로 실행하지 않는 Electron 바이너리 다운로드를 제외합니다.

### 외부 서비스 설정 참고

다음 값은 기존 2026-11-04 문서에 기록된 설정입니다. 이번 작업에서 Supabase 대시보드나 DB의 현재 상태를 다시 확인한 것은 아닙니다.

| 항목 | 기록된 값 |
| --- | --- |
| Supabase 프로젝트 | `a11y-lens` · Free |
| 지역 | Sydney · `ap-southeast-2` |
| 프로젝트 ref | `mhdwrryywwunrppzknxo` |
| GitHub OAuth callback | `https://mhdwrryywwunrppzknxo.supabase.co/auth/v1/callback` |
| Supabase Redirect URL | `a11ylens://auth` |
| DB 적용 파일 | `db/schema.sql` |

스키마와 RLS 적용, OAuth 연결과 앱으로 돌아오는 흐름은 실제 환경에서 확인해야 합니다. 데이터 격리를 앱 화면의 로그인 분기로 대신하지 않습니다.

## 남은 일

| 항목 | 다음 확인 또는 구현 |
| --- | --- |
| PR #6 검토 | `dev` 병합 후 합쳐진 상태의 CI 확인. 이번 문서 작업은 병합을 포함하지 않음 |
| 실제 데스크톱 검증 | GitHub·Google 로그인, 검사 대상 표시, 격리 월드 검사, 위치 표시·캡처·이력 저장 확인 |
| Supabase 적용 확인 | 세 표·RLS 정책과 계정별 데이터 격리 확인 |
| 접근성 규칙 이력 | 명암비와 별도로 규칙 결과 저장·조회·대조 범위 설계 |
| 보고서 | JSON을 사람이 읽는 HTML로 출력하고 증거·수치·선택자 연결 |
| KWCAG 매핑 | 지침 원문을 확인한 뒤 axe 규칙과 항목 연결 |
| 화면 자료 | 실제 실행을 확인한 스크린샷 추가 |
| 저장소 정보 | Topics 설정 상태를 별도 확인. 기존 제안은 `accessibility`, `a11y`, `wcag`, `color-contrast`, `electron`, `react`, `typescript`, `playwright` |

자동 검사 통과를 접근성 인증 가능이나 실제 앱 사용 검증 완료로 표현하지 않습니다.
