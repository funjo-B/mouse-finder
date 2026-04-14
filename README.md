# Mouse Finder 🖱️

멀티 모니터 환경에서 마우스 커서를 쉽게 찾아주는 Windows 유틸리티입니다.

여러 대의 모니터를 사용하다 보면 마우스 커서가 어디 있는지 찾기 어려울 때가 있습니다.
**Mouse Finder**는 단축키 하나로 마우스 위치를 시각적으로 알려주거나, 원하는 위치로 마우스를 순간이동시켜 줍니다.

## 주요 기능

- **마우스 찾기** (`Ctrl+Alt+F`): 현재 마우스 위치에 빨간 펄스 애니메이션을 표시하여 커서 위치를 알려줍니다
- **마우스 순간이동** (`Ctrl+Alt+T`): 미리 설정한 좌표로 마우스를 이동시킨 후 비콘을 표시합니다
- **시스템 트레이**: 백그라운드에서 조용히 실행됩니다
- **커스텀 설정**: 단축키, 비콘 색상, 크기, 이동 위치 등을 자유롭게 설정할 수 있습니다

## 설치

```bash
# 저장소 클론
git clone https://github.com/funjo-B/mouse-finder.git
cd mouse-finder

# 의존성 설치
pip install -r requirements.txt
```

## 실행

```bash
# 방법 1: Python 모듈로 실행
python -m mouse_finder.main

# 방법 2: run.bat 더블클릭 (Windows)
run.bat
```

> **참고**: `keyboard` 라이브러리가 전역 키 입력을 감지하므로 **관리자 권한**으로 실행해야 할 수 있습니다.

## 설정

`config.json` 파일을 편집하여 설정을 변경할 수 있습니다:

```json
{
  "find_mouse_hotkey": "ctrl+alt+f",
  "teleport_hotkey": "ctrl+alt+t",
  "teleport_position": {
    "x": 960,
    "y": 540
  },
  "beacon_color": "#FF4444",
  "beacon_size": 120,
  "beacon_duration": 1.5,
  "beacon_ring_width": 4
}
```

| 설정 | 설명 | 기본값 |
|------|------|--------|
| `find_mouse_hotkey` | 마우스 찾기 단축키 | `ctrl+alt+f` |
| `teleport_hotkey` | 마우스 순간이동 단축키 | `ctrl+alt+t` |
| `teleport_position` | 순간이동 목표 좌표 (x, y) | `(960, 540)` |
| `beacon_color` | 비콘 색상 (HEX) | `#FF4444` |
| `beacon_size` | 비콘 최대 크기 (px) | `120` |
| `beacon_duration` | 비콘 표시 시간 (초) | `1.5` |
| `beacon_ring_width` | 비콘 링 두께 (px) | `4` |

### 단축키 조합 예시

- `ctrl+alt+f` — Ctrl + Alt + F
- `ctrl+shift+space` — Ctrl + Shift + Space
- `win+f1` — Windows키 + F1

## 요구사항

- Windows 10/11
- Python 3.8+

## 라이선스

MIT License
