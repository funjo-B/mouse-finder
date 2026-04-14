/**
 * 트레이 아이콘 생성 스크립트 (빌드 시 1회 실행)
 * node assets/generate-icon.js
 */
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const size = 64;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext("2d");

// 배경 원
ctx.beginPath();
ctx.arc(32, 32, 28, 0, Math.PI * 2);
ctx.fillStyle = "#6EC6FF";
ctx.fill();
ctx.strokeStyle = "#3A9BD5";
ctx.lineWidth = 2;
ctx.stroke();

// 마우스 커서 모양
ctx.beginPath();
ctx.moveTo(22, 18);
ctx.lineTo(22, 46);
ctx.lineTo(30, 39);
ctx.lineTo(38, 50);
ctx.lineTo(42, 47);
ctx.lineTo(34, 36);
ctx.lineTo(42, 32);
ctx.closePath();
ctx.fillStyle = "white";
ctx.fill();
ctx.strokeStyle = "#333";
ctx.lineWidth = 1.5;
ctx.stroke();

const out = path.join(__dirname, "tray-icon.png");
const buf = canvas.toBuffer("image/png");
fs.writeFileSync(out, buf);
console.log("트레이 아이콘 생성:", out);
