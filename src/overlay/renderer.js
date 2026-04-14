/**
 * 오버레이 렌더러 — 클릭 잔상/크랙, 비콘, 물결/크랙을 Canvas에 그린다.
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

// ─── 1) 클릭 이펙트 (Trail / Crack) ─────────────────
const clickTrails = [];
let maxTrails = 3;

window.api.onClickTrail((data) => {
  const x = data.x - data._offsetX;
  const y = data.y - data._offsetY;
  maxTrails = data.count || 3;
  const effectType = data.effectType || "trail";

  if (effectType === "crack") {
    const crack = createCrack(x, y, data.crackSize || 80, 1.2);
    addEffect(crack);
  } else {
    const trail = {
      type: "trail",
      x, y,
      color: data.color || "#FF4444",
      fadeDuration: (data.fadeDuration || 1.0) * 1000,
      startTime: performance.now(),
    };
    clickTrails.push(trail);
    while (clickTrails.length > maxTrails) clickTrails.shift();
    addEffect(trail);
  }
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

  ctx.beginPath();
  ctx.arc(trail.x, trail.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(trail.color, alpha * 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(trail.x, trail.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(trail.color, alpha);
  ctx.fill();

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

  addEffect({
    type: "beacon",
    x, y,
    color: data.color || "#FF4444",
    maxSize: data.size || 120,
    duration: (data.duration || 1.5) * 1000,
    startTime: performance.now(),
  });
}

function drawBeacon(b, now) {
  const elapsed = now - b.startTime;
  const progress = Math.min(elapsed / b.duration, 1);

  if (progress >= 1) { removeEffect(b); return; }

  const alpha = 1 - progress;

  const outerR = b.maxSize * progress;
  ctx.beginPath();
  ctx.arc(b.x, b.y, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(b.color, alpha * 0.6);
  ctx.lineWidth = 3;
  ctx.stroke();

  const midR = b.maxSize * 0.5 * progress;
  ctx.beginPath();
  ctx.arc(b.x, b.y, midR, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(b.color, alpha * 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();

  const pulsePhase = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5;
  const innerR = 15 + pulsePhase * 10;
  ctx.beginPath();
  ctx.arc(b.x, b.y, innerR, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(b.color, alpha * 0.3);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(b.color, alpha);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(b.color, alpha);
  ctx.fill();
}

// ─── 3) 물결 / 유휴 크랙 ────────────────────────────
let activeRipple = null;

window.api.onRippleStart((data) => {
  const x = data.x - data._offsetX;
  const y = data.y - data._offsetY;
  const effectType = data.effectType || "ripple";

  if (effectType === "crack") {
    // 유휴 크랙: 한 번 생성
    const crack = createCrack(x, y, data.size || 80, 2.5);
    activeRipple = crack;
    addEffect(crack);
  } else {
    activeRipple = {
      type: "ripple",
      x, y,
      color: data.color || "#4488FF",
      maxRadius: data.size || 80,
      interval: (data.interval || 2.0) * 1000,
      startTime: performance.now(),
      waves: [],
    };
    addEffect(activeRipple);
  }
});

window.api.onRippleStop(() => {
  if (activeRipple) {
    removeEffect(activeRipple);
    activeRipple = null;
  }
});

function drawRipple(ripple, now) {
  const elapsed = now - ripple.startTime;

  const waveIdx = Math.floor(elapsed / ripple.interval);
  while (ripple.waves.length <= waveIdx && ripple.waves.length < 20) {
    ripple.waves.push({
      birth: ripple.startTime + ripple.waves.length * ripple.interval,
    });
  }

  const waveDuration = ripple.interval * 1.5;

  for (const wave of ripple.waves) {
    const waveElapsed = now - wave.birth;
    if (waveElapsed < 0 || waveElapsed > waveDuration) continue;

    const p = waveElapsed / waveDuration;
    const radius = ripple.maxRadius * p;
    const alpha = (1 - p) * 0.6;

    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(ripple.color, alpha);
    ctx.lineWidth = 2 - p;
    ctx.stroke();
  }

  const breathe = Math.sin(elapsed * 0.003) * 0.3 + 0.7;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, 5 * breathe, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(ripple.color, 0.5);
  ctx.fill();
}

// ─── 4) 화면 깨짐 크랙 이펙트 ───────────────────────
function createCrack(x, y, size, duration) {
  // 사전에 크랙 경로를 생성 (매 프레임 재계산 방지)
  const mainCracks = [];
  const numCracks = 5 + Math.floor(Math.random() * 4); // 5~8개 주요 균열

  for (let i = 0; i < numCracks; i++) {
    const angle = (Math.PI * 2 / numCracks) * i + (Math.random() - 0.5) * 0.8;
    const length = size * (0.6 + Math.random() * 0.5);
    const segments = [];
    let cx = 0, cy = 0;
    let curAngle = angle;
    const numSegs = 4 + Math.floor(Math.random() * 4);

    for (let s = 0; s < numSegs; s++) {
      const segLen = length / numSegs * (0.7 + Math.random() * 0.6);
      curAngle += (Math.random() - 0.5) * 0.6;
      cx += Math.cos(curAngle) * segLen;
      cy += Math.sin(curAngle) * segLen;
      segments.push({ x: cx, y: cy });

      // 30% 확률로 분기 크랙
      if (Math.random() < 0.35) {
        const branchAngle = curAngle + (Math.random() - 0.5) * 1.5;
        const branchLen = segLen * (0.3 + Math.random() * 0.5);
        segments.push({
          x: cx + Math.cos(branchAngle) * branchLen,
          y: cy + Math.sin(branchAngle) * branchLen,
          branch: true,
        });
        // 분기 끝에서 다시 본줄기로 복귀
        segments.push({ x: cx, y: cy, moveTo: true });
      }
    }
    mainCracks.push(segments);
  }

  return {
    type: "crack",
    x, y,
    size,
    mainCracks,
    duration: duration * 1000,
    startTime: performance.now(),
  };
}

function drawCrack(crack, now) {
  const elapsed = now - crack.startTime;
  const progress = Math.min(elapsed / crack.duration, 1);

  if (progress >= 1) {
    removeEffect(crack);
    if (activeRipple === crack) activeRipple = null;
    return;
  }

  // 등장 (0~0.3): 크랙이 뻗어나감, 유지 (0.3~0.7), 페이드 (0.7~1)
  const growPhase = Math.min(progress / 0.3, 1);
  const fadePhase = progress > 0.7 ? (progress - 0.7) / 0.3 : 0;
  const alpha = 1 - fadePhase;

  // 중심 충돌점 — 밝은 원
  if (alpha > 0) {
    const impactR = 3 + (1 - growPhase) * 8;
    ctx.beginPath();
    ctx.arc(crack.x, crack.y, impactR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
    ctx.fill();
  }

  // 크랙 라인들
  for (const segs of crack.mainCracks) {
    ctx.beginPath();
    ctx.moveTo(crack.x, crack.y);

    const visibleSegs = Math.ceil(segs.length * growPhase);

    for (let i = 0; i < visibleSegs; i++) {
      const seg = segs[i];
      if (seg.moveTo) {
        ctx.moveTo(crack.x + seg.x, crack.y + seg.y);
      } else {
        ctx.lineTo(crack.x + seg.x, crack.y + seg.y);
      }
    }

    // 주 균열: 밝은 흰색
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.95})`;
    ctx.lineWidth = seg => seg?.branch ? 1 : 2;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 글로우 효과
    ctx.strokeStyle = `rgba(200,220,255,${alpha * 0.3})`;
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  // 분기 크랙 (가는 선으로 다시)
  for (const segs of crack.mainCracks) {
    const visibleSegs = Math.ceil(segs.length * growPhase);
    for (let i = 0; i < visibleSegs; i++) {
      const seg = segs[i];
      if (seg.branch && i > 0) {
        const prev = segs[i - 1];
        ctx.beginPath();
        ctx.moveTo(crack.x + prev.x, crack.y + prev.y);
        ctx.lineTo(crack.x + seg.x, crack.y + seg.y);
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // 파편 점들
  if (growPhase > 0.5) {
    for (const segs of crack.mainCracks) {
      const last = segs[Math.min(Math.ceil(segs.length * growPhase) - 1, segs.length - 1)];
      if (!last || last.moveTo) continue;
      ctx.beginPath();
      ctx.arc(crack.x + last.x, crack.y + last.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
      ctx.fill();
    }
  }
}

// ─── 렌더 루프 ────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = performance.now();

  for (const fx of [...effects]) {
    if (fx.type === "beacon") drawBeacon(fx, now);
    else if (fx.type === "ripple") drawRipple(fx, now);
    else if (fx.type === "crack") drawCrack(fx, now);
    else if (fx.type === "trail") drawClickTrail(fx, now);
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
