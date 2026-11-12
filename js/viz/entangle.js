// Two qubits: one Bloch sphere each (arrow = reduced state, shrinks when entangled),
// a link that glows with the amount of entanglement, and amplitude bars for |00>,|01>,|10>,|11>.
import * as THREE from 'three';
import { reducedBloch, concurrence, cabs2, carg, toThree } from '../qmath.js';
import { labelSprite, COLORS, UI_FONT, LIGHT_MODE, CYCLIC, ramp, solidMaterial } from '../three-kit.js';
import { createBlochSphere } from './bloch.js';
import { L } from '../lang.js';

export const QCOLORS = { A: COLORS.k, B: COLORS.j };

export function createEntangle({ spacing = 1.55, bars = true } = {}) {
  const group = new THREE.Group();
  const A = createBlochSphere({ color: QCOLORS.A, small: true });
  const B = createBlochSphere({ color: QCOLORS.B, small: true });
  A.group.position.x = -spacing; B.group.position.x = spacing;
  group.add(A.group, B.group);

  const tag = (t, c, x) => { const s = labelSprite(t, c, 0.32, { italic: false, font: UI_FONT }); s.position.set(x, 1.62, 0); group.add(s); };
  tag(L('Qubit A', 'Cúbit A'), QCOLORS.A, -spacing); tag(L('Qubit B', 'Cúbit B'), QCOLORS.B, spacing);

  // entanglement link
  const linkLen = Math.max(2*spacing - 2.1, 0.2);
  const cA = new THREE.Color(QCOLORS.A), cB = new THREE.Color(QCOLORS.B);
  let linkMat, link;
  if (LIGHT_MODE) {
    // light theme: a glossy tube that fades from A's colour to B's
    const lg = new THREE.CylinderGeometry(0.05, 0.05, linkLen, 20, 16);
    const p = lg.attributes.position, col = new Float32Array(p.count * 3);
    for (let n = 0; n < p.count; n++) { const c = cB.clone().lerp(cA, p.getY(n) / linkLen + 0.5); col[n*3] = c.r; col[n*3+1] = c.g; col[n*3+2] = c.b; }
    lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    linkMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.15, roughness: 0.3 });
    link = new THREE.Mesh(lg, linkMat);
  } else {
    linkMat = new THREE.MeshBasicMaterial({ color: COLORS.pink, transparent: true, opacity: 0.1 });
    link = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, linkLen, 16), linkMat);
  }
  link.rotation.z = Math.PI/2; group.add(link);
  const beads = [];
  for (let n = 0; n < 5; n++) {
    const mat = LIGHT_MODE ? new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, transparent: true, opacity: 0 })
                           : new THREE.MeshBasicMaterial({ color: COLORS.pink, transparent: true, opacity: 0 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(LIGHT_MODE ? 0.06 : 0.045, 16, 10), mat);
    group.add(b); beads.push(b);
  }

  // measurement axes
  const measLine = (g, color) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,0,0,0], 3));
    const l = new THREE.LineSegments(geo, new THREE.LineDashedMaterial({ color: LIGHT_MODE ? color : COLORS.line, dashSize: 0.07, gapSize: 0.05, transparent: true, opacity: LIGHT_MODE ? 1 : 0.85 }));
    l.visible = false; g.add(l); return l;
  };
  const mA = measLine(A.group, QCOLORS.A), mB = measLine(B.group, QCOLORS.B);
  const setMeas = (l, v) => {
    if (!v) { l.visible = false; return; }
    const a = new THREE.Vector3(...toThree(v)).multiplyScalar(1.4);
    l.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-a.x, -a.y, -a.z, a.x, a.y, a.z], 3));
    l.computeLineDistances(); l.visible = true;
  };

  // amplitude bars
  const barMeshes = [];
  if (bars) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, LIGHT_MODE ? 0.04 : 0.02, 0.5),
      LIGHT_MODE ? new THREE.MeshStandardMaterial({ color: '#c9d0da', roughness: 0.6 }) : new THREE.MeshLambertMaterial({ color: COLORS.base }));
    base.position.set(0, -2.0, 0); group.add(base);
    ['|00⟩','|01⟩','|10⟩','|11⟩'].forEach((t, n) => {
      const x = -0.9 + n*0.6;
      let mat, geo = new THREE.BoxGeometry(0.34, 1, 0.34);
      if (LIGHT_MODE) {
        // gradient bar (lighter at the foot, full colour at the top) inside a glass column showing the 100% height
        const p = geo.attributes.position, col = new Float32Array(p.count * 3);
        for (let k = 0; k < p.count; k++) { const f = 0.55 + 0.45 * (p.getY(k) + 0.5); col[k*3] = col[k*3+1] = col[k*3+2] = f; }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        mat = new THREE.MeshStandardMaterial({ color: COLORS.accent, vertexColors: true, roughness: 0.35 });
        const glassGeo = new THREE.BoxGeometry(0.4, 0.7, 0.4);
        const glass = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, roughness: 0.15, depthWrite: false }));
        glass.position.set(x, -1.98 + 0.35, 0);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glassGeo), new THREE.LineBasicMaterial({ color: '#9aa4b5', transparent: true, opacity: 0.6 }));
        edges.position.copy(glass.position);
        group.add(glass, edges);
      } else {
        mat = new THREE.MeshLambertMaterial({ color: COLORS.accent });
      }
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, -1.99, 0); group.add(m); barMeshes.push(m);
      const s = labelSprite(t, COLORS.fg, 0.2, { italic: false, font: UI_FONT }); s.position.set(x, -2.2, 0.2); group.add(s);
    });
  }

  let C = 0, clock = 0;
  function set(psi) {
    const ra = reducedBloch(psi, 0), rb = reducedBloch(psi, 1);
    A.setVector(ra); B.setVector(rb);
    C = Math.min(1, concurrence(psi));
    linkMat.opacity = LIGHT_MODE ? 0.15 + 0.85*C : 0.08 + 0.7*C;
    psi.forEach((z, n) => {
      const m = barMeshes[n]; if (!m) return;
      const p = cabs2(z), h = Math.max(p, 0.002) * 0.7;
      m.scale.y = h; m.position.y = -1.99 + h/2;
      m.visible = p > 0.0005;
      const ph = carg(z);
      const f = ((ph/(2*Math.PI)) + 1) % 1;
      if (LIGHT_MODE) m.material.color.copy(ramp(CYCLIC, f)); else m.material.color.setHSL(f, 0.75, 0.6);
    });
    return { ra, rb, C };
  }
  function tick(dt) {
    clock += dt;
    beads.forEach((b, n) => {
      const t = ((clock*0.35 + n/beads.length) % 1);
      b.position.set(-linkLen/2 + t*linkLen, 0, 0);
      b.material.opacity = C * Math.sin(Math.PI * t) * 0.95;
      if (LIGHT_MODE) b.material.color.copy(cA).lerp(cB, t);   // beads travel from A's colour to B's
    });
  }

  return { group, A, B, set, tick, setMeasure(vA, vB) { setMeas(mA, vA); setMeas(mB, vB); } };
}
