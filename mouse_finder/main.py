"""Mouse Finder - 메인 애플리케이션 엔트리포인트"""

import sys
import threading

import pyautogui

from mouse_finder.beacon import MouseBeacon
from mouse_finder.config import load_config, save_config
from mouse_finder.hotkeys import HotkeyManager
from mouse_finder.tray import TrayApp


class MouseFinderApp:
    """마우스 찾기 애플리케이션"""

    def __init__(self):
        self.config = load_config()
        self.beacon = MouseBeacon(
            color=self.config["beacon_color"],
            max_size=self.config["beacon_size"],
            duration=self.config["beacon_duration"],
            ring_width=self.config["beacon_ring_width"],
        )
        self.hotkey_manager = HotkeyManager()
        self.tray = TrayApp(on_quit=self.quit)

    def start(self):
        """애플리케이션 시작"""
        print("Mouse Finder 시작!")
        print(f"  마우스 찾기 단축키: {self.config['find_mouse_hotkey']}")
        print(f"  마우스 이동 단축키: {self.config['teleport_hotkey']}")
        tp = self.config["teleport_position"]
        print(f"  이동 위치: ({tp['x']}, {tp['y']})")
        print()
        print("시스템 트레이에서 실행 중... 종료하려면 트레이 아이콘 우클릭 → 종료")

        # 단축키 등록
        self.hotkey_manager.register(
            self.config["find_mouse_hotkey"], self._on_find_mouse
        )
        self.hotkey_manager.register(
            self.config["teleport_hotkey"], self._on_teleport_mouse
        )

        # 시스템 트레이 실행 (메인 스레드에서)
        self.tray.run()

    def quit(self):
        """애플리케이션 종료"""
        print("\nMouse Finder 종료.")
        self.hotkey_manager.unregister_all()

    def _on_find_mouse(self):
        """마우스 찾기 - 현재 위치에 비콘 표시"""
        x, y = pyautogui.position()
        self.beacon.show(x, y)

    def _on_teleport_mouse(self):
        """마우스 텔레포트 - 지정 위치로 이동 후 비콘 표시"""
        tp = self.config["teleport_position"]
        x, y = tp["x"], tp["y"]
        pyautogui.moveTo(x, y)
        self.beacon.show(x, y)


def main():
    app = MouseFinderApp()
    try:
        app.start()
    except KeyboardInterrupt:
        app.quit()


if __name__ == "__main__":
    main()
