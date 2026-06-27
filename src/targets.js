/* ============================================================================
 * targets.js — target lifecycle + hit detection
 * Owns the pool of live targets: spawning them in the play volume, animating
 * pop-in / pulse / drift, expiring them, and resolving a center-screen raycast
 * to a hit. Knows nothing about scoring or UI.
 * ========================================================================== */

import * as THREE from 'three';
import { DIFF, SPAWN, COLORS } from './config.js';
import { makeGlow } from './scene.js';

const GEO = new THREE.SphereGeometry(1, 28, 28);
const rand = (a, b) => a + Math.random() * (b - a);

export class Targets {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.scenario = 'grid';
    this.difficulty = 'medium';
  }

  configure(scenario, difficulty) {
    this.scenario = scenario;
    this.difficulty = difficulty;
  }

  get meshes() {
    return this.list.map(t => t.mesh);
  }

  desiredCount() {
    return this.scenario === 'flick' ? 1 : DIFF[this.difficulty].count;
  }

  spawn() {
    const d = DIFF[this.difficulty];
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.target),
      emissive: new THREE.Color(COLORS.targetEmissive),
      emissiveIntensity: 1.0, roughness: 0.25, metalness: 0.1,
    });
    const mesh = new THREE.Mesh(GEO, mat);
    mesh.scale.setScalar(d.radius);
    mesh.position.set(
      rand(SPAWN.xMin, SPAWN.xMax),
      rand(SPAWN.yMin, SPAWN.yMax),
      rand(SPAWN.zMin, SPAWN.zMax)
    );

    // Additive halo so targets glow against the dark grid. The sprite is a
    // child of the (radius-scaled) mesh, so its scale is relative: 6 ≈ 6× the
    // core radius in world units.
    const glow = makeGlow(6, '#13e0ff', 0.6);
    mesh.add(glow);

    const ang = Math.random() * Math.PI * 2;
    const vel = new THREE.Vector3(Math.cos(ang), Math.sin(ang) * 0.7, 0)
      .multiplyScalar(d.trackSpeed);

    const t = { mesh, glow, born: performance.now(), life: d.life, vel, radius: d.radius };
    mesh.userData.ref = t;
    this.list.push(t);
    this.scene.add(mesh);
    return t;
  }

  /** Keep the field topped up to the desired count. */
  refill() {
    while (this.list.length < this.desiredCount()) this.spawn();
  }

  remove(t) {
    const i = this.list.indexOf(t);
    if (i !== -1) this.list.splice(i, 1);
    this.scene.remove(t.mesh);
    t.mesh.material.dispose();
  }

  clear() {
    while (this.list.length) this.remove(this.list[0]);
  }

  /** Resolve a hit from the world raycast; returns the target or null. */
  resolveHit(intersections) {
    if (!intersections.length) return null;
    return intersections[0].object.userData.ref || null;
  }

  update(now, dt, playing) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      const age = now - t.born;

      // Expire by age (not in tracking — those live until hit or round end).
      if (playing && this.scenario !== 'tracking' && age >= t.life) {
        this.remove(t);
        continue;
      }

      if (this.scenario === 'tracking' && playing) {
        t.mesh.position.addScaledVector(t.vel, dt);
        this._bounce(t);
      }

      const popIn = Math.min(1, age / 120);
      const pulse = 1 + 0.06 * Math.sin(now / 150);
      t.mesh.scale.setScalar(t.radius * popIn * pulse);

      // Warn of imminent expiry by shifting hue toward red + dimming glow.
      if (this.scenario !== 'tracking') {
        const left = Math.max(0, 1 - age / t.life);
        t.mesh.material.emissiveIntensity = 0.4 + 0.7 * left;
        if (left < 0.35) {
          t.mesh.material.emissive.set(COLORS.targetExpiring);
          t.mesh.material.color.set(COLORS.targetExpiring);
        }
      }
    }
  }

  _bounce(t) {
    const p = t.mesh.position;
    if (p.x > SPAWN.xMax) { p.x = SPAWN.xMax; t.vel.x *= -1; }
    if (p.x < SPAWN.xMin) { p.x = SPAWN.xMin; t.vel.x *= -1; }
    if (p.y > SPAWN.yMax) { p.y = SPAWN.yMax; t.vel.y *= -1; }
    if (p.y < SPAWN.yMin) { p.y = SPAWN.yMin; t.vel.y *= -1; }
  }
}
