# Mouse Finder v2

멀티 모니터 환경에서 마우스와 키보드를 화면 위에서 커스텀하는 데스크탑 유틸리티.

Electron 기반으로 **Windows + macOS** 모두 지원합니다.

## 주요 기능

### 1. 클릭 잔상 (Click Trail)
마우스 클릭 시 클릭한 위치에 시각적 잔상을 표시합니다.
- 잔상 유지 개수 설정 가능 (1회, 3회, 5회 등)
- 색상, 페이드 시간 커스터마이징

### 2. 마우스 찾기 비콘 (Beacon)
`Ctrl+Alt+F` — 현재 마우스 위치에 펄스 애니메이션을 표시하여 커서를 찾아줍니다.

### 3. 마우스 순간이동 (Teleport)
`Ctrl+Alt+T` — 지정한 좌표로 마우스를 이동시키고 비콘을 표시합니다.

### 4. 유휴 물결파동 (Idle Ripple)
마우스가 한 곳에 오래 멈춰 있으면 물결 파동 효과가 나타납니다.
- On/Off 토글 가능
- 대기 시간 설정 가능 (기본 3초)

### 5. 타이핑 캐릭터 (Typing Buddy)
화면 우측 하단에 2D 캐릭터가 상주합니다.
- 타이핑 시 캐릭터가 입력한 글자를 **"A! B! C!"** 하며 외칩니다
- 타이핑 속도에 따라 캐릭터 표정이 변합니다:
  - 느린 타이핑 → 차분한 표정
  - 보통 타이핑 → 활기찬 표정
  - 빠른 타이핑 → 신난 표정 + 흔들림 효과
  - 입력 없음 → 졸린 표정 (Zzz...)
- 캐릭터 이미지를 교체하여 나만의 캐릭터 사용 가능

## 설치

```bash
git clone https://github.com/funjo-B/mouse-finder.git
cd mouse-finder
npm install
```

## 실행

```bash
npm start
```

> **macOS**: 시스템 환경설정 → 보안 및 개인 정보 → 손쉬운 사용에서 앱 권한을 허용해야 합니다.
>
> **Windows**: 관리자 권한으로 실행이 필요할 수 있습니다.

## 설정

설정은 `electron-store`에 저장되며, 기본 설정 참고용 `config.json`이 포함되어 있습니다.

| 설정 | 설명 | 기본값 |
|------|------|--------|
| `findMouseHotkey` | 마우스 찾기 단축키 | `CommandOrControl+Alt+F` |
| `teleportHotkey` | 순간이동 단축키 | `CommandOrControl+Alt+T` |
| `teleportPosition` | 순간이동 좌표 `{x, y}` | `{960, 540}` |
| `clickTrail.enabled` | 클릭 잔상 on/off | `true` |
| `clickTrail.count` | 잔상 유지 개수 | `3` |
| `clickTrail.color` | 잔상 색상 | `#FF4444` |
| `idleRipple.enabled` | 물결파동 on/off | `true` |
| `idleRipple.idleSeconds` | 파동 시작까지 대기 시간(초) | `3` |
| `idleRipple.color` | 파동 색상 | `#4488FF` |
| `character.enabled` | 캐릭터 on/off | `true` |

시스템 트레이 아이콘 우클릭으로도 주요 기능을 토글할 수 있습니다.

## 캐릭터 커스터마이징

`assets/characters/default/` 폴더의 SVG 파일을 교체하면 나만의 캐릭터를 사용할 수 있습니다:

| 파일 | 용도 |
|------|------|
| `idle.svg` | 기본 대기 상태 |
| `talk-slow.svg` | 느린 타이핑 |
| `talk-normal.svg` | 보통 타이핑 |
| `talk-fast.svg` | 빠른 타이핑 |
| `sleepy.svg` | 졸린 상태 (입력 없음) |

SVG 대신 PNG/GIF 등 다른 이미지 형식도 사용 가능합니다 (`src/character/renderer.js`에서 확장자 수정).

## 기술 스택

- **Electron** — 크로스플랫폼 데스크탑 앱
- **uiohook-napi** — 전역 마우스/키보드 이벤트 감지
- **Canvas API** — 오버레이 이펙트 렌더링
- **electron-store** — 설정 영속화

## 요구사항

- Node.js 18+
- Windows 10/11 또는 macOS 12+

## 라이선스

MIT License
