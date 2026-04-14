"""시스템 트레이 아이콘 모듈"""

import threading

from PIL import Image, ImageDraw
from pystray import Icon, Menu, MenuItem


class TrayApp:
    """시스템 트레이 아이콘으로 앱을 관리"""

    def __init__(self, on_quit, on_settings=None):
        self.on_quit = on_quit
        self.on_settings = on_settings
        self._icon = None

    def run(self):
        """트레이 아이콘을 시작"""
        image = self._create_icon()
        menu = Menu(
            MenuItem("Mouse Finder", None, enabled=False),
            Menu.SEPARATOR,
            MenuItem("종료", self._quit),
        )
        self._icon = Icon("mouse_finder", image, "Mouse Finder", menu)
        self._icon.run()

    def stop(self):
        """트레이 아이콘 종료"""
        if self._icon:
            self._icon.stop()

    def _quit(self, icon, item):
        self.on_quit()
        icon.stop()

    @staticmethod
    def _create_icon():
        """트레이 아이콘 이미지 생성 (마우스 커서 + 돋보기 모양)"""
        size = 64
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # 마우스 커서 형태
        draw.polygon(
            [(10, 8), (10, 48), (22, 38), (32, 54), (38, 50), (28, 34), (40, 30)],
            fill=(255, 68, 68, 255),
            outline=(255, 255, 255, 255),
        )

        # 원형 탐색 효과
        draw.arc(
            [28, 28, 58, 58], 0, 360, fill=(255, 200, 200, 200), width=3
        )

        return img
