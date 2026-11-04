# 진행 상황과 다음 할 일

> 새 세션이 이 문서부터 읽으면 맥락이 이어집니다. 작업 규칙은 [CLAUDE.md](../CLAUDE.md), 설계 배경은 [README](../README.md)에 있습니다.
>
> 마지막 갱신: 2026-11-04

## 1. 이 프로젝트가 무엇인가

배포된 웹사이트의 **명암비와 웹 접근성을 검사하는 Electron 도구**입니다. 외주 산출물 검수가 쓰임새이고, 구직 포트폴리오를 겸합니다.

차별점은 **이력 대조** 하나입니다. 한 번 재서 목록을 내는 건 흔하지만, 1차·2차 검수를 대조해 "지적한 12건 중 9건 수정됨"을 자동으로 내는 도구는 드뭅니다.

## 2. 왜 이 형태인가

구현에 들어가기 전에 정한 것들입니다. 뒤집으려면 이유부터 확인하세요.

| 선택 | 왜 |
| --- | --- |
| 브라우저 익스텐션 → **데스크톱** | 익스텐션은 URL 목록 배치 실행과 이력 비교가 안 된다. 외주 검수의 본질이 그 둘이다 |
| 웹 서비스 → **데스크톱** | 서버가 남의 사이트를 긁으면 부하·차단·책임이 운영자에게 온다. 로그인 상태 화면도 서버 크롤러는 못 간다 |
| **Supabase** | 서버 운영이 없고 RLS 로 격리를 선언할 수 있다. 프론트엔드 직무를 지향해 백엔드 운영 부담을 줄였다 |
| 로그인 게이트를 `if` 로 풀지 않음 | 데스크톱 분기는 우회된다. 이력과 보고서를 계정에 두어 로그인 없이는 쓸 이유가 없게 만들었다 |

## 3. 지금까지 된 것

### 저장소

`MinsangKwak/a11y-lens` · 공개 · 기본 브랜치 `main` · 워크플로 없음

```
packages/core/      판정 엔진 + 이력 대조 · 의존성 0 · 테스트 13건
packages/cli/       Playwright 배치 실행 · CI 종료코드
packages/desktop/   Electron 셸 + React 렌더러 + 계정
db/schema.sql       계정별 이력 3개 표 + RLS
```

커밋 8개가 폴더 역할별로 나뉘어 있고, 본문에 판단 근거가 들어 있습니다. `git log -- packages/core` 로 그 영역의 판단만 읽을 수 있습니다.

### 검증 상태

| 항목 | 상태 |
| --- | --- |
| `core` 타입 검사 · 테스트 13건 | **통과** |
| `cli` 타입 검사 · 실제 실행 | **통과** (고정 사례에서 실측 수치 출력) |
| `desktop` | **미검증** — 클라우드에 GUI 가 없어 한 번도 실행된 적 없음 |
| Supabase 스키마 | **미적용** — SQL 을 아직 올리지 않음 |

`desktop` 은 코드만 있는 상태입니다. 처음 실행할 때 오류가 나는 것이 정상이라고 보고 접근하세요.

### Supabase

| 항목 | 값 |
| --- | --- |
| 프로젝트 | `a11y-lens` · Free |
| 지역 | Oceania (Sydney) `ap-southeast-2` — 변경 불가, 그대로 가기로 결정 |
| Project ref | `mhdwrryywwunrppzknxo` |
| Data API | 켜짐 |
| 자동 RLS | 켜짐 |

## 4. 남은 일 — 순서대로

### 4-1. 스키마 올리기 ← 지금 여기

`db/schema.sql` 을 Supabase 에 적용합니다. 두 길 중 하나입니다.

- **SQL Editor** 에 붙여넣고 실행 (브라우저)
- 환경 변수 `SUPABASE_DB_URL` 을 두고 세션에서 `psql` 로 실행 (클라우드)

끝나면 표 세 개(`projects` · `scans` · `findings`)와 **RLS 가 실제로 걸렸는지** 조회로 확인합니다. RLS 가 없으면 공개 키만으로 누구나 전부 읽습니다.

### 4-2. GitHub 로그인 연결

주소가 두 개이고 서로 다릅니다. 여기서 가장 많이 막힙니다.

| 어디 | 넣을 값 |
| --- | --- |
| GitHub OAuth App 의 callback URL | `https://mhdwrryywwunrppzknxo.supabase.co/auth/v1/callback` |
| Supabase → Authentication → Redirect URLs | `a11ylens://auth` |

두 번째를 빠뜨리면 브라우저 로그인은 성공하는데 앱으로 돌아오지 않습니다.

### 4-3. 데스크톱 첫 실행 (로컬 필요)

```bash
cp .env.example .env     # MAIN_VITE_ 접두사 주의
pnpm install
pnpm dev
```

### 4-4. axe-core 어댑터

지금 이 도구는 **명암비만** 봅니다. 이름이 `a11y-lens` 인데 접근성 규칙이 없는 상태라 이게 가장 큰 구멍입니다.

접근성 규칙은 자작하지 않고 axe-core 를 번들해 `core` 에 어댑터로 붙입니다. 규칙은 골라서 켭니다 — 전체를 돌리면 "이론상 위반"이 수십 개 나와 아무도 안 봅니다.

`color-contrast` 규칙은 **끕니다.** 자작 엔진과 기준이 달라(4.5 대 설정값) 결과가 충돌합니다.

### 4-5. 보고서 출력

JSON → 사람이 읽는 HTML. 외주사에 보내는 결과물이 이것이라 실질 가치가 큽니다. 항목마다 선택자 · 실측값 · 기준값 · 색 · 스크린샷이 함께 가야 합니다.

### 4-6. KWCAG 항목 매핑

계약서가 가리키는 지침이 보통 KWCAG 2.2 입니다. axe 규칙 ID → 항목 번호 표를 만듭니다. **지침 원문을 확인하고 적습니다.**

## 5. 클라우드 세션에서 할 수 있는 일 / 없는 일

| 할 수 있다 | 할 수 없다 |
| --- | --- |
| `core` · `cli` 개발과 테스트 | Electron 실행 (GUI 없음) |
| Playwright 로 실제 페이지 검사 | |
| `psql` 로 Supabase 조작 (환경 변수 필요) | 브라우저 대시보드 클릭 작업 |

**미검증을 검증된 것처럼 보고하지 않습니다.** 돌려본 척한 보고가 가장 비쌉니다.

## 6. 환경 설정

a11y-lens 전용 환경을 따로 두는 것을 권합니다. 다른 프로젝트의 토큰과 섞이지 않습니다.

| 항목 | 값 |
| --- | --- |
| 저장소 | `MinsangKwak/a11y-lens` |
| 브랜치 | `main` |
| 환경 변수 | `SUPABASE_DB_URL` — Supabase 의 **Session pooler** 문자열 (Direct 는 IPv6 전용이라 못 붙음) |
| 설정 스크립트 | `corepack enable` 다음 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install` |

Electron 바이너리는 150MB 가 넘는데 클라우드에서는 절대 실행되지 않습니다. 받지 않게 막습니다.

## 7. 알려진 할 일

- 저장소 **Topics 미설정** — 세션 프록시가 쓰기를 막아 직접 넣어야 합니다
  `gh repo edit MinsangKwak/a11y-lens --add-topic accessibility,a11y,wcag,color-contrast,electron,react,typescript,playwright`
- 무료 플랜은 **1주일 미사용 시 프로젝트가 멈춥니다.** 포트폴리오로 보여 줄 시기에는 가끔 깨워 두세요
