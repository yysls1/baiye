const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const nameInput = document.getElementById("nameInput");
const roundInput = document.getElementById("roundInput");
const list = document.getElementById("list");
const spinBtn = document.getElementById("spinBtn");

let players = [];
let rotation = 0;
let isSpinning = false;
let selectedIndex = null;

/* 🌈 彩虹色 */
const RAINBOW_COLORS = [
  "#ff595e",
  "#ff924c",
  "#ffca3a",
  "#8ac926",
  "#1982c4",
  "#6a4c93",
  "#d45087"
];

function getColor(index) {
  return RAINBOW_COLORS[index % RAINBOW_COLORS.length];
}

/* ➕ 加入轮盘 */
function addPlayer() {
  const name = nameInput.value.trim();
  const weight = parseInt(roundInput.value);

  if (!name || !weight || weight <= 0) {
    alert("名字或权重不对");
    return;
  }

  players.push({ name, weight });
  nameInput.value = "";

  renderList();
  drawWheel();
}

/* 📋 显示列表 */
function renderList() {
  list.innerHTML = players
    .map(p => `${p.name}（权重 ${p.weight}）`)
    .join("<br>");
}

/* 🎡 画轮盘 */
function drawWheel(highlightIndex = null) {
  if (players.length === 0) return;

  const total = players.reduce((s, p) => s + p.weight, 0);
  let start = 0;

  ctx.clearRect(0, 0, 300, 300);

  players.forEach((p, i) => {
    const angle = (p.weight / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 150, start, start + angle);

    ctx.fillStyle = getColor(i);

    // ⭐ 抽中高亮
    if (i === highlightIndex) {
      ctx.globalAlpha = 1;
    } else if (highlightIndex !== null) {
      ctx.globalAlpha = 0.35;
    }

    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // 文字
    ctx.save();
    ctx.translate(150, 150);
    ctx.rotate(start + angle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#222";
    ctx.font = "14px Arial";
    ctx.fillText(p.name, 140, 5);
    ctx.restore();

    start += angle;
  });
}

/* 🎰 抽奖 */
function spin() {
  if (isSpinning || players.length === 0) return;

  isSpinning = true;
  spinBtn.disabled = true;
  selectedIndex = null;

  const total = players.reduce((s, p) => s + p.weight, 0);
  const rand = Math.random() * total;

  /* 1️⃣ 抽中谁 */
  let acc = 0;
  let winnerIndex = 0;
  for (let i = 0; i < players.length; i++) {
    acc += players[i].weight;
    if (rand <= acc) {
      winnerIndex = i;
      break;
    }
  }

  selectedIndex = winnerIndex;

  /* 2️⃣ 算角度 */
  let startAngle = 0;
  for (let i = 0; i < winnerIndex; i++) {
    startAngle += (players[i].weight / total) * 360;
  }

  const sliceAngle = (players[winnerIndex].weight / total) * 360;
  const sliceCenter = startAngle + sliceAngle / 2;

  /* 3️⃣ 指针在正上 */
  const pointerOffset = -90;
  const extraSpins = 5 * 360;

  rotation += extraSpins - sliceCenter + pointerOffset;

  canvas.style.transition =
    "transform 4s cubic-bezier(.17,.67,.28,1)";
  canvas.style.transform = `rotate(${rotation}deg)`;

  setTimeout(() => {
    drawWheel(winnerIndex);
    alert(`🎉 抽中了：${players[winnerIndex].name}`);
    isSpinning = false; // ❗但还不能立刻再抽
  }, 4200);
}

/* 🔄 重置轮盘（重点） */
function resetWheel() {
  if (isSpinning) return;

  rotation = 0;
  selectedIndex = null;

  canvas.style.transition = "none";
  canvas.style.transform = "rotate(0deg)";

  drawWheel();

  // ✅ 关键：允许再次抽奖
  spinBtn.disabled = false;
}
