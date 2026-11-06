---
version: alpha
name: "a11y-lens"
description: "명암비·접근성 검수 결과와 대상 화면을 나란히 보는 데스크톱 도구"
colors:
  primary: "#e7e9ee"
  background: "#16181d"
  foreground: "#e7e9ee"
  muted: "#9aa0ab"
  border: "#2b2f37"
  fail: "#ff5c5c"
  unknown: "#f0b429"
  allowed: "#7a8290"
typography:
  sans:
    fontFamily: '-apple-system, "Pretendard", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: "1.5"
rounded:
  DEFAULT: "8px"
spacing:
  tap: "44px"
  panel: "16px"
  panelGap: "12px"
components:
  gate:
    width: "440px"
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.sans}"
  panel:
    width: "420px"
    textColor: "{colors.foreground}"
  muted:
    textColor: "{colors.muted}"
  divider:
    backgroundColor: "{colors.border}"
  fail:
    textColor: "{colors.fail}"
  unknown:
    textColor: "{colors.unknown}"
  allowed:
    textColor: "{colors.allowed}"
---

# a11y-lens 화면 기준

## Overview

금융·외주 웹 화면을 검수하는 사람이 PC에서 사용하는 한국어 도구입니다. 왼쪽은 검사 조작과 결과, 오른쪽은 Electron의 검사 대상 뷰입니다. 기존 어두운 표면과 위반·판단 불가·예외의 색 구분을 유지합니다. 이번 수정은 초기 로딩과 배치 갱신에 한정하며 시각적 재설계를 하지 않습니다.

색·크기·간격의 원본은 `packages/desktop/src/renderer/src/app.css`입니다. 이 문서는 원본을 기록하며 별도 스타일을 생성하지 않습니다. Electron 창의 초기 바탕은 `src/main/index.ts`의 `backgroundColor`로 같은 바탕색을 사용합니다.

## Colors

`--bg`·`--fg`·`--dim`·`--line`이 바탕·본문·보조·경계를 담당합니다. `--fail`·`--unknown`·`--allowed`는 검사 의미를 나타냅니다. 결과는 색과 함께 텍스트로 구분합니다. 성능 개선을 위해 명암비 판정 기준이나 검사 대상의 스타일을 변경하지 않습니다.

## Typography

기본은 기존 시스템 글꼴이며 Pretendard가 설치된 경우 이를 사용합니다. 웹폰트 다운로드는 없습니다. 본문은 14px·줄높이 1.5, 로그인 제목은 28px입니다. 새 글꼴·아이콘·이미지 의존성을 추가하지 않습니다.

## Layout

로그인 영역은 최대 440px, 내부 여백은 위아래 96px·좌우 24px입니다. 로그인 뒤에는 420px 조작 패널과 나머지 검사 영역을 배치합니다. 패널이 세로 스크롤을 담당합니다.

HTML 시작 화면과 React의 로그인 확인 화면은 같은 제목·간격·스타일을 사용합니다. CSS는 HTML의 링크에서 발견해 JavaScript 실행 전에 적용합니다. 대상 뷰의 좌표는 렌더러가 측정하고 `targetBounds.ts`가 프레임당 한 번으로 합치며, 같은 정수 좌표를 다시 전송하지 않습니다.

## Elevation & Depth

기존 표면색과 1px 경계로 영역을 구분합니다. 새 그림자·블러·그라데이션·로딩 애니메이션을 추가하지 않습니다.

## Shapes

기본 모서리는 `--r-box` 8px, 조작 높이는 `--tap` 44px입니다. 대기 문구로 바뀌어도 버튼의 가로·세로 크기를 유지합니다.

## Components

프로젝트 선택은 기존 네이티브 `select`가 원본입니다. 옵션 팝업의 배치·스크롤·키보드 동작은 데스크톱 운영체제에 맡깁니다. 별도 목록 상자를 만들지 않습니다. URL 폼은 기존 `open()` 경로의 성공·실패 상태를 사용하며 브라우저 검증 팝업을 추가하지 않습니다.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | `App.tsx`의 네이티브 프로젝트 선택 | 이 문서와 `app.css` | 운영체제 기본 팝업 | `test/rendering.browser.mjs`의 선택·키보드·크기 검사 |

시작 화면은 `role="status"`와 한국어 확인 문구를 사용합니다. 로딩 중 숨겨 둔 실제 화면을 완료된 것처럼 표시하지 않습니다. 로그인과 로그아웃의 대상 뷰 표시 규칙은 그대로 유지합니다.

## Do's and Don'ts

- 기존 색·간격은 공통 CSS에서 관리합니다.
- 시작 화면을 JavaScript·네트워크 응답에만 의존시키지 않습니다.
- 화면 배치 읽기와 IPC를 같은 프레임에 반복하지 않습니다.
- 초기 리소스와 배치 갱신만 개선하며 외부 검사 대상 페이지의 스타일을 임의로 바꾸지 않습니다.
- 브라우저 렌더러 검증을 실제 Electron 창·로그인 확인으로 표현하지 않습니다.
