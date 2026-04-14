"""마우스 위치에 시각적 비콘(원형 링) 효과를 표시하는 모듈"""

import threading
import tkinter as tk


class MouseBeacon:
    """마우스 커서 위치에 펄스 애니메이션 비콘을 표시"""

    def __init__(self, color="#FF4444", max_size=120, duration=1.5, ring_width=4):
        self.color = color
        self.max_size = max_size
        self.duration = duration
        self.ring_width = ring_width
        self._lock = threading.Lock()

    def show(self, x, y):
        """주어진 좌표에 비콘 애니메이션을 표시 (별도 스레드)"""
        t = threading.Thread(target=self._run_beacon, args=(x, y), daemon=True)
        t.start()

    def _run_beacon(self, x, y):
        with self._lock:
            root = tk.Tk()
            root.withdraw()
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            root.attributes("-transparentcolor", "black")
            root.configure(bg="black")

            size = self.max_size * 2
            root.geometry(f"{size}x{size}+{x - size // 2}+{y - size // 2}")

            canvas = tk.Canvas(
                root, width=size, height=size, bg="black", highlightthickness=0
            )
            canvas.pack()

            center = size // 2
            total_frames = 45
            frame_delay = int((self.duration * 1000) / total_frames)

            self._animate(root, canvas, center, 0, total_frames, frame_delay)
            root.deiconify()
            root.mainloop()

    def _animate(self, root, canvas, center, frame, total_frames, delay):
        """프레임별 펄스 애니메이션"""
        if frame >= total_frames:
            root.destroy()
            return

        canvas.delete("beacon")
        progress = frame / total_frames

        # 바깥으로 퍼지는 원 (fade out)
        radius_out = int(self.max_size * progress)
        alpha_out = max(0, 1.0 - progress)
        color_out = self._fade_color(self.color, alpha_out)
        if radius_out > 0:
            canvas.create_oval(
                center - radius_out,
                center - radius_out,
                center + radius_out,
                center + radius_out,
                outline=color_out,
                width=self.ring_width,
                tags="beacon",
            )

        # 안쪽 펄스 원
        pulse = abs((progress * 3) % 2 - 1)  # 0→1→0 반복
        radius_in = int(self.max_size * 0.3 * (0.5 + 0.5 * pulse))
        alpha_in = max(0, 0.8 - progress * 0.6)
        color_in = self._fade_color(self.color, alpha_in)
        if radius_in > 0:
            canvas.create_oval(
                center - radius_in,
                center - radius_in,
                center + radius_in,
                center + radius_in,
                outline=color_in,
                width=self.ring_width + 2,
                tags="beacon",
            )

        # 중앙 점
        dot_r = 5
        canvas.create_oval(
            center - dot_r,
            center - dot_r,
            center + dot_r,
            center + dot_r,
            fill=self.color,
            outline=self.color,
            tags="beacon",
        )

        root.after(delay, self._animate, root, canvas, center, frame + 1, total_frames, delay)

    @staticmethod
    def _fade_color(hex_color, alpha):
        """색상의 밝기를 alpha 값에 따라 조정 (검정 배경 기준)"""
        hex_color = hex_color.lstrip("#")
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        r = int(r * alpha)
        g = int(g * alpha)
        b = int(b * alpha)
        return f"#{r:02x}{g:02x}{b:02x}"
