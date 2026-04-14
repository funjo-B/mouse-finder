/**
 * 오버레이 렌더러 — 클릭 잔상, 비콘, 물결파동을 Canvas에 그린다.
 */
const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// ─── 이펙트 큐 ───────────────────────────────────────
const effects = [];

function addEffect(effect) {
  effects.push(effect);
}

function removeEffect(effect) {
  const idx = effects.indexOf(effect);
  if (idx !== -1) effects.splice(idx, 1);
}

// ─── 1) 클릭 잔상 (Click Trail) ──────────────────────
const clickTrails = [];
let maxTrails = 3;

window.api.onClickTrail((data) => {
  const x = data.x - data._offsetX;
  const y = data.y - data._offsetY;
  maxTrails = data.count || 3;

  const trail = {
    x,
    y,
    color: data.color || "#FF4444",
    fadeDuration: (data.fadeDuration || 1.0) * 1000,
    startTime: performance.now(),
  };

  clickTrails.push(trail);

  // 최대 개수 초과 시 가장 오래된 것 제거
  while (clickTrails.length > maxTrails) {
    clickTrails.shift();
  }

  addEffect(trail);
});

function drawClickTrail(trail, now) {
  const elapsed = now - trail.startTime;
  const progress = Math.min(elapsed / trail.fadeDuration, 1);

  if (progress >= 1) {
    removeEffect(trail);
    const idx = clickTrails.indexOf(trail);
    if (idx !== -1) clickTrails.splice(idx, 1);
    return;
  }

  const alpha = 1 - progress;
  const radius = 8 + progress * 20;

  // 바깥 링
  ctx.beginPath();
  ctx.arc(trail.x, trail.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(trail.color, alpha * 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();

  // 안쪽 원
  ctx.beginPath();
  ctx.arc(trail.x, trail.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(trail.color, alpha);
  ctx.fill();

  // 십자 표시
  const crossSize = 6;
  ctx.beginPath();
  ctx.moveTo(trail.x - crossSize, trail.y);
  ctx.lineTo(trail.x + crossSize, trail.y);
  ctx.moveTo(trail.x, trail.y - crossSize);
  ctx.lineTo(trail.x, trail.y + crossSize);
  ctx.strokeStyle = hexToRgba(trail.color, alpha * 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─── 2) 비콘 (Beacon) ────────────────────────────────
window.api.onBeacon((data) => spawnBeacon(data));
window.api.onTeleportBeacon((data) => spawnBeacon(data));

function spawnBeacon(data) {
  const x = data.x - data._offsetX;
  const y = data.y - data._offsetY;

  const beacon = {
    type: "beacon",
    x,
    y,
    color: data.color || "#FF4444",
    maxSize: data.size || 120,
    duration: (data.duration || 1.5) * 1000,
    startTime: performance.now(),
  };

  addEffect(beacon);
}

function drawBeacon(b, now) {
  const elapsed = now - b.startTime;
  const progress = Math.min(elapsed / b.duration, 1);

  if (progress >= 1) {
    removeEffect(b);
    return;
  }

  const alpha = 1 - progress;

  // 바깥 확장 링
  const outerR = b.maxSize * progress;
  ctx.beginPath();
  ctx.arc(b.x, b.y, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(b.color, alpha * 0.6);
  ctx.lineWidth = 3;
  ctx.stroke();

  // 중간 링
  const midR = b.maxSize * 0.5 * progress;
  ctx.beginPath();
  ctx.arc(b.x, b.y, midR, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(b.color, alpha * 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();

  // 펄스 내부 원
  const pulsePhase = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5;
  const innerR = 15 + pulsePhase * 10;
  ctx.beginPath();
  ctx.arc(b.x, b.y, innerR, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(b.color, alpha * 0.3);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(b.color, alpha);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 중앙 점
  ctx.beginPath();
  ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(b.color, alpha);
  ctx.fill();
}

// ─── 3) 물결 파동 (Idle Ripple) ──────────────────────
let activeRipple = null;

window.api.onRippleStart((data) => {
  const x = data.x - data._offsetX;
  const y = data.y - data._offsetY;

  activeRipple = {
    type: "ripple",
    x,
    y,
    color: data.color || "#4488FF",
    interval: (data.interval || 2.0) * 1000,
    startTime: performance.now(),
    waves: [],
  };

  addEffect(activeRipple);
});

window.api.onRippleStop(() => {
  if (activeRipple) {
    removeEffect(activeRipple);
    activeRipple = null;
  }
});

function drawRipple(ripple, now) {
  const elapsed = now - ripple.startTime;

  // 주기적으로 새 파동 생성
  const waveIdx = Math.floor(elapsed / ripple.interval);
  while (ripple.waves.length <= waveIdx && ripple.waves.length < 20) {
    ripple.waves.push({
      birth: ripple.startTime + ripple.waves.length * ripple.interval,
    });
  }

  const maxRadius = 80;
  const waveDuration = ripple.interval * 1.5;

  for (const wave of ripple.waves) {
    const waveElapsed = now - wave.birth;
    if (waveElapsed < 0 || waveElapsed > waveDuration) continue;

    const p = waveElapsed / waveDuration;
    const radius = maxRadius * p;
    const alpha = (1 - p) * 0.6;

    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(ripple.color, alpha);
    ctx.lineWidth = 2 - p;
    ctx.stroke();
  }

  // 중앙 물방울
  const breathe = Math.sin(elapsed * 0.003) * 0.3 + 0.7;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, 5 * breathe, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(ripple.color, 0.5);
  ctx.fill();
}

// ─── 렌더 루프 ────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = performance.now();

  for (const fx of [...effects]) {
    if (fx.type === "beacon") {
      drawBeacon(fx, now);
    } else if (fx.type === "ripple") {
      drawRipple(fx, now);
    } else {
      drawClickTrail(fx, now);
    }
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// ─── 유틸리티 ─────────────────────────────────────────
function hexToRgba(hex, alpha) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
