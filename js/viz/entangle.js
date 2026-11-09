// Two qubits: one Bloch sphere each (arrow = reduced state, shrinks when entangled),
// a link that glows with the amount of entanglement, and amplitude bars for |00>,|01>,|10>,|11>.
import * as THREE from 'three';
import { reducedBloch, concurrence, cabs2, carg, toThree } from '../qmath.js';
import { labelSprite, COLORS, UI_FONT } from '../three-kit.js';
import { createBlochSphere } from './bloch.js';
import { L } from '../lang.js';

export const QCOLORS = { A: '#6fc3ff', B: '#ff9b6b' };

export function createEntangle({ spacing = 1.55, bars = true } = {}) {
  const group = new THREE.Group();
  const A = createBlochSphere({ color: QCOLORS.A, small: true });
  const B = createBlochSphere({ color: QCOLORS.B, small: true });
  A.group.position.x = -spacing; B.group.position.x = spacing;
  group.add(A.group, B.group);

  const tag = (t, c, x) => { const s = labelSprite(t, c, 0.32, { italic: false, font: UI_FONT }); s.position.set(x, 1.62, 0); group.add(s); };
  tag(L('Qubit A', '比特 A', 'Cúbit A', '量子ビット A'), QCOLORS.A, -spacing); tag(L('Qubit B', '比特 B', 'Cúbit B', '量子ビット B'), QCOLORS.B, spacing);

  // entanglement link
  const linkLen = Math.max(2*spacing - 2.1, 0.2);
  const linkMat = new THREE.MeshBasicMaterial({ color: COLORS.pink, transparent: true, opacity: 0.1 });
  const link = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, linkLen, 16), linkMat);
  link.rotation.z = Math.PI/2; group.add(link);
  const beads = [];
  for (let n = 0; n < 5; n++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), new THREE.MeshBasicMaterial({ color: COLORS.pink, transparent: true, opacity: 0 }));
    group.add(b); beads.push(b);
  }

  // measurement axes
  const measLine = (g) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,0,0,0], 3));
    const l = new THREE.LineSegments(geo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.07, gapSize: 0.05, transparent: true, opacity: 0.85 }));
    l.visible = false; g.add(l); return l;
  };
  const mA = measLine(A.group), mB = measLine(B.group);
  const setMeas = (l, v) => {
    if (!v) { l.visible = false; return; }
    const a = new THREE.Vector3(...toThree(v)).multiplyScalar(1.4);
    l.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-a.x, -a.y, -a.z, a.x, a.y, a.z], 3));
    l.computeLineDistances(); l.visible = true;
  };

  // amplitude bars
  const barMeshes = [];
  if (bars) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 0.5), new THREE.MeshLambertMaterial({ color: 0x1b2230 }));
    base.position.set(0, -2.0, 0); group.add(base);
    ['|00⟩','|01⟩','|10⟩','|11⟩'].forEach((t, n) => {
      const x = -0.9 + n*0.6;
      const mat = new THREE.MeshLambertMaterial({ color: COLORS.accent });
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1, 0.34), mat);
      m.position.set(x, -1.99, 0); group.add(m); barMeshes.push(m);
      const s = labelSprite(t, COLORS.fg, 0.2, { italic: false, font: UI_FONT }); s.position.set(x, -2.2, 0.2); group.add(s);
    });
  }

  let C = 0, clock = 0;
  function set(psi) {
    const ra = reducedBloch(psi, 0), rb = reducedBloch(psi, 1);
    A.setVector(ra); B.setVector(rb);
    C = Math.min(1, concurrence(psi));
    linkMat.opacity = 0.08 + 0.7*C;
    psi.forEach((z, n) => {
      const m = barMeshes[n]; if (!m) return;
      const p = cabs2(z), h = Math.max(p, 0.002) * 0.7;
      m.scale.y = h; m.position.y = -1.99 + h/2;
      m.visible = p > 0.0005;
      const ph = carg(z);
      m.material.color.setHSL(((ph/(2*Math.PI)) + 1) % 1, 0.75, 0.6);
    });
    return { ra, rb, C };
  }
  function tick(dt) {
    clock += dt;
    beads.forEach((b, n) => {
      const t = ((clock*0.35 + n/beads.length) % 1);
      b.position.set(-linkLen/2 + t*linkLen, 0, 0);
      b.material.opacity = C * Math.sin(Math.PI * t) * 0.95;
    });
  }

  return { group, A, B, set, tick, setMeasure(vA, vB) { setMeas(mA, vA); setMeas(mB, vB); } };
}
