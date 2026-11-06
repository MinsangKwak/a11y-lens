# 브랜치 보호 적용안

2026-11-06 확인 기준 **아직 적용되지 않았습니다.** GitHub 조회에서 `main`·`dev` 모두 `protected: false`이고 저장소 ruleset 목록은 비어 있었습니다. 문서에 지침을 적는 것과 GitHub에서 실제로 강제하는 것은 별개입니다.

## 적용할 조건

| 조건 | `main` | `dev` |
| --- | --- | --- |
| 대상 | `refs/heads/main` | `refs/heads/dev` |
| 규칙 상태 | 활성 | 활성 |
| 강제 push·삭제 | 차단 | 차단 |
| 변경 경로 | PR 필수 | PR 필수 |
| 미해결 리뷰 대화 | 해결 필수 | 해결 필수 |
| 병합 방식 | merge | rebase |
| 선형 이력 | 릴리스 merge를 허용하므로 미적용 | 적용 |
| 필수 검사 | CI가 main에 반영되는 시점에 `check` 연결 | GitHub Actions의 `check` 필수 |
| 최신 대상 브랜치와 검증 | 필수 검사 연결 시 활성 | 활성 |
| 우회 대상 | 기본적으로 없음 | 기본적으로 없음 |

현재 `main`에는 검사 워크플로가 없고 `dev`·PR #6·#7에 있습니다. `main`의 필수 검사를 먼저 켜면 워크플로가 없는 문서 PR도 대기하므로, PR·강제 push·삭제 보호를 먼저 적용하고 CI 반영과 함께 검사 조건을 연결합니다. `dev`의 필수 검사는 즉시 연결할 수 있습니다.

필수 검사 이름은 `.github/workflows/check.yml`의 `check`입니다. PR #7의 실제 check run에서 검사 이름 `check`, 실행 주체 `github-actions`, 앱 ID `15368`, 결과 `success`를 확인했습니다. 실행 주체도 지정해 이름만 같은 다른 상태 값으로 대체되지 않도록 합니다.

PR은 필수로 하되 필수 승인 수는 0으로 둡니다. 단독 운영에서 작성자가 자기 PR을 승인할 수 없어 생기는 교착을 피하기 위한 값입니다. 에이전트의 임의 병합 금지와 실제 Electron 확인 후 릴리스한다는 작업 규칙은 계속 적용됩니다.

## 적용 후 확인

1. GitHub 설정에서 두 브랜치에 활성 규칙이 연결되었는지 확인
2. 브랜치 조회의 `protected` 값과 적용 규칙을 다시 확인
3. 기존 PR #6·#7에서 `check`가 필수 검사로 표시되는지 확인
4. `main`에 CI가 반영될 때 동일 검사 조건을 연결하고 이 문서의 상태 갱신

검증을 위해 실제 강제 push나 브랜치 삭제를 시도하지 않습니다. 보호 설정·PR 병합 조건 조회로 확인합니다.

설정 변경에는 저장소 관리 권한이 필요합니다. 현재 연결된 GitHub 도구는 보호 설정 쓰기를 제공하지 않아 로그인한 GitHub 설정 화면에서 적용해야 합니다.

근거: [GitHub ruleset에서 지원하는 규칙](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
