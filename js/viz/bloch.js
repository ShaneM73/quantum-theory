// A Bloch sphere: shell, grid, axis labels, a state arrow, an optional rotation axis and a trail.
import * as THREE from 'three';
import { toThree } from '../qmath.js';
import { labelSprite, makeArrow, COLORS, UI_FONT } from '../three-kit.js';

const B = (v) => new THREE.Vector3(...toThree(v));

export function createBlochSphere({ radius = 1, labels = true, color = COLORS.accent, small = false } = {}) {
  const group = new THREE.Group();
  group.scale.setScalar(radius);

  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32),
    new THREE.MeshLambertMaterial({ color: 0x3a4a63, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  group.add(shell);

  // grid
  const pts = [];
  const sph = (t, p) => toThree([Math.sin(t)*Math.cos(p), Math.sin(t)*Math.sin(p), Math.cos(t)]);
  for (let a = 1; a < 12; a++) { const t = a*Math.PI/12;
    for (let s = 0; s < 96; s++) pts.push(...sph(t, s/96*2*Math.PI), ...sph(t, (s+1)/96*2*Math.PI)); }
  for (let m = 0; m < 12; m++) { const p = m/12*2*Math.PI;
    for (let s = 0; s < 48; s++) pts.push(...sph(s/48*Math.PI, p), ...sph((s+1)/48*Math.PI, p)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc9d3e2, transparent: true, opacity: 0.14 })));
  // equator a little stronger
  const eq = [];
  for (let s = 0; s < 128; s++) eq.push(...sph(Math.PI/2, s/128*2*Math.PI), ...sph(Math.PI/2, (s+1)/128*2*Math.PI));
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(eq, 3));
  group.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0xc9d3e2, transparent: true, opacity: 0.35 })));
  // axes
  const ax = [];
  [[1,0,0],[0,1,0],[0,0,1]].forEach(d => ax.push(...toThree(d.map(x => -1.3*x)), ...toThree(d.map(x => 1.3*x))));
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(ax, 3));
  group.add(new THREE.LineSegments(ag, new THREE.LineBasicMaterial({ color: COLORS.axis, transparent: true, opacity: 0.5 })));

  if (labels) {
    const h = small ? 0.17 : 0.2, opt = { italic: false, font: UI_FONT };
    const add = (t, p, c = COLORS.fg, hh = h) => { const s = labelSprite(t, c, hh, opt); s.position.copy(B(p)); group.add(s); };
    add('|0⟩', [0, 0, 1.22]); add('|1⟩', [0, 0, -1.22]);
    add('|+⟩', [1.28, 0, 0], '#c9d3e2', h*0.85); add('|−⟩', [-1.28, 0, 0], '#c9d3e2', h*0.85);
    add('|+i⟩', [0, 1.3, 0], '#c9d3e2', h*0.85);
  }

  // state arrow
  const arrow = makeArrow(color);
  group.add(arrow);
  // ghost arrow (e.g. state before a gate)
  const ghost = makeArrow(0x9aa4b5, { shaft: 0.01, head: 0.035, headLen: 0.09 });
  ghost.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.45; } });
  ghost.visible = false;
  group.add(ghost);

  // rotation axis
  const axisGeo = new THREE.BufferGeometry();
  axisGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,0,0,0], 3));
  const axisLine = new THREE.LineSegments(axisGeo, new THREE.LineDashedMaterial({ color: COLORS.pink, dashSize: 0.06, gapSize: 0.04 }));
  axisLine.visible = false;
  group.add(axisLine);

  // trail of the arrow tip
  const TRAIL = 2000;
  const tgeo = new THREE.BufferGeometry();
  const tpos = new Float32Array(TRAIL * 3);
  tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  tgeo.setDrawRange(0, 0);
  const trail = new THREE.Line(tgeo, new THREE.LineBasicMaterial({ color: COLORS.pink, transparent: true, opacity: 0.85 }));
  trail.frustumCulled = false;
  group.add(trail);
  let tn = 0;

  // invisible exact sphere for picking
  const pick = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(pick);

  return {
    group, shell, pick, arrow,
    setVector(v) { arrow.userData.set(B(v)); arrow.userData.vec = v; },
    setColor(c) { arrow.userData.setColor(c); },
    setGhost(v) { if (!v) { ghost.visible = false; return; } ghost.visible = true; ghost.userData.set(B(v)); },
    setAxis(n) {
      if (!n) { axisLine.visible = false; return; }
      const a = B(n).multiplyScalar(1.45);
      axisGeo.setAttribute('position', new THREE.Float32BufferAttribute([-a.x, -a.y, -a.z, a.x, a.y, a.z], 3));
      axisLine.computeLineDistances();
      axisLine.visible = true;
    },
    clearTrail() { tn = 0; tgeo.setDrawRange(0, 0); },
    pushTrail(v) {
      if (tn >= TRAIL) return;
      const p = B(v); tpos[tn*3] = p.x; tpos[tn*3+1] = p.y; tpos[tn*3+2] = p.z; tn++;
      tgeo.setDrawRange(0, tn); tgeo.attributes.position.needsUpdate = true;
    },
  };
}
