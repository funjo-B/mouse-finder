"""설정 파일 관리 모듈"""

import json
import os
import sys

DEFAULT_CONFIG = {
    "find_mouse_hotkey": "ctrl+alt+f",
    "teleport_hotkey": "ctrl+alt+t",
    "teleport_position": {"x": 960, "y": 540},
    "beacon_color": "#FF4444",
    "beacon_size": 120,
    "beacon_duration": 1.5,
    "beacon_ring_width": 4,
    "autostart": False,
}


def get_config_path():
    """설정 파일 경로 반환"""
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "config.json")


def load_config():
    """설정 파일을 로드하고, 없으면 기본값으로 생성"""
    path = get_config_path()
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            user_config = json.load(f)
        config = {**DEFAULT_CONFIG, **user_config}
    else:
        config = DEFAULT_CONFIG.copy()
        save_config(config)
    return config


def save_config(config):
    """설정을 파일에 저장"""
    path = get_config_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
