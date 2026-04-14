"""전역 단축키 등록 및 관리 모듈"""

import keyboard


class HotkeyManager:
    """전역 단축키를 등록하고 관리"""

    def __init__(self):
        self._registered = []

    def register(self, hotkey_str, callback):
        """단축키를 등록

        Args:
            hotkey_str: 단축키 문자열 (예: "ctrl+alt+f")
            callback: 단축키가 눌렸을 때 호출할 함수
        """
        keyboard.add_hotkey(hotkey_str, callback, suppress=True)
        self._registered.append(hotkey_str)

    def unregister_all(self):
        """등록된 모든 단축키 해제"""
        for hotkey in self._registered:
            try:
                keyboard.remove_hotkey(hotkey)
            except KeyError:
                pass
        self._registered.clear()

    def update_hotkey(self, old_hotkey, new_hotkey, callback):
        """단축키를 변경"""
        try:
            keyboard.remove_hotkey(old_hotkey)
            self._registered.remove(old_hotkey)
        except (KeyError, ValueError):
            pass
        self.register(new_hotkey, callback)
