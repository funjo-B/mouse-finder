const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const Store = require("electron-store");
const { uIOhook, UiohookKey } = require("uiohook-napi");

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
      count: 3,
      color: "#FF4444",
      fadeDuration: 1.0,
    },
    idleRipple: {
      enabled: true,
      idleSeconds: 3,
      color: "#4488FF",
      interval: 2.0,
    },
    character: {
      enabled: true,
      position: "bottom-right",
    },
  },
});

let overlayWindow = null;
let characterWindow = null;
let tray = null;

// 마우스 유휴 감지용
let lastMousePos = { x: 0, y: 0 };
let mouseIdleTime = 0;
let idleRippleInterval = null;
const POLL_INTERVAL_MS = 500;

// 타이핑 속도 감지용
let recentKeyTimes = [];
const SPEED_WINDOW_MS = 3000;

// ─── 오버레이 윈도우 ──────────────────────────────────
function createOverlayWindow() {
  const displays = screen.getAllDisplays();
  const bounds = getAggregatedBounds(displays);

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    type: process.platform === "darwin" ? "panel" : "toolbar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile("src/overlay/index.html");
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  characterWindow.setVisibleOnAllWorkspaces(true);
  characterWindow.loadFile("src/character/index.html");

  if (!store.get("character.enabled")) {
    characterWindow.hide();
  }
}

// ─── 시스템 트레이 ───────────────────────────────────
function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createEmpty();
  // 간단한 트레이 아이콘 (1x1 fallback — 실제 아이콘 파일이 있으면 교체)
  const trayIconPath = path.join(__dirname, "assets", "tray-icon.png");
  try {
    tray = new Tray(nativeImage.createFromPath(trayIconPath));
  } catch {
    // 아이콘 파일이 없으면 빈 이미지 사용
    const img = nativeImage.createEmpty();
    tray = new Tray(img);
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: "Mouse Finder v2", enabled: false },
    { type: "separator" },
    {
      label: "클릭 잔상",
      type: "checkbox",
      checked: store.get("clickTrail.enabled"),
      click: (item) => {
        store.set("clickTrail.enabled", item.checked);
      },
    },
    {
      label: "유휴 물결파동",
      type: "checkbox",
      checked: store.get("idleRipple.enabled"),
      click: (item) => {
        store.set("idleRipple.enabled", item.checked);
      },
    },
    {
      label: "타이핑 캐릭터",
      type: "checkbox",
      checked: store.get("character.enabled"),
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
  globalShortcut.register(store.get("findMouseHotkey"), () => {
    const pos = screen.getCursorScreenPoint();
    sendToOverlay("beacon", {
      x: pos.x,
      y: pos.y,
      ...store.get("beacon"),
    });
  });

  globalShortcut.register(store.get("teleportHotkey"), () => {
    const tp = store.get("teleportPosition");
    // Electron에는 마우스 이동 API가 없으므로 overlay에 위임
    sendToOverlay("teleport-beacon", {
      x: tp.x,
      y: tp.y,
      ...store.get("beacon"),
    });
  });
}

// ─── 입력 후킹 (uiohook) ─────────────────────────────
function setupInputHooks() {
  // 마우스 클릭 감지
  uIOhook.on("click", (e) => {
    if (!store.get("clickTrail.enabled")) return;
    sendToOverlay("click-trail", {
      x: e.x,
      y: e.y,
      ...store.get("clickTrail"),
    });
  });

  // 키보드 입력 감지
  uIOhook.on("keydown", (e) => {
    if (!store.get("character.enabled")) return;

    const key = keycodeToChar(e.keycode);
    if (!key) return;

    const now = Date.now();
    recentKeyTimes.push(now);
    // 최근 N초 내의 키 입력만 유지
    recentKeyTimes = recentKeyTimes.filter(
      (t) => now - t < SPEED_WINDOW_MS
    );

    const wpm = Math.round((recentKeyTimes.length / SPEED_WINDOW_MS) * 60000);

    sendToCharacter("key-typed", { key, wpm });
  });

  uIOhook.start();
}

// ─── 마우스 유휴 감지 ─────────────────────────────────
function startIdleDetection() {
  let rippleActive = false;

  setInterval(() => {
    if (!store.get("idleRipple.enabled")) {
      mouseIdleTime = 0;
      rippleActive = false;
      return;
    }

    const pos = screen.getCursorScreenPoint();
    const threshold = store.get("idleRipple.idleSeconds") * 1000;

    if (pos.x === lastMousePos.x && pos.y === lastMousePos.y) {
      mouseIdleTime += POLL_INTERVAL_MS;

      if (mouseIdleTime >= threshold && !rippleActive) {
        rippleActive = true;
        sendToOverlay("ripple-start", {
          x: pos.x,
          y: pos.y,
          color: store.get("idleRipple.color"),
          interval: store.get("idleRipple.interval"),
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
function getAggregatedBounds(displays) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function sendToOverlay(channel, data) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    // 오버레이 좌표를 윈도우 로컬 좌표로 변환
    const bounds = overlayWindow.getBounds();
    overlayWindow.webContents.send(channel, {
      ...data,
      _offsetX: bounds.x,
      _offsetY: bounds.y,
    });
  }
}

function sendToCharacter(channel, data) {
  if (characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.webContents.send(channel, data);
  }
}

/** uiohook keycode → 표시할 문자 변환 */
function keycodeToChar(keycode) {
  // 알파벳
  if (keycode >= UiohookKey.A && keycode <= UiohookKey.Z) {
    return String.fromCharCode(65 + (keycode - UiohookKey.A));
  }
  // 숫자 (메인)
  if (keycode >= UiohookKey[0] && keycode <= UiohookKey[9]) {
    return String(keycode - UiohookKey[0]);
  }
  // 특수 키
  const specialMap = {
    [UiohookKey.Space]: "⎵",
    [UiohookKey.Enter]: "↵",
    [UiohookKey.Backspace]: "←",
    [UiohookKey.Tab]: "⇥",
    [UiohookKey.Escape]: "ESC",
  };
  return specialMap[keycode] || null;
}

// ─── IPC 핸들러 ───────────────────────────────────────
ipcMain.handle("get-config", () => store.store);

ipcMain.handle("move-mouse", (_, { x, y }) => {
  // Electron은 마우스 이동을 직접 지원하지 않으므로
  // 렌더러에서 처리하거나 robotjs 등 외부 모듈 필요
  // 여기서는 비콘만 표시
});

// ─── 앱 라이프사이클 ──────────────────────────────────
app.whenReady().then(() => {
  createOverlayWindow();
  createCharacterWindow();
  createTray();
  registerShortcuts();
  setupInputHooks();
  startIdleDetection();

  console.log("Mouse Finder v2 실행 중!");
  console.log(`  마우스 찾기: ${store.get("findMouseHotkey")}`);
  console.log(`  순간이동: ${store.get("teleportHotkey")}`);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  uIOhook.stop();
});

app.on("window-all-closed", (e) => {
  // 트레이에서 계속 실행
  e.preventDefault?.();
});
