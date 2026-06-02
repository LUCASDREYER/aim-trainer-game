const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const scoreEl = document.getElementById('score-val');
const accEl = document.getElementById('acc-val');
const streakEl = document.getElementById('streak-val');
const reactEl = document.getElementById('react-val');
const timerEl = document.getElementById('timer-val');
const comboFlash = document.getElementById('combo-flash');
const missFlash = document.getElementById('miss-flash');
const resultsArea = document.getElementById('results-area');

let W, H, mx = -999, my = -999;
let targets = [], score = 0, shots = 0, hits = 0, streak = 0, bestStreak = 0;
let reactionTimes = [], gameActive = false, timeLeft = 30;
let timerInterval = null, difficulty = 'medium';
let flashTO = null, spawnTO = null;

const SETTINGS = {
  easy:   { minR: 38, maxR: 55, lifeMin: 2200, lifeMax: 3200, maxTargets: 3, spawnInterval: 900 },
  medium: { minR: 25, maxR: 40, lifeMin: 1600, lifeMax: 2400, maxTargets: 4, spawnInterval: 700 },
  hard:   { minR: 16, maxR: 28, lifeMin: 900,  lifeMax: 1600, maxTargets: 5, spawnInterval: 500 },
};

// ── Resize ────────────────────────────────────────────────────────────────────

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ── Difficulty buttons ────────────────────────────────────────────────────────

document.getElementById('difficulty').querySelectorAll('.diff-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    difficulty = b.dataset.d;
  });
});

document.getElementById('start-btn').addEventListener('click', startGame);

// ── Game lifecycle ────────────────────────────────────────────────────────────

function startGame() {
  overlay.style.display = 'none';
  targets = []; score = 0; shots = 0; hits = 0; streak = 0; bestStreak = 0;
  reactionTimes = []; timeLeft = 30; gameActive = true;
  updateHUD();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
  spawnLoop();
  requestAnimationFrame(loop);
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  clearTimeout(spawnTO);
  targets = [];

  const acc = shots > 0 ? Math.round((hits / shots) * 100) : 0;
  const avgRt = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  document.getElementById('overlay-sub').textContent = 'Round complete!';
  resultsArea.innerHTML = `
    <div class="results-grid">
      <div class="big-stat"><span>SCORE</span><strong>${score}</strong></div>
      <div class="big-stat"><span>ACCURACY</span><strong>${acc}%</strong></div>
      <div class="big-stat"><span>AVG REACT</span><strong>${avgRt}ms</strong></div>
      <div class="big-stat"><span>BEST STREAK</span><strong>${bestStreak}</strong></div>
    </div>`;
  document.getElementById('start-btn').textContent = 'Play Again';
  overlay.style.display = 'flex';
}

// ── Spawning ──────────────────────────────────────────────────────────────────

function spawnLoop() {
  if (!gameActive) return;
  const s = SETTINGS[difficulty];
  if (targets.length < s.maxTargets) spawnTarget();
  spawnTO = setTimeout(spawnLoop, s.spawnInterval + Math.random() * 300);
}

function spawnTarget() {
  const s = SETTINGS[difficulty];
  const r = s.minR + Math.random() * (s.maxR - s.minR);
  const pad = 60;
  const x = pad + r + Math.random() * (W - 2 * r - 2 * pad);
  const y = 60 + r + Math.random() * (H - 60 - 2 * r - pad);
  const life = s.lifeMin + Math.random() * (s.lifeMax - s.lifeMin);
  targets.push({ x, y, r, born: performance.now(), life, alpha: 0 });
}

// ── Input ─────────────────────────────────────────────────────────────────────

canvas.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

canvas.addEventListener('click', e => {
  if (!gameActive) return;
  shots++;
  const px = e.clientX, py = e.clientY;
  let hit = false;

  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (Math.hypot(px - t.x, py - t.y) <= t.r) {
      const rt = performance.now() - t.born;
      reactionTimes.push(rt);
      targets.splice(i, 1);
      hits++;
      score += calcScore(rt, t.r);
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      if (streak > 1) showCombo(streak);
      hit = true;
      break;
    }
  }

  if (!hit) { streak = 0; showMiss(); }
  updateHUD();
});

// ── Scoring ───────────────────────────────────────────────────────────────────

function calcScore(rt, r) {
  const base = Math.max(10, Math.round(1000 / (rt / 500)));
  const sizeBonus = difficulty === 'hard' ? 2 : difficulty === 'medium' ? 1.5 : 1;
  return Math.round(base * sizeBonus);
}

// ── HUD & feedback ────────────────────────────────────────────────────────────

function updateHUD() {
  scoreEl.textContent = score;
  accEl.textContent = shots > 0 ? Math.round((hits / shots) * 100) + '%' : '—';
  streakEl.textContent = streak;
  reactEl.textContent = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) + 'ms'
    : '—';
}

function showCombo(n) {
  comboFlash.textContent = n + 'x STREAK!';
  comboFlash.style.opacity = '1';
  clearTimeout(flashTO);
  flashTO = setTimeout(() => { comboFlash.style.opacity = '0'; }, 800);
}

function showMiss() {
  missFlash.style.opacity = '1';
  setTimeout(() => { missFlash.style.opacity = '0'; }, 150);
}

// ── Render loop ───────────────────────────────────────────────────────────────

function loop(now) {
  ctx.clearRect(0, 0, W, H);
  drawGrid();

  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const age = now - t.born;

    if (age < 120) t.alpha = age / 120;
    else if (age > t.life - 200) t.alpha = Math.max(0, (t.life - age) / 200);
    else t.alpha = 1;

    if (age >= t.life) { targets.splice(i, 1); continue; }
    drawTarget(t, age / t.life);
  }

  drawCrosshair(mx, my);
  if (gameActive) requestAnimationFrame(loop);
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  const step = 60;
  for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 60; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function drawTarget(t, pct) {
  const { x, y, r, alpha } = t;
  const pulse = 1 + 0.04 * Math.sin(performance.now() / 150);
  const pr = r * pulse;

  // Shrink ring
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r * (1 - pct * 0.5), 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // Glow
  ctx.save();
  ctx.globalAlpha = alpha * 0.18;
  const g = ctx.createRadialGradient(x, y, 0, x, y, pr * 1.5);
  g.addColorStop(0, '#f87171'); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, pr * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Body
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1a1a1f';
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Inner rings
  ctx.strokeStyle = 'rgba(248,113,113,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, pr * 0.6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, pr * 0.25, 0, Math.PI * 2); ctx.stroke();

  // Center dot
  ctx.fillStyle = '#f87171';
  ctx.beginPath(); ctx.arc(x, y, pr * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Timer arc
  ctx.save();
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = pct < 0.6 ? '#4ade80' : pct < 0.85 ? '#fbbf24' : '#f87171';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, pr + 8, -Math.PI / 2, -Math.PI / 2 + (1 - pct) * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCrosshair(x, y) {
  if (x < 0) return;
  const gap = 5, len = 12;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - gap - len, y); ctx.lineTo(x - gap, y);
  ctx.moveTo(x + gap, y);       ctx.lineTo(x + gap + len, y);
  ctx.moveTo(x, y - gap - len); ctx.lineTo(x, y - gap);
  ctx.moveTo(x, y + gap);       ctx.lineTo(x, y + gap + len);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, gap, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

requestAnimationFrame(loop);
