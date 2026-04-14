const {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  systemPreferences,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const { execSync } = require("child_process");
const Store = require("electron-store");
const { uIOhook, UiohookKey } = require("uiohook-napi");

const DEV = process.argv.includes("--dev");

// Windows 투명 윈도우 렌더링 지원
app.commandLine.appendSwitch("enable-transparent-visuals");

// ─── 설정 ────────────────────────────────────────────
const store = new Store({
  defaults: {
    findMouseHotkey: "CommandOrControl+Alt+F",
    teleportHotkey: "CommandOrControl+Alt+T",
    teleportPosition: { x: 960, y: 540 },
    beacon: {
      color: "#FF4444",
      size: 120,
      duration: 1.5,
    },
    clickTrail: {
      enabled: true,
      effectType: "crack",
      count: 3,
      color: "#FF4444",
      crackSize: 80,
      fadeDuration: 1.0,
    },
    idleRipple: {
      enabled: true,
      effectType: "ripple",
      idleSeconds: 3,
      color: "#4488FF",
      size: 80,
      interval: 2.0,
    },
    character: {
      enabled: true,
      position: "bottom-right",
    },
  },
});

let overlayWindows = [];   // 모니터별 오버레이 윈도우
let characterWindow = null;
let tray = null;

// ─── 설정 캐시 (store.get() 파일 I/O 제거) ──────────
let cfg = store.store;  // 메모리 캐시
store.onDidAnyChange((newVal) => { cfg = newVal; });

// 마우스 유휴 감지용
let lastMousePos = { x: 0, y: 0 };
let mouseIdleTime = 0;
let idleRippleInterval = null;
const POLL_INTERVAL_MS = 500;

// 타이핑 속도 감지용
let recentKeyTimes = [];
const SPEED_WINDOW_MS = 3000;

// ─── 오버레이 윈도우 (모니터별 1개) ──────────────────
function createOverlayWindows() {
  const displays = screen.getAllDisplays();
  console.log(`[overlay] 모니터 ${displays.length}개 감지`);

  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    console.log(`[overlay] 모니터 생성: ${width}x${height} @ (${x}, ${y})`);

    const winOpts = {
      x, y, width, height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      resizable: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
      },
    };
    if (process.platform === "darwin") {
      winOpts.type = "panel";
    }

    const win = new BrowserWindow(winOpts);
    win.setIgnoreMouseEvents(true);
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.webContents.on("did-finish-load", () => {
      console.log(`[overlay] 모니터(${x},${y}) 로드 완료`);
    });

    win.loadFile("src/overlay/index.html");
    if (DEV && display === displays[0]) {
      win.webContents.openDevTools({ mode: "detach" });
    }

    // 이 윈도우가 담당하는 모니터 범위 저장
    win._displayBounds = { x, y, width, height };
    overlayWindows.push(win);
  }
}

// ─── 캐릭터 윈도우 ───────────────────────────────────
function createCharacterWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const charW = 200;
  const charH = 260;

  characterWindow = new BrowserWindow({
    x: width - charW - 20,
    y: height - charH - 20,
    width: charW,
    height: charH,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  characterWindow.setAlwaysOnTop(true, "screen-saver");
  characterWindow.setVisibleOnAllWorkspaces(true);

  characterWindow.webContents.on("did-finish-load", () => {
    console.log("[character] 로드 완료");
  });

  characterWindow.loadFile("src/character/index.html");
  if (DEV) characterWindow.webContents.openDevTools({ mode: "detach" });

  if (!cfg.character.enabled) {
    characterWindow.hide();
  }
}

// ─── 시스템 트레이 ───────────────────────────────────
function createTray() {
  // 16x16 트레이 아이콘을 코드로 생성 (파란 원 + 흰 커서)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - 8, dy = y - 8;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 7) {
        canvas[idx] = 0x6E;     // R
        canvas[idx + 1] = 0xC6; // G
        canvas[idx + 2] = 0xFF; // B
        canvas[idx + 3] = 255;  // A
      }
    }
  }
  // 중앙에 흰 점
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const idx = ((8 + dy) * size + (8 + dx)) * 4;
      canvas[idx] = 255; canvas[idx + 1] = 255; canvas[idx + 2] = 255; canvas[idx + 3] = 255;
    }
  }
  const trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Mouse Finder v2", enabled: false },
    { type: "separator" },
    {
      label: "클릭 잔상",
      type: "checkbox",
      checked: cfg.clickTrail.enabled,
      click: (item) => {
        store.set("clickTrail.enabled", item.checked);
      },
    },
    {
      label: "유휴 물결파동",
      type: "checkbox",
      checked: cfg.idleRipple.enabled,
      click: (item) => {
        store.set("idleRipple.enabled", item.checked);
      },
    },
    {
      label: "타이핑 캐릭터",
      type: "checkbox",
      checked: cfg.character.enabled,
      click: (item) => {
        store.set("character.enabled", item.checked);
        if (item.checked) characterWindow?.show();
        else characterWindow?.hide();
      },
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Mouse Finder");
  tray.setContextMenu(contextMenu);
}

// ─── 전역 단축키 ─────────────────────────────────────
function registerShortcuts() {
  const findKey = cfg.findMouseHotkey;
  const ok = globalShortcut.register(findKey, () => {
    const pos = screen.getCursorScreenPoint();
    sendToOverlay("beacon", { x: pos.x, y: pos.y, ...cfg.beacon });
  });
  console.log(`[shortcut] ${findKey} 등록: ${ok ? "성공" : "실패"}`);

  globalShortcut.register(cfg.teleportHotkey, () => {
    const tp = cfg.teleportPosition;
    // 마우스를 지정 위치로 이동
    moveMouse(tp.x, tp.y);
    sendToOverlay("teleport-beacon", { x: tp.x, y: tp.y, ...cfg.beacon });
  });
}

// ─── 입력 후킹 (uiohook) ─────────────────────────────
function setupInputHooks() {
  // 마우스 클릭 감지 (mousedown = 누르는 순간 반응)
  uIOhook.on("mousedown", (e) => {
    if (!cfg.clickTrail.enabled) return;
    sendToOverlay("click-trail", {
      x: e.x,
      y: e.y,
      ...cfg.clickTrail,
    });
  });

  // 키보드 입력 감지
  uIOhook.on("keydown", (e) => {
    // 한/영 키 토글 (Windows: 0x70, macOS: 폴링으로 처리)
    if (process.platform === "win32") {
      if (e.keycode === HANGUL_KEYCODE) {
        inputLang = inputLang === "ko" ? "en" : "ko";
        console.log(`[lang] 한/영 토글 → ${inputLang}`);
        return;
      }
      if (e.keycode === HANJA_KEYCODE) return;
    }

    if (!cfg.character.enabled) return;

    const key = keycodeToChar(e.keycode, e.shiftKey);
    if (!key) return;

    const now = Date.now();
    recentKeyTimes.push(now);
    recentKeyTimes = recentKeyTimes.filter((t) => now - t < SPEED_WINDOW_MS);

    const wpm = Math.round((recentKeyTimes.length / SPEED_WINDOW_MS) * 60000);
    sendToCharacter("key-typed", { key, wpm });
  });

  try {
    uIOhook.start();
    console.log("[uiohook] 입력 후킹 시작됨");
  } catch (err) {
    console.error("[uiohook] 시작 실패:", err.message);
  }
}

// ─── 마우스 유휴 감지 ─────────────────────────────────
function startIdleDetection() {
  let rippleActive = false;

  setInterval(() => {
    if (!cfg.idleRipple.enabled) {
      mouseIdleTime = 0;
      rippleActive = false;
      return;
    }

    const pos = screen.getCursorScreenPoint();
    const threshold = cfg.idleRipple.idleSeconds * 1000;

    if (pos.x === lastMousePos.x && pos.y === lastMousePos.y) {
      mouseIdleTime += POLL_INTERVAL_MS;

      if (mouseIdleTime >= threshold && !rippleActive) {
        rippleActive = true;
        sendToOverlay("ripple-start", {
          x: pos.x,
          y: pos.y,
          effectType: cfg.idleRipple.effectType,
          color: cfg.idleRipple.color,
          size: cfg.idleRipple.size,
          interval: cfg.idleRipple.interval,
        });
      }
    } else {
      if (rippleActive) {
        sendToOverlay("ripple-stop", {});
        rippleActive = false;
      }
      mouseIdleTime = 0;
      lastMousePos = { x: pos.x, y: pos.y };
    }
  }, POLL_INTERVAL_MS);
}

// ─── 유틸리티 ─────────────────────────────────────────
function sendToOverlay(channel, data) {
  // 좌표가 있는 이벤트는 해당 모니터에만, 없으면 전체에 전송
  for (const win of overlayWindows) {
    if (win.isDestroyed()) continue;
    const b = win._displayBounds;

    if (data.x !== undefined && data.y !== undefined) {
      // 이 모니터 영역 안에 좌표가 있는지 확인
      if (data.x >= b.x && data.x < b.x + b.width &&
          data.y >= b.y && data.y < b.y + b.height) {
        win.webContents.send(channel, {
          ...data,
          _offsetX: b.x,
          _offsetY: b.y,
        });
        return;
      }
    } else {
      // 좌표 없는 이벤트 (ripple-stop 등)는 전체 전송
      win.webContents.send(channel, { ...data, _offsetX: b.x, _offsetY: b.y });
    }
  }
}

function sendToCharacter(channel, data) {
  if (characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.webContents.send(channel, data);
  }
}

// ─── 한영 감지: 시작 시 koffi로 초기값 + 한/영 키 토글 ─
let inputLang = "en";
const HANGUL_KEYCODE = 0x70;
const HANJA_KEYCODE = 0x71;

// ─── macOS 접근성 권한 체크 ───────────────────────────
function checkAccessibilityPermission() {
  if (process.platform !== "darwin") return;

  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (!trusted) {
    dialog.showMessageBoxSync({
      type: "warning",
      title: "접근성 권한 필요",
      message:
        "Mouse Finder가 키보드/마우스 이벤트를 감지하려면 접근성 권한이 필요합니다.\n\n" +
        "시스템 설정 → 개인 정보 보호 및 보안 → 접근성에서 Mouse Finder를 허용해 주세요.\n\n" +
        "권한 설정 후 앱을 재시작해 주세요.",
    });
    // 시스템 접근성 설정 열기
    systemPreferences.isTrustedAccessibilityClient(true);
  } else {
    console.log("[macOS] 접근성 권한 확인됨");
  }
}

// ─── 마우스 이동 (Windows: SetCursorPos, macOS: CoreGraphics) ─
let moveMouse = (x, y) => {};

function initMoveMouse() {
  if (process.platform === "win32") {
    try {
      const koffi = require("koffi");
      const user32 = koffi.load("user32.dll");
      const SetCursorPos = user32.func("int __stdcall SetCursorPos(int x, int y)");
      moveMouse = (x, y) => SetCursorPos(x, y);
      console.log("[mouse] Win32 SetCursorPos 초기화 성공");
    } catch (e) {
      console.error("[mouse] Win32 초기화 실패:", e.message);
    }
  } else if (process.platform === "darwin") {
    try {
      const koffi = require("koffi");
      const CGPoint = koffi.struct("CGPoint", { x: "double", y: "double" });
      const cg = koffi.load("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics");
      const CGWarpMouseCursorPosition = cg.func("int32 CGWarpMouseCursorPosition(CGPoint point)");
      moveMouse = (x, y) => CGWarpMouseCursorPosition({ x, y });
      console.log("[mouse] macOS CGWarpMouseCursorPosition 초기화 성공");
    } catch (e) {
      // fallback: osascript
      moveMouse = (x, y) => {
        try {
          execSync(`osascript -e 'tell application "System Events" to key code 0' -e ''`);
          // CoreGraphics fallback via python
          execSync(`python3 -c "import Quartz; Quartz.CGWarpMouseCursorPosition((${x}, ${y}))"`);
        } catch {}
      };
      console.log("[mouse] macOS fallback 모드 (python3)");
    }
  }
}

function detectInitialInputLang() {
  if (process.platform === "win32") {
    try {
      const koffi = require("koffi");
      const user32 = koffi.load("user32.dll");
      const GetForegroundWindow = user32.func("void* __stdcall GetForegroundWindow()");
      const GetWindowThreadProcessId = user32.func("uint32 __stdcall GetWindowThreadProcessId(void* hwnd, uint32* pid)");
      const GetKeyboardLayout = user32.func("intptr __stdcall GetKeyboardLayout(uint32 thread)");

      const hwnd = GetForegroundWindow();
      const pid = new Uint32Array(1);
      const tid = GetWindowThreadProcessId(hwnd, pid);
      const layout = GetKeyboardLayout(tid);
      const langId = layout & 0xFFFF;
      inputLang = langId === 0x0412 ? "ko" : "en";
      console.log(`[lang] 초기 입력 언어 감지: ${inputLang} (0x${langId.toString(16)})`);
    } catch (e) {
      console.log("[lang] Win32 초기 감지 실패, 기본값 en 사용");
    }
  } else if (process.platform === "darwin") {
    detectMacInputLang();
    // macOS는 한/영 키가 없으므로 주기적 폴링으로 감지
    setInterval(detectMacInputLang, 300);
  }
}

function detectMacInputLang() {
  try {
    const result = execSync(
      "defaults read ~/Library/Preferences/com.apple.HIToolbox AppleSelectedInputSources 2>/dev/null | head -20",
      { timeout: 1000, encoding: "utf-8" }
    );
    const newLang = /Korean|HangulKeyboard|2SetKorean|Hangul/i.test(result) ? "ko" : "en";
    if (newLang !== inputLang) {
      console.log(`[lang] macOS: ${inputLang} → ${newLang}`);
      inputLang = newLang;
    }
  } catch {}
}

// ─── 키코드 → 문자 매핑 ──────────────────────────────
const ENGLISH_MAP = {
  [UiohookKey.Q]: "Q", [UiohookKey.W]: "W", [UiohookKey.E]: "E",
  [UiohookKey.R]: "R", [UiohookKey.T]: "T", [UiohookKey.Y]: "Y",
  [UiohookKey.U]: "U", [UiohookKey.I]: "I", [UiohookKey.O]: "O",
  [UiohookKey.P]: "P",
  [UiohookKey.A]: "A", [UiohookKey.S]: "S", [UiohookKey.D]: "D",
  [UiohookKey.F]: "F", [UiohookKey.G]: "G", [UiohookKey.H]: "H",
  [UiohookKey.J]: "J", [UiohookKey.K]: "K", [UiohookKey.L]: "L",
  [UiohookKey.Z]: "Z", [UiohookKey.X]: "X", [UiohookKey.C]: "C",
  [UiohookKey.V]: "V", [UiohookKey.B]: "B", [UiohookKey.N]: "N",
  [UiohookKey.M]: "M",
};

const KOREAN_MAP = {
  [UiohookKey.Q]: "ㅂ", [UiohookKey.W]: "ㅈ", [UiohookKey.E]: "ㄷ",
  [UiohookKey.R]: "ㄱ", [UiohookKey.T]: "ㅅ", [UiohookKey.Y]: "ㅛ",
  [UiohookKey.U]: "ㅕ", [UiohookKey.I]: "ㅑ", [UiohookKey.O]: "ㅐ",
  [UiohookKey.P]: "ㅔ",
  [UiohookKey.A]: "ㅁ", [UiohookKey.S]: "ㄴ", [UiohookKey.D]: "ㅇ",
  [UiohookKey.F]: "ㄹ", [UiohookKey.G]: "ㅎ", [UiohookKey.H]: "ㅗ",
  [UiohookKey.J]: "ㅓ", [UiohookKey.K]: "ㅏ", [UiohookKey.L]: "ㅣ",
  [UiohookKey.Z]: "ㅋ", [UiohookKey.X]: "ㅌ", [UiohookKey.C]: "ㅊ",
  [UiohookKey.V]: "ㅍ", [UiohookKey.B]: "ㅠ", [UiohookKey.N]: "ㅜ",
  [UiohookKey.M]: "ㅡ",
};

const KOREAN_SHIFT_MAP = {
  [UiohookKey.Q]: "ㅃ", [UiohookKey.W]: "ㅉ", [UiohookKey.E]: "ㄸ",
  [UiohookKey.R]: "ㄲ", [UiohookKey.T]: "ㅆ",
  [UiohookKey.O]: "ㅒ", [UiohookKey.P]: "ㅖ",
};

const NUMBER_MAP = {
  [UiohookKey[1]]: "1", [UiohookKey[2]]: "2", [UiohookKey[3]]: "3",
  [UiohookKey[4]]: "4", [UiohookKey[5]]: "5", [UiohookKey[6]]: "6",
  [UiohookKey[7]]: "7", [UiohookKey[8]]: "8", [UiohookKey[9]]: "9",
  [UiohookKey[0]]: "0",
};

const SPECIAL_MAP = {
  [UiohookKey.Space]: "⎵",
  [UiohookKey.Enter]: "↵",
  [UiohookKey.Backspace]: "←",
  [UiohookKey.Tab]: "⇥",
};

function keycodeToChar(keycode, shiftKey) {
  // 숫자
  if (NUMBER_MAP[keycode]) return NUMBER_MAP[keycode];

  // 특수 키
  if (SPECIAL_MAP[keycode]) return SPECIAL_MAP[keycode];

  // 알파벳 — 한영에 따라 분기
  if (inputLang === "ko") {
    if (shiftKey && KOREAN_SHIFT_MAP[keycode]) return KOREAN_SHIFT_MAP[keycode];
    if (KOREAN_MAP[keycode]) return KOREAN_MAP[keycode];
  }

  // 영어 (기본) — 직접 매핑 테이블 사용
  if (ENGLISH_MAP[keycode]) return ENGLISH_MAP[keycode];

  return null;
}

// ─── 캐릭터 우클릭 설정 메뉴 ──────────────────────────
ipcMain.on("show-character-menu", (event) => {
  const menu = Menu.buildFromTemplate([
    { label: "🐱 Mouse Finder 설정", enabled: false },
    { type: "separator" },
    {
      label: "클릭 이펙트",
      submenu: [
        {
          label: "화면 깨짐 (Crack)",
          type: "radio",
          checked: cfg.clickTrail.effectType === "crack",
          click: () => { store.set("clickTrail.effectType", "crack"); },
        },
        {
          label: "잔상 (Trail)",
          type: "radio",
          checked: cfg.clickTrail.effectType === "trail",
          click: () => { store.set("clickTrail.effectType", "trail"); },
        },
      ],
    },
    {
      label: "클릭 크랙 크기",
      submenu: [
        { label: "작게",  type: "radio", checked: cfg.clickTrail.crackSize <= 40,  click: () => store.set("clickTrail.crackSize", 30) },
        { label: "보통",  type: "radio", checked: cfg.clickTrail.crackSize > 40 && cfg.clickTrail.crackSize <= 70, click: () => store.set("clickTrail.crackSize", 60) },
        { label: "크게",  type: "radio", checked: cfg.clickTrail.crackSize > 70 && cfg.clickTrail.crackSize <= 120, click: () => store.set("clickTrail.crackSize", 100) },
        { label: "최대",  type: "radio", checked: cfg.clickTrail.crackSize > 120, click: () => store.set("clickTrail.crackSize", 160) },
      ],
    },
    { type: "separator" },
    {
      label: "유휴 이펙트",
      submenu: [
        {
          label: "물결파동 (Ripple)",
          type: "radio",
          checked: cfg.idleRipple.effectType === "ripple",
          click: () => store.set("idleRipple.effectType", "ripple"),
        },
        {
          label: "화면 깨짐 (Crack)",
          type: "radio",
          checked: cfg.idleRipple.effectType === "crack",
          click: () => store.set("idleRipple.effectType", "crack"),
        },
      ],
    },
    {
      label: "유휴 이펙트 크기",
      submenu: [
        { label: "작게", type: "radio", checked: cfg.idleRipple.size <= 50,  click: () => store.set("idleRipple.size", 40) },
        { label: "보통", type: "radio", checked: cfg.idleRipple.size > 50 && cfg.idleRipple.size <= 90, click: () => store.set("idleRipple.size", 80) },
        { label: "크게", type: "radio", checked: cfg.idleRipple.size > 90 && cfg.idleRipple.size <= 140, click: () => store.set("idleRipple.size", 120) },
        { label: "최대", type: "radio", checked: cfg.idleRipple.size > 140, click: () => store.set("idleRipple.size", 180) },
      ],
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);

  menu.popup({ window: characterWindow });
});

// ─── IPC 핸들러 ───────────────────────────────────────
ipcMain.handle("get-config", () => cfg);

ipcMain.handle("move-mouse", (_, { x, y }) => {
  // Electron은 마우스 이동을 직접 지원하지 않으므로
  // 렌더러에서 처리하거나 robotjs 등 외부 모듈 필요
  // 여기서는 비콘만 표시
});

// ─── 앱 라이프사이클 ──────────────────────────────────
app.whenReady().then(() => {
  checkAccessibilityPermission();

  try {
    createOverlayWindows();
    console.log(`[app] 오버레이 윈도우 ${overlayWindows.length}개 생성됨`);
  } catch (e) { console.error("[app] 오버레이 생성 실패:", e.message); }

  try {
    createCharacterWindow();
    console.log("[app] 캐릭터 윈도우 생성됨");
  } catch (e) { console.error("[app] 캐릭터 생성 실패:", e.message); }

  try {
    createTray();
    console.log("[app] 시스템 트레이 생성됨");
  } catch (e) { console.error("[app] 트레이 생성 실패:", e.message); }

  detectInitialInputLang();
  initMoveMouse();
  registerShortcuts();
  setupInputHooks();
  startIdleDetection();

  console.log("\nMouse Finder v2 실행 중!");
  console.log(`  마우스 찾기: ${cfg.findMouseHotkey}`);
  console.log(`  순간이동: ${cfg.teleportHotkey}`);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  uIOhook.stop();
});

// Windows/Linux에서 모든 창이 닫혀도 앱이 종료되지 않도록
app.on("window-all-closed", () => {
  // 트레이에서 계속 실행 — 아무것도 하지 않음
});
