/* ============================================================================
 * main.js — entry point & game orchestration
 * Wires the world (3D), targets, UI, and storage together; owns the game state
 * machine (menu → playing → results), the input handlers, and the loop.
 * ========================================================================== */

import { ROUND_SECONDS, DIFF } from './config.js';
import { Storage } from './storage.js';
import { createWorld } from './scene.js';
import { Targets } from './targets.js';
import { UI } from './ui.js';

const canvas = document.getElementById('canvas');
const world = createWorld(canvas);
const targets = new Targets(world.scene);
const ui = new UI();

// ── Persistent settings + run state ──────────────────────────────────────────
const settings = Storage.getSettings();

const state = {
  scenario: settings.scenario,
  difficulty: settings.difficulty,
  sensitivity: settings.sensitivity,
  playing: false,
  // per-run
  score: 0, shots: 0, hits: 0, streak: 0, bestStreak: 0,
  reactTimes: [], get avgReact() {
    return this.reactTimes.length
      ? this.reactTimes.reduce((a, b) => a + b, 0) / this.reactTimes.length : 0;
  },
};

let timeLeft = ROUND_SECONDS;
let timerInterval = null;
let spawnInterval = null;

targets.configure(state.scenario, state.difficulty);

// ── UI wiring ─────────────────────────────────────────────────────────────────
ui.init(state, {
  onScenario(id) {
    state.scenario = id;
    targets.configure(state.scenario, state.difficulty);
    Storage.saveSettings({ scenario: id });
    ui.setScenarioBlurb(id);
    ui.refreshBest(state.scenario, state.difficulty);
  },
  onDifficulty(id) {
    state.difficulty = id;
    targets.configure(state.scenario, state.difficulty);
    Storage.saveSettings({ difficulty: id });
    ui.refreshBest(state.scenario, state.difficulty);
  },
  onSensitivity(v) {
    state.sensitivity = v;
    Storage.saveSettings({ sensitivity: v });
  },
  onStart: startGame,
  onReset() { ui.refreshBest(state.scenario, state.difficulty); },
});

// ── Pointer lock & input ───────────────────────────────────────────────────────
const isLocked = () => document.pointerLockElement === canvas;

document.addEventListener('mousemove', (e) => {
  if (!isLocked()) return;
  world.addLook(e.movementX, e.movementY, state.sensitivity);
});

document.addEventListener('pointerlockchange', () => {
  if (state.playing) ui.setPaused(!isLocked());
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !state.playing) return;
  if (!isLocked()) { canvas.requestPointerLock(); return; }
  shoot();
});

window.addEventListener('resize', () => world.resize());

// ── Game lifecycle ─────────────────────────────────────────────────────────────
function startGame() {
  // reset run state
  Object.assign(state, {
    playing: true, score: 0, shots: 0, hits: 0, streak: 0, bestStreak: 0, reactTimes: [],
  });
  timeLeft = ROUND_SECONDS;

  targets.configure(state.scenario, state.difficulty);
  targets.clear();
  world.resetLook();

  ui.hideMenu();
  ui.clearResults();
  ui.updateHUD(state);
  ui.setTimer(timeLeft);
  ui.el.start.textContent = 'Run It Back';

  canvas.requestPointerLock();

  // seed the field
  const seed = state.scenario === 'flick' ? 1 : DIFF[state.difficulty].count;
  for (let i = 0; i < seed; i++) targets.spawn();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    ui.setTimer(timeLeft);
    if (timeLeft <= 0) endGame();
  }, 1000);

  // keep tracking/flick fields topped up
  clearInterval(spawnInterval);
  spawnInterval = setInterval(() => { if (state.playing) targets.refill(); }, 280);
}

function endGame() {
  state.playing = false;
  clearInterval(timerInterval);
  clearInterval(spawnInterval);
  targets.clear();
  if (isLocked()) document.exitPointerLock();
  ui.setPaused(false);

  const run = {
    scenario: state.scenario,
    difficulty: state.difficulty,
    score: state.score,
    accuracy: state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0,
    avgReact: Math.round(state.avgReact),
    bestStreak: state.bestStreak,
    ts: Date.now(),
  };

  const { records } = Storage.recordRun(run);
  ui.showResults(run, records);
  ui.refreshBest(state.scenario, state.difficulty);
  ui.showMenu();
}

function shoot() {
  state.shots++;
  world.kickRecoil();
  const hit = targets.resolveHit(world.raycastCenter(targets.meshes));

  if (hit) {
    const rt = performance.now() - hit.born;
    state.reactTimes.push(rt);
    state.hits++;
    state.score += scoreFor(rt);
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (state.streak > 1) ui.combo(state.streak);
    ui.hitmarker();
    targets.remove(hit);
    if (state.scenario !== 'tracking') targets.spawn();
  } else {
    state.streak = 0;
    ui.miss();
  }
  ui.updateHUD(state);
}

function scoreFor(rt) {
  const base = Math.max(10, Math.round(1000 / (rt / 500)));
  return Math.round(base * DIFF[state.difficulty].mult);
}

// ── Master loop ──────────────────────────────────────────────────────────────
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  targets.update(now, dt, state.playing);
  world.update(now, dt, state.playing);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
