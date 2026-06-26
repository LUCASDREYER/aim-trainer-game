/* ============================================================================
 * FPS Aim Trainer
 * A first-person, pointer-locked aim trainer built on Three.js.
 *
 * Unlike a flat "click the circle" trainer, the mouse drives a first-person
 * camera (yaw/pitch). The crosshair is fixed at screen center, and every shot
 * is a ray cast from the camera through that center into a 3D room. This is
 * the same input model as real FPS games (CS, Valorant, Apex, Aim Lab…).
 * ========================================================================== */

const canvas    = document.getElementById('canvas');
const overlay   = document.getElementById('overlay');
const scoreEl    = document.getElementById('score-val');
const accEl      = document.getElementById('acc-val');
const streakEl   = document.getElementById('streak-val');
const reactEl    = document.getElementById('react-val');
const timerEl    = document.getElementById('timer-val');
const comboFlash = document.getElementById('combo-flash');
const hitmarker  = document.getElementById('hitmarker');
const missFlash  = document.getElementById('miss-flash');
const resultsArea = document.getElementById('results-area');
const pauseHint  = document.getElementById('pause-hint');

// ── Game state ──────────────────────────────────────────────────────────────
let score = 0, shots = 0, hits = 0, streak = 0, bestStreak = 0;
let reactionTimes = [], gameActive = false, timeLeft = 30;
let timerInterval = null, spawnTO = null, flashTO = null, hitTO = null;
let difficulty = 'medium', scenario = 'grid';
let sensitivity = 1;

// Tunables per scenario. `count` = how many targets live at once.
const DIFF = {
  easy:   { radius: 0.55, life: 2600, count: 3, trackSpeed: 1.4 },
  medium: { radius: 0.40, life: 1900, count: 4, trackSpeed: 2.4 },
  hard:   { radius: 0.28, life: 1300, count: 6, trackSpeed: 3.6 },
};

// ── Three.js scene setup ────────────────────────────────────────────────────
const ROOM = { w: 24, h: 12, d: 30 };   // room dimensions (x, y, z)
const WALL_Z = -ROOM.d / 2;             // far wall where targets spawn

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d12);
scene.fog = new THREE.Fog(0x0d0d12, 18, 42);

const camera = new THREE.PerspectiveCamera(
  90, window.innerWidth / window.innerHeight, 0.1, 100
);
// Player stands near the back of the room, eye height ~1.6m, looking at far wall.
camera.position.set(0, 0, ROOM.d / 2 - 2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Lighting — bright + even so every surface of the enclosed stage is visible.
scene.add(new THREE.HemisphereLight(0x99aaff, 0x2a2030, 0.9));
scene.add(new THREE.AmbientLight(0x404a66, 0.6));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
keyLight.position.set(6, 12, 10);
scene.add(keyLight);
const ceilLight = new THREE.PointLight(0xaab4ff, 0.8, 60);
ceilLight.position.set(0, ROOM.h / 2 - 1, 0);
scene.add(ceilLight);
const frontLight = new THREE.PointLight(0x88aaff, 0.6, 50);
frontLight.position.set(0, 2, WALL_Z + 6);
scene.add(frontLight);

// ── Build the full enclosed stage ───────────────────────────────────────────
// Six explicitly-lit, inward-facing surfaces (floor, ceiling, 4 walls) so the
// whole room is visible from any angle — not a single box that goes dark on the
// faces pointing away from the lights.
function buildRoom() {
  const grid = makeGridTexture();

  // (geometry, color, position, rotation-euler) for each surface. Each plane's
  // default normal is +Z; we rotate so it faces into the room.
  const surfaces = [
    // Floor — face up
    { w: ROOM.w, h: ROOM.d, col: 0x20242f, pos: [0, -ROOM.h / 2, 0],          rot: [-Math.PI / 2, 0, 0] },
    // Ceiling — face down
    { w: ROOM.w, h: ROOM.d, col: 0x161922, pos: [0, ROOM.h / 2, 0],           rot: [ Math.PI / 2, 0, 0] },
    // Far wall (target wall) — slightly brighter so targets pop
    { w: ROOM.w, h: ROOM.h, col: 0x363b4d, pos: [0, 0, WALL_Z],               rot: [0, 0, 0] },
    // Near wall (behind player) — face -Z
    { w: ROOM.w, h: ROOM.h, col: 0x262a36, pos: [0, 0, ROOM.d / 2],           rot: [0, Math.PI, 0] },
    // Left wall — face +X
    { w: ROOM.d, h: ROOM.h, col: 0x2a2e3a, pos: [-ROOM.w / 2, 0, 0],          rot: [0, Math.PI / 2, 0] },
    // Right wall — face -X
    { w: ROOM.d, h: ROOM.h, col: 0x2a2e3a, pos: [ROOM.w / 2, 0, 0],           rot: [0, -Math.PI / 2, 0] },
  ];

  for (const s of surfaces) {
    const tex = grid.clone();
    tex.needsUpdate = true;
    tex.repeat.set(s.w / 4, s.h / 4);   // keep grid cells roughly square
    const mat = new THREE.MeshStandardMaterial({
      map: tex, color: s.col, roughness: 0.95, metalness: 0.0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    mesh.position.set(...s.pos);
    mesh.rotation.set(...s.rot);
    scene.add(mesh);
  }
}

function makeGridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#222633';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,140,200,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  return tex;
}
buildRoom();

// ── First-person weapon viewmodel ───────────────────────────────────────────
// A simple low-poly gun built from a few boxes, parented to the camera so it
// stays pinned to the bottom-right of the view like a real FPS viewmodel.
// The camera must be in the scene graph for its children to render.
scene.add(camera);

let weapon, weaponRest = new THREE.Vector3(0.34, -0.30, -0.75);
let recoil = 0;   // 0..1 kick amount, decays each frame

function buildWeapon() {
  weapon = new THREE.Group();

  const matBody  = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.5, metalness: 0.7 });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0x6d4aff, roughness: 0.4, metalness: 0.6, emissive: 0x2a1a66, emissiveIntensity: 0.6 });
  const matDark  = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.6, metalness: 0.5 });

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    weapon.add(m);
    return m;
  };

  // Receiver / body
  box(0.18, 0.16, 0.5, matBody, 0, 0, 0);
  // Barrel
  box(0.07, 0.07, 0.55, matDark, 0, 0.02, -0.42);
  // Muzzle tip
  box(0.09, 0.09, 0.06, matAccent, 0, 0.02, -0.72);
  // Top rail / sight
  box(0.05, 0.05, 0.30, matDark, 0, 0.11, -0.05);
  box(0.03, 0.06, 0.03, matDark, 0, 0.16, 0.08);   // rear sight post
  // Grip (angled down/back)
  const grip = box(0.10, 0.26, 0.12, matBody, 0, -0.18, 0.16);
  grip.rotation.x = 0.35;
  // Magazine
  box(0.08, 0.22, 0.10, matDark, 0, -0.20, -0.02);
  // Accent strip along the body
  box(0.19, 0.03, 0.30, matAccent, 0, 0.07, -0.02);

  weapon.position.copy(weaponRest);
  weapon.rotation.y = -0.06;   // toe-in slightly toward center
  camera.add(weapon);
}
buildWeapon();

// Per-frame weapon motion: recoil kick on fire + a subtle idle bob.
function updateWeapon(now) {
  if (!weapon) return;
  recoil = Math.max(0, recoil - 0.08);          // decay the kick
  const kick = recoil * recoil;                  // ease-out feel
  const bob = gameActive ? Math.sin(now / 380) * 0.004 : 0;
  weapon.position.set(
    weaponRest.x,
    weaponRest.y + bob + kick * 0.05,            // ride up
    weaponRest.z + kick * 0.12                   // push back toward camera
  );
  weapon.rotation.x = kick * 0.25;               // muzzle climb
  weapon.rotation.y = -0.06;
}

// ── Targets ─────────────────────────────────────────────────────────────────
// Each target is a glowing sphere. We keep them in an array and raycast against
// their meshes when the player shoots.
const targets = [];
const targetGeo = new THREE.SphereGeometry(1, 24, 24);

function spawnTarget() {
  const d = DIFF[difficulty];
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff5a5a, emissive: 0xff2a2a, emissiveIntensity: 0.6,
    roughness: 0.35, metalness: 0.1,
  });
  const mesh = new THREE.Mesh(targetGeo, mat);
  mesh.scale.setScalar(d.radius);

  // Spawn somewhere on the far-wall plane, with margin so they stay visible.
  const mx = ROOM.w / 2 - 1.5, my = ROOM.h / 2 - 1.5;
  const x = (Math.random() * 2 - 1) * mx;
  const y = (Math.random() * 2 - 1) * my;
  const z = WALL_Z + 0.8 + Math.random() * 1.2;   // slight depth variation
  mesh.position.set(x, y, z);

  // For tracking mode, give the target a velocity so it drifts across the wall.
  const ang = Math.random() * Math.PI * 2;
  const vel = new THREE.Vector3(Math.cos(ang), Math.sin(ang) * 0.6, 0)
    .multiplyScalar(d.trackSpeed);

  const t = { mesh, born: performance.now(), life: d.life, vel, radius: d.radius };
  mesh.userData.ref = t;
  targets.push(t);
  scene.add(mesh);
  return t;
}

function removeTarget(t, fade) {
  const i = targets.indexOf(t);
  if (i !== -1) targets.splice(i, 1);
  scene.remove(t.mesh);
  t.mesh.material.dispose();
}

function clearTargets() {
  while (targets.length) removeTarget(targets[0]);
}

// ── Pointer-lock first-person look ──────────────────────────────────────────
// We track yaw (left/right) and pitch (up/down) and rebuild the camera each
// frame. Pitch is clamped so you can't flip upside down — same as real FPS.
let yaw = 0, pitch = 0;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

function onMouseMove(e) {
  if (!isLocked()) return;
  // 0.0022 ≈ a sane base radians-per-pixel; sensitivity scales it.
  const k = 0.0022 * sensitivity;
  yaw   -= e.movementX * k;
  pitch -= e.movementY * k;
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
}

function applyCameraRotation() {
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function isLocked() {
  return document.pointerLockElement === canvas;
}

document.addEventListener('mousemove', onMouseMove);

document.addEventListener('pointerlockchange', () => {
  if (gameActive) {
    pauseHint.style.opacity = isLocked() ? '0' : '1';
  }
});

// ── Shooting (raycast from screen center) ───────────────────────────────────
const raycaster = new THREE.Raycaster();
const CENTER = new THREE.Vector2(0, 0);   // crosshair is always dead center

function shoot() {
  if (!gameActive || !isLocked()) return;
  shots++;
  recoil = 1;   // kick the viewmodel; decays in the render loop
  raycaster.setFromCamera(CENTER, camera);
  const meshes = targets.map(t => t.mesh);
  const hitList = raycaster.intersectObjects(meshes, false);

  if (hitList.length > 0) {
    const t = hitList[0].object.userData.ref;
    const rt = performance.now() - t.born;
    reactionTimes.push(rt);
    hits++;
    score += calcScore(rt);
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    if (streak > 1) showCombo(streak);
    showHitmarker();
    removeTarget(t);
    if (scenario !== 'tracking') spawnTarget();   // keep the field populated
  } else {
    streak = 0;
    showMiss();
  }
  updateHUD();
}

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (!gameActive) return;
  if (!isLocked()) { canvas.requestPointerLock(); return; }
  shoot();
});

function calcScore(rt) {
  const base = Math.max(10, Math.round(1000 / (rt / 500)));
  const mult = difficulty === 'hard' ? 2 : difficulty === 'medium' ? 1.5 : 1;
  return Math.round(base * mult);
}

// ── HUD & feedback ──────────────────────────────────────────────────────────
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
  flashTO = setTimeout(() => { comboFlash.style.opacity = '0'; }, 700);
}

function showHitmarker() {
  hitmarker.style.opacity = '1';
  hitmarker.style.transform = 'translate(-50%, -50%) scale(1)';
  clearTimeout(hitTO);
  hitTO = setTimeout(() => {
    hitmarker.style.opacity = '0';
    hitmarker.style.transform = 'translate(-50%, -50%) scale(1.4)';
  }, 90);
}

function showMiss() {
  missFlash.style.opacity = '1';
  setTimeout(() => { missFlash.style.opacity = '0'; }, 120);
}

// ── Game lifecycle ──────────────────────────────────────────────────────────
function startGame() {
  overlay.style.display = 'none';
  clearTargets();
  score = 0; shots = 0; hits = 0; streak = 0; bestStreak = 0;
  reactionTimes = []; timeLeft = 30; gameActive = true;
  yaw = 0; pitch = 0;
  updateHUD();
  timerEl.textContent = timeLeft;

  canvas.requestPointerLock();

  // Seed the field.
  const d = DIFF[difficulty];
  const seed = scenario === 'flick' ? 1 : d.count;
  for (let i = 0; i < seed; i++) spawnTarget();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  spawnLoop();
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  clearTimeout(spawnTO);
  clearTargets();
  if (isLocked()) document.exitPointerLock();
  pauseHint.style.opacity = '0';

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

// ── Spawn loop (keeps tracking/flick fields topped up over time) ────────────
function spawnLoop() {
  if (!gameActive) return;
  const d = DIFF[difficulty];
  const want = scenario === 'flick' ? 1 : d.count;
  if (targets.length < want) spawnTarget();
  spawnTO = setTimeout(spawnLoop, 350);
}

// ── Render / update loop ────────────────────────────────────────────────────
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  applyCameraRotation();
  updateWeapon(now);

  // Update targets: expire by age, move in tracking mode, gentle pulse.
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const age = now - t.born;

    if (gameActive && age >= t.life && scenario !== 'tracking') {
      removeTarget(t);
      continue;
    }

    if (scenario === 'tracking' && gameActive) {
      t.mesh.position.addScaledVector(t.vel, dt);
      bounceWithinWall(t);
    }

    // Spawn pop-in + subtle breathing pulse.
    const popIn = Math.min(1, age / 120);
    const pulse = 1 + 0.05 * Math.sin(now / 160);
    t.mesh.scale.setScalar(t.radius * popIn * pulse);

    // Fade the emissive as it nears expiry (non-tracking) for a fair warning.
    if (scenario !== 'tracking') {
      const left = 1 - age / t.life;
      t.mesh.material.emissiveIntensity = 0.3 + 0.5 * Math.max(0, left);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function bounceWithinWall(t) {
  const mx = ROOM.w / 2 - 1.5, my = ROOM.h / 2 - 1.5;
  const p = t.mesh.position;
  if (p.x >  mx) { p.x =  mx; t.vel.x *= -1; }
  if (p.x < -mx) { p.x = -mx; t.vel.x *= -1; }
  if (p.y >  my) { p.y =  my; t.vel.y *= -1; }
  if (p.y < -my) { p.y = -my; t.vel.y *= -1; }
}

// ── Options UI ──────────────────────────────────────────────────────────────
document.querySelectorAll('#difficulty .opt-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#difficulty .opt-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    difficulty = b.dataset.d;
  });
});

document.querySelectorAll('#scenario .opt-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#scenario .opt-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    scenario = b.dataset.s;
  });
});

const sensSlider = document.getElementById('sens-slider');
const sensReadout = document.getElementById('sens-readout');
sensSlider.addEventListener('input', () => {
  sensitivity = parseFloat(sensSlider.value);
  sensReadout.textContent = sensitivity.toFixed(2);
});

document.getElementById('start-btn').addEventListener('click', startGame);

// ── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(loop);
