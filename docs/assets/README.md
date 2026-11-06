# 문서 이미지

README와 Notion에서 프로젝트 구조와 검증 근거를 설명하는 그림입니다. 실제 Electron 실행 화면을 대체하는 스크린샷으로 사용하지 않습니다.

| 파일 | 내용 |
| --- | --- |
| [architecture.png](architecture.png) | `dev` 기준 공통 판정 엔진·CLI·데스크톱·명암비 이력 대조 구조 |
| [verification.png](verification.png) | PR #6의 CI 단일 비교와 PR #7의 3G 재현 중앙값, 서로 다른 검증 수 |
| [architecture.svg](architecture.svg) · [verification.svg](verification.svg) | 편집 가능한 벡터 원본 |

표시용 PNG에는 한글을 포함해 두었으므로 독자의 글꼴 설치 여부와 관계없이 표시됩니다. 두 PNG 합계는 약 400KB입니다. SVG를 수정하면 한글을 지원하는 환경에서 PNG도 같은 이름으로 내보내고 수치·줄바꿈을 확인합니다.

Git 문서는 저장소 상대 경로로 PNG를 참조합니다. Notion은 같은 PNG를 파일로 첨부합니다. 임시 다운로드 주소나 존재하지 않는 이미지 경로는 문서에 넣지 않습니다.

검증 수치의 조건과 원본 링크는 [검증 기록](../VALIDATION.md)에 있습니다. 코드 기준·PR 상태가 달라지면 본문과 그림을 함께 갱신합니다.
