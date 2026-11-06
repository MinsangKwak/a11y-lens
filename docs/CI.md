# CI 검증 구조

PR과 `dev`·`main` push마다 전체 빌드, 타입 검사, 테스트 43건을 실행합니다. 실행 횟수와 검사 대상은 유지하고 같은 실행 안의 중복 빌드와 사용하지 않는 브라우저 다운로드를 줄입니다.

현재 저장소에는 자동 배포 워크플로가 없고 `.github/workflows/check.yml`이 검증을 담당합니다. 이 변경은 릴리스 횟수나 태그 조건을 바꾸지 않습니다.

2026-11-05 확인 기준, 이 개선은 `ci/reduce-validation-minutes` 브랜치의 [PR #6](https://github.com/MinsangKwak/a11y-lens/pull/6)에 있습니다. `dev` 대상 초안 PR이며 아직 `dev`·`main`에 병합되지 않았습니다.

## 한 번 빌드한 결과를 전부 검사한다

| 단계 | 명령 | 확인하는 것 |
| --- | --- | --- |
| 설치 | `pnpm install --frozen-lockfile` | 저장된 의존성과 설치 스크립트 |
| 빌드 | `pnpm -r build` | core·CLI 컴파일, Electron 메인·preload·React 번들 |
| 타입 검사 | `pnpm typecheck` | 기존 패키지별 TypeScript 설정 전체 |
| 브라우저 준비 | `pnpm exec playwright install --with-deps --only-shell chromium` | 기존 테스트가 사용하는 Chromium headless shell과 시스템 의존성 |
| 테스트 | `pnpm test:ci` | core 22건, CLI 13건, desktop 8건 |

`core`와 `cli`의 `test`는 단독 사용을 위해 먼저 빌드합니다. CI에서는 바로 앞 단계에서 빌드했으므로 `test:ci`로 같은 테스트 파일을 실행합니다. `desktop`의 테스트 전용 TypeScript 컴파일은 제품 빌드와 목적이 달라 그대로 실행합니다.

세 패키지의 테스트는 같은 작업 안에서 동시에 실행합니다. 테스트는 다른 패키지의 산출물을 수정하지 않으며, 필요한 `core/dist`는 테스트가 시작되기 전에 완성되어 있습니다. 작업을 여러 개로 나눠 설치와 준비를 반복하지 않습니다.

## 브라우저 실행은 그대로 유지한다

기존 `chromium.launch()`는 `channel`과 `headless: false`를 지정하지 않아 headless shell을 실행합니다. `--only-shell`은 같은 headless shell을 준비하면서 사용하지 않는 GUI용 Chromium의 다운로드만 제외합니다. 테스트의 브라우저 버전, 실행 옵션, 화면 크기와 판정 기준은 바꾸지 않습니다.

향후 GUI용 Chromium이나 별도 브라우저 채널을 사용하는 테스트를 추가하면 설치 명령도 함께 확장해야 합니다. 근거: [Playwright의 Chromium headless shell 안내](https://playwright.dev/docs/browsers#chromium-headless-shell).

## 검사 결과를 재사용하지 않는다

| 항목 | 유지하는 조건 |
| --- | --- |
| 실행 시점 | `dev`·`main` 대상 PR과 두 브랜치의 push |
| 작업 수 | Ubuntu 작업 1개 |
| 검사 범위 | 모든 패키지 빌드·타입 검사와 기존 테스트 43건 |
| 새 실행 | 새 checkout에서 설치·빌드·검사를 모두 실행 |
| 실패 | 기존과 같이 작업을 실패 처리 |

이전 실행의 `dist`·`out`이나 통과 결과를 가져오지 않습니다. 경로 필터, 테스트 생략, 실행 취소와 캐시 적중 여부로 검사를 건너뛰는 조건도 추가하지 않습니다.

의존성 설치는 기준 실행에서 3초였습니다. 캐시 복원·저장 시간을 더하기 전에 먼저 중복 빌드와 브라우저 다운로드를 줄입니다. 브라우저 바이너리 캐시는 복원 비용이 다운로드와 비슷하고 Linux 시스템 의존성을 대체하지 못한다는 [Playwright 안내](https://playwright.dev/docs/ci#caching-browsers)도 고려했습니다.

## 실측 결과

2026-11-05의 `dev` 커밋 `0ab0e7e`에서 실행한 [기준 CI](https://github.com/MinsangKwak/a11y-lens/actions/runs/41979605154)와 개선 브랜치 커밋 `079b485`의 [검증 CI](https://github.com/MinsangKwak/a11y-lens/actions/runs/41981764347)를 비교했습니다. 두 실행 모두 Node 22와 같은 의존성 버전·검사 파일을 사용했습니다. 단계별 초 단위 표시는 GitHub의 타임스탬프를 기준으로 하므로 합계와 조금 다를 수 있습니다.

| 단계 | 변경 전 | 변경 후 |
| --- | ---: | ---: |
| 의존성 설치 | 3초 | 2초 |
| 전체 빌드 | 8초 | 9초 |
| 타입 검사 | 6초 | 6초 |
| 브라우저 설치 | 17초 | 12초 |
| 테스트 | 8초 | 3초 |
| 전체 작업 | 47초 | 38초 |

전체 작업은 이번 실행에서 9초, 약 19% 짧아졌습니다. 브라우저 준비와 테스트에서 각각 5초를 줄였으며, 전체 빌드 시간은 1초 늘었습니다. 한 번의 실행 비교이고 러너와 다운로드 상태에 따라 달라지므로 항상 같은 비율로 줄어든다고 보장하지 않습니다.

| 검증 대상 | 통과 | 실패 | 취소 | 생략 |
| --- | ---: | ---: | ---: | ---: |
| core | 22 | 0 | 0 | 0 |
| CLI | 13 | 0 | 0 | 0 |
| desktop | 8 | 0 | 0 | 0 |
| 합계 | 43 | 0 | 0 | 0 |

전체 빌드와 타입 검사도 통과했습니다. 로컬에서는 브라우저 다운로드가 빈 파일로 응답해 전체 실행을 완료하지 못했으며, 로컬 빌드·타입 검사와 브라우저를 쓰지 않는 35건을 확인했습니다. 브라우저 8건까지 포함한 위 43건의 통과 근거는 GitHub 러너의 검증 로그입니다.

현재 공개 저장소의 표준 GitHub 호스팅 러너 실행은 무료입니다. 비공개 저장소에서는 작업별 사용 시간이 분 단위로 올림되므로 47초를 더 줄이더라도 곧바로 청구 1분이 줄어드는 것은 아닙니다. 근거: [GitHub Actions 실행 시간](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time).

## 로컬 검증

```bash
pnpm exec playwright install --with-deps --only-shell chromium
rm -rf packages/*/dist packages/desktop/out
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify`는 전체 빌드, 타입 검사, `pnpm test:ci`를 순서대로 실행합니다. `pnpm test`도 기존처럼 실행할 수 있으며 자체 빌드가 필요한 경우에 사용합니다. Electron 창과 로그인은 이 자동 검증에 포함되지 않아 별도 실행 확인이 필요합니다.
