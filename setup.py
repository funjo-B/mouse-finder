from setuptools import setup, find_packages

setup(
    name="mouse-finder",
    version="1.0.0",
    description="멀티 모니터 환경에서 마우스 커서를 쉽게 찾아주는 유틸리티",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "keyboard>=0.13.5",
        "pyautogui>=0.9.54",
        "pystray>=0.19.5",
        "Pillow>=10.0.0",
    ],
    entry_points={
        "console_scripts": [
            "mouse-finder=mouse_finder.main:main",
        ],
    },
)
