/**
 * 타이핑 캐릭터 렌더러
 * - 키 입력 시 말풍선에 글자 표시
 * - 타이핑 속도(WPM)에 따라 캐릭터 표정 + 말풍선 스타일 변경
 */

// 우클릭 → 설정 메뉴
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.api.showCharacterMenu();
});

const bubble = document.getElementById("bubble");
const bubbleText = document.getElementById("bubble-text");
const charImg = document.getElementById("char-img");
const charEl = document.getElementById("character");

const ASSETS_BASE = "../../assets/characters/default/";

// 표정 상태 정의
const EXPRESSIONS = {
  idle:       { img: "idle.svg",        speedClass: "" },
  sleepy:     { img: "sleepy.svg",      speedClass: "" },
  talkSlow:   { img: "talk-slow.svg",   speedClass: "speed-slow" },
  talkNormal: { img: "talk-normal.svg", speedClass: "speed-normal" },
  talkFast:   { img: "talk-fast.svg",   speedClass: "speed-fast" },
  talkBlazing:{ img: "talk-fast.svg",   speedClass: "speed-blazing" },
};

let currentExpression = "idle";
let hideTimeout = null;
let sleepTimeout = null;
const BUBBLE_HIDE_MS = 800;
const SLEEP_MS = 8000;

// 초기 상태
setExpression("idle");
scheduleSleep();

// ─── 키 입력 처리 ─────────────────────────────────────
window.api.onKeyTyped(({ key, wpm }) => {
  // 말풍선 표시
  showBubble(key, wpm);

  // 표정 결정
  const expr = getExpressionForWpm(wpm);
  setExpression(expr);

  // 바운스 효과
  charEl.classList.remove("bounce", "excited");
  void charEl.offsetWidth; // reflow 트리거
  if (wpm > 200) {
    charEl.classList.add("excited");
  } else {
    charEl.classList.add("bounce");
  }

  // 타이머 리셋
  clearTimeout(hideTimeout);
  clearTimeout(sleepTimeout);

  hideTimeout = setTimeout(() => {
    hideBubble();
    setExpression("idle");
    charEl.classList.remove("bounce", "excited");
    scheduleSleep();
  }, BUBBLE_HIDE_MS);
});

// ─── 말풍선 ───────────────────────────────────────────
function showBubble(key, wpm) {
  bubbleText.textContent = `${key}!`;

  // 속도 클래스 갱신
  bubble.className = "show";
  const expr = getExpressionForWpm(wpm);
  const speedClass = EXPRESSIONS[expr]?.speedClass;
  if (speedClass) {
    bubble.classList.add(speedClass);
  }
}

function hideBubble() {
  bubble.className = "hidden";
}

// ─── 표정 ─────────────────────────────────────────────
function setExpression(name) {
  if (name === currentExpression) return;
  currentExpression = name;
  const expr = EXPRESSIONS[name];
  if (expr) {
    charImg.src = ASSETS_BASE + expr.img;
  }
}

function getExpressionForWpm(wpm) {
  if (wpm > 200) return "talkBlazing";
  if (wpm > 120) return "talkFast";
  if (wpm > 50)  return "talkNormal";
  return "talkSlow";
}

// ─── 수면 모드 ────────────────────────────────────────
function scheduleSleep() {
  clearTimeout(sleepTimeout);
  sleepTimeout = setTimeout(() => {
    setExpression("sleepy");
  }, SLEEP_MS);
}
