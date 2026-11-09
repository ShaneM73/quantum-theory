// Hopf fibration: each Bloch-sphere state is a whole circle (global phase) on S³.
import * as THREE from 'three';
import { stereo, toThree, stateFromAngles, cexpi, cmul, r4OfState } from '../qmath.js';
import { axesLines, labelSprite, COLORS, THEME, solidMaterial, CYCLIC, ramp } from '../three-kit.js';
import { createBlochSphere } from './bloch.js';

const CAP = 24, JUMP = 5, NF = 240;
const D2R = Math.PI / 180;

export function r4(th, ph, ga) {
  const s = stateFromAngles(th, ph);
  const g = cexpi(ga);
  return r4OfState([cmul(g, s[0]), cmul(g, s[1])]);
}
export function stateColor(th, ph) {
  const hue = (((ph/(2*Math.PI)) % 1) + 1) % 1;
  // darker, more saturated on a white background so fibers stay visible in figures
  if (THEME === 'light') {
    // cyclic palette by φ; a touch lighter near |0⟩ and deeper near |1⟩
    const c = ramp(CYCLIC, hue), t = Math.cos(th);
    return t > 0 ? c.lerp(new THREE.Color('#ffffff'), 0.18 * t) : c.lerp(new THREE.Color('#141a26'), -0.25 * t);
  }
  return new THREE.Color().setHSL(hue, 0.78, 0.42 + 0.22*Math.cos(th));
}
const P = q => { const v = stereo(q); return v && toThree(v); };
const blochPos = (th, ph) => new THREE.Vector3(...toThree([Math.sin(th)*Math.cos(ph), Math.sin(th)*Math.sin(ph), Math.cos(th)]));

export function createHopf({ labels = true, tubeScale = 1 } = {}) {
  const params = { th: 60, ph: 40, ga: 0, fam: 'one' };
  let needRebuild = true;

  // ---- S³ side ----
  const s3 = new THREE.Group();
  s3.add(axesLines(8, { ticks: true, opacity: 0.4 }));
  const fibers = new THREE.Group(); s3.add(fibers);
  const phaseDot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), new THREE.MeshBasicMaterial({ color: COLORS.pink }));
  s3.add(phaseDot);
  if (labels) {
    const add = (t, c, p, h = 0.3) => { const s = labelSprite(t, c, h); s.position.set(...p); s3.add(s); };
    add('1 = |0⟩', COLORS.fg, [0.32, -0.2, 0.2], 0.26);
    add('i', COLORS.i, [1, 0.17, 0]); add('j', COLORS.j, [0, 0.17, -1]); add('k', COLORS.k, [0.15, 1, 0]);
  }

  // ---- Bloch side ----
  const bloch = createBlochSphere({ labels });
  bloch.arrow.visible = true;
  const points = new THREE.Group(); bloch.group.add(points);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  bloch.group.add(hit);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 32), new THREE.MeshBasicMaterial({ color: COLORS.pink }));
  bloch.group.add(ring);

  const clear = g => { while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); if (c.material.dispose) c.material.dispose(); } };

  function fiberMeshes(th, ph, color, radius) {
    const pts = [];
    for (let k = 0; k < NF; k++) {
      const v = P(r4(th, ph, k/NF*2*Math.PI));
      pts.push(v && v.every(c => Math.abs(c) < CAP) ? new THREE.Vector3(...v) : null);
    }
    const mat = solidMaterial(color, 0.9);
    const out = [];
    const bad = pts.findIndex(p => !p);
    let start = bad;
    if (bad < 0) {
      // closed, but check for jumps
      let jumpAt = -1;
      for (let k = 0; k < NF; k++) if (pts[k].distanceTo(pts[(k+1) % NF]) > JUMP) { jumpAt = k; break; }
      if (jumpAt < 0) {
        out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), NF, radius, 8, true), mat));
        return out;
      }
      start = jumpAt;
    }
    let run = [];
    const flush = () => {
      if (run.length > 2) out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), run.length*2, radius, 8, false), mat));
      run = [];
    };
    for (let n = 1; n <= NF; n++) {
      const p = pts[(start + n) % NF];
      if (!p) { flush(); continue; }
      if (run.length && run[run.length-1].distanceTo(p) > JUMP) flush();
      run.push(p);
    }
    flush();
    return out;
  }

  function familyStates() {
    const th = params.th*D2R, ph = params.ph*D2R, list = [{ th, ph, main: true }];
    if (params.fam === 'ring') {
      for (let n = 1; n < 14; n++) list.push({ th, ph: ph + n/14*2*Math.PI });
    } else if (params.fam === 'scatter') {
      const N = 13, gold = Math.PI*(3 - Math.sqrt(5));
      for (let n = 0; n < N; n++) { const z = 1 - 2*(n + 0.5)/N; list.push({ th: Math.acos(z), ph: n*gold }); }
    }
    return list;
  }

  function rebuild() {
    clear(fibers); clear(points);
    for (const s of familyStates()) {
      const col = stateColor(s.th, s.ph);
      fiberMeshes(s.th, s.ph, col, (s.main ? 0.034 : 0.018) * tubeScale).forEach(m => fibers.add(m));
      const d = new THREE.Mesh(new THREE.SphereGeometry(s.main ? 0.065 : 0.04, 20, 14), new THREE.MeshBasicMaterial({ color: col }));
      d.position.copy(blochPos(s.th, s.ph)); points.add(d);
    }
    const th = params.th*D2R, ph = params.ph*D2R;
    bloch.setVector([Math.sin(th)*Math.cos(ph), Math.sin(th)*Math.sin(ph), Math.cos(th)]);
    bloch.setColor(stateColor(th, ph));
    hit.position.copy(blochPos(th, ph));
  }

  function update() {
    if (needRebuild) { rebuild(); needRebuild = false; }
    const th = params.th*D2R, ph = params.ph*D2R, ga = params.ga*D2R;
    const v = P(r4(th, ph, ga));
    phaseDot.visible = !!(v && v.every(c => Math.abs(c) < CAP));
    if (phaseDot.visible) phaseDot.position.set(...v);
    const b = blochPos(th, ph);
    ring.position.copy(b); ring.lookAt(bloch.group.localToWorld(b.clone().multiplyScalar(2)));
  }

  function amplitudes() {
    const th = params.th*D2R, ph = params.ph*D2R, ga = params.ga*D2R;
    const s = stateFromAngles(th, ph), g = cexpi(ga);
    return [cmul(g, s[0]), cmul(g, s[1])];
  }

  return {
    s3, bloch, hit, params,
    set(p) {
      if ('th' in p || 'ph' in p || 'fam' in p) needRebuild = true;
      Object.assign(params, p);
    },
    update, amplitudes,
  };
}
