// A Bloch sphere: shell, grid, axis labels, a state arrow, an optional rotation axis and a trail.
// The light (figure) theme adds coloured axis rods, an equator phase ring, a contact shadow,
// a gradient ribbon for the trail and a solid rotation-axis rod.
import * as THREE from 'three';
import { toThree } from '../qmath.js';
import { labelSprite, makeArrow, COLORS, UI_FONT, LIGHT_MODE, DIVERGING, CYCLIC, ramp, solidMaterial } from '../three-kit.js';

const B = (v) => new THREE.Vector3(...toThree(v));
export const AXIS_COLORS = { x: '#d64545', y: '#2f9e57', z: '#2f63c9' };   // light theme x / y / z rods

let shadowTex = null;
function contactShadowTexture() {
  if (shadowTex) return shadowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(30,40,60,0.32)'); grd.addColorStop(0.55, 'rgba(30,40,60,0.12)'); grd.addColorStop(1, 'rgba(30,40,60,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  shadowTex = new THREE.CanvasTexture(cv);
  return shadowTex;
}

export function createBlochSphere({ radius = 1, labels = true, color = LIGHT_MODE ? '#c8236a' : COLORS.accent, small = false, shadow = true } = {}) {
  const group = new THREE.Group();
  group.scale.setScalar(radius);

  let shell;
  if (LIGHT_MODE) {
    // shaded glass sphere coloured by latitude: blue near |0⟩, near white on the equator, coral near |1⟩,
    // so the colour under the arrow reads as P(0) = (1 + z)/2
    const geo = new THREE.SphereGeometry(1, 96, 48);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (let n = 0; n < p.count; n++) { const c = ramp(DIVERGING, (p.getY(n) + 1) / 2); col[n*3] = c.r; col[n*3+1] = c.g; col[n*3+2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    shell = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.5, roughness: 0.28, metalness: 0, depthWrite: false }));
    // faint back face so the far side still reads as part of the sphere
    group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false })));
  } else {
    shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32),
      new THREE.MeshLambertMaterial({ color: COLORS.shell, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  }
  group.add(shell);

  // grid
  const pts = [];
  const sph = (t, p) => toThree([Math.sin(t)*Math.cos(p), Math.sin(t)*Math.sin(p), Math.cos(t)]);
  for (let a = 1; a < 12; a++) { const t = a*Math.PI/12;
    for (let s = 0; s < 96; s++) pts.push(...sph(t, s/96*2*Math.PI), ...sph(t, (s+1)/96*2*Math.PI)); }
  for (let m = 0; m < 12; m++) { const p = m/12*2*Math.PI;
    for (let s = 0; s < 48; s++) pts.push(...sph(s/48*Math.PI, p), ...sph((s+1)/48*Math.PI, p)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: COLORS.soft, transparent: true, opacity: LIGHT_MODE ? 0.12 : 0.14 })));

  if (LIGHT_MODE) {
    // equator as a phase wheel: colour = relative phase φ (same cyclic palette as the Hopf fibers)
    const ring = new THREE.TorusGeometry(1, 0.016, 10, 192);
    const p = ring.attributes.position, col = new Float32Array(p.count * 3);
    for (let n = 0; n < p.count; n++) {
      const phi = ((Math.atan2(-p.getY(n), p.getX(n)) / (2*Math.PI)) + 1) % 1;   // after the rotation below, torus y → −Bloch y
      const c = ramp(CYCLIC, phi); col[n*3] = c.r; col[n*3+1] = c.g; col[n*3+2] = c.b;
    }
    ring.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const eqMesh = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }));
    eqMesh.rotation.x = Math.PI / 2;
    group.add(eqMesh);
    // coloured axis rods with arrow tips: x red, y green, z blue
    const up = new THREE.Vector3(0, 1, 0);
    [['x', [1,0,0]], ['y', [0,1,0]], ['z', [0,0,1]]].forEach(([k, d]) => {
      const mat = solidMaterial(AXIS_COLORS[k]);
      const dir = B(d);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 2.5, 10), mat);
      rod.quaternion.setFromUnitVectors(up, dir);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 18), mat);
      tip.quaternion.setFromUnitVectors(up, dir); tip.position.copy(dir).multiplyScalar(1.3);
      group.add(rod, tip);
    });
    if (shadow) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = -1.38;
      group.add(sh);
    }
  } else {
    // equator a little stronger
    const eq = [];
    for (let s = 0; s < 128; s++) eq.push(...sph(Math.PI/2, s/128*2*Math.PI), ...sph(Math.PI/2, (s+1)/128*2*Math.PI));
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(eq, 3));
    group.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: COLORS.soft, transparent: true, opacity: 0.35 })));
    // axes
    const ax = [];
    [[1,0,0],[0,1,0],[0,0,1]].forEach(d => ax.push(...toThree(d.map(x => -1.3*x)), ...toThree(d.map(x => 1.3*x))));
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(ax, 3));
    group.add(new THREE.LineSegments(ag, new THREE.LineBasicMaterial({ color: COLORS.axis, transparent: true, opacity: 0.5 })));
  }

  if (labels) {
    const h = small ? 0.17 : 0.2, opt = { italic: false, font: UI_FONT };
    const add = (t, p, c = COLORS.fg, hh = h) => { const s = labelSprite(t, c, hh, opt); s.position.copy(B(p)); group.add(s); };
    add('|0⟩', [0, 0, 1.24], LIGHT_MODE ? AXIS_COLORS.z : COLORS.fg); add('|1⟩', [0, 0, -1.24], LIGHT_MODE ? '#c2492a' : COLORS.fg);
    add('|+⟩', [1.4, 0, 0], LIGHT_MODE ? AXIS_COLORS.x : COLORS.soft, h*0.85); add('|−⟩', [-1.32, 0, 0], COLORS.soft, h*0.85);
    add('|+i⟩', [0, 1.42, 0], LIGHT_MODE ? AXIS_COLORS.y : COLORS.soft, h*0.85);
  }

  // state arrow
  const arrow = makeArrow(color, LIGHT_MODE ? { shaft: 0.024, head: 0.065, headLen: 0.16 } : undefined);
  group.add(arrow);
  // ghost arrow (e.g. state before a gate)
  const ghost = makeArrow(COLORS.ghost, { shaft: 0.01, head: 0.035, headLen: 0.09 });
  ghost.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.45; } });
  ghost.visible = false;
  group.add(ghost);

  // rotation axis: dashed line on black, a solid rod with end caps on light backgrounds
  const axisGeo = new THREE.BufferGeometry();
  axisGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,0,0,0], 3));
  const axisLine = new THREE.LineSegments(axisGeo, new THREE.LineDashedMaterial({ color: COLORS.pink, dashSize: 0.06, gapSize: 0.04 }));
  axisLine.visible = false;
  group.add(axisLine);
  const axisRod = new THREE.Group();
  if (LIGHT_MODE) {
    const m = solidMaterial('#7a3fd1');
    axisRod.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.9, 12), m));
    [1, -1].forEach(s => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), m); c.position.y = 1.45 * s; axisRod.add(c); });
  }
  axisRod.visible = false;
  group.add(axisRod);

  // trail of the arrow tip: thin line on black, a gradient ribbon (cyclic palette along the path) on light
  const TRAIL = 2000;
  const tgeo = new THREE.BufferGeometry();
  const tpos = new Float32Array(TRAIL * 3);
  tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  tgeo.setDrawRange(0, 0);
  const trail = new THREE.Line(tgeo, new THREE.LineBasicMaterial({ color: COLORS.pink, transparent: true, opacity: 0.85 }));
  trail.frustumCulled = false;
  group.add(trail);
  let tn = 0;
  const ribbonMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
  let ribbon = null, ribbonKey = '';

  // invisible exact sphere for picking
  const pick = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(pick);

  const api = {
    group, shell, pick, arrow,
    setVector(v) { arrow.userData.set(B(v)); arrow.userData.vec = v; },
    setColor(c) { arrow.userData.setColor(c); },
    setGhost(v) { if (!v) { ghost.visible = false; return; } ghost.visible = true; ghost.userData.set(B(v)); },
    setAxis(n) {
      if (!n) { axisLine.visible = false; axisRod.visible = false; return; }
      if (LIGHT_MODE) {
        axisRod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B(n).normalize());
        axisRod.visible = true;
        return;
      }
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
    // Set the whole trail at once (Bloch vectors) for a rotation of `angle` radians. Rebuilt only when it changes.
    setTrail(vs, angle = 2 * Math.PI) {
      if (!LIGHT_MODE) { api.clearTrail(); vs.forEach(api.pushTrail); return; }
      const last = vs[vs.length - 1];
      const key = vs.length + ':' + (last ? last.map(x => x.toFixed(4)).join(',') : '');
      if (key === ribbonKey) return;
      ribbonKey = key;
      if (ribbon) { group.remove(ribbon); ribbon.geometry.dispose(); ribbon = null; }
      if (vs.length < 2) return;
      const pts = vs.map(v => B(v).multiplyScalar(1.002));
      const segs = Math.max(8, pts.length * 2), radial = 8;
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, 0.022, radial, false);
      const col = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i <= segs; i++) {
        // colour runs around the palette as the arrow turns; a full 360° turn completes the wheel
        const c = ramp(CYCLIC, (i / segs * angle / (2 * Math.PI)) % 1);
        for (let j = 0; j <= radial; j++) { const k = (i * (radial + 1) + j) * 3; col[k] = c.r; col[k+1] = c.g; col[k+2] = c.b; }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      ribbon = new THREE.Mesh(geo, ribbonMat);
      group.add(ribbon);
    },
  };
  return api;
}
