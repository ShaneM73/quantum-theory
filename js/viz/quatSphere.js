// The 3Blue1Brown quaternion demo: the unit sphere of pure quaternions, multiplied by q,
// then stereographically projected from −1.
import * as THREE from 'three';
import { qmul, qconj, qFromAngle, stereo, toThree } from '../qmath.js';
import { DynLines, axesLines, labelSprite, COLORS, LIGHT_MODE, CYCLIC, ramp } from '../three-kit.js';
import { L } from '../lang.js';

const CAP = 28, JUMP = 6;
export const QS_AXES = {
  i: [1,0,0], j: [0,1,0], k: [0,0,1],
  d: [1,1,1].map(v => v/Math.sqrt(3)),
};
const PERP = {
  i: [[0,1,0],[0,0,1]], j: [[0,0,1],[1,0,0]], k: [[1,0,0],[0,1,0]],
  d: [[1,-1,0].map(v=>v/Math.SQRT2), [1,1,-2].map(v=>v/Math.sqrt(6))],
};
const P = q => { const v = stereo(q); return v && toThree(v); };

function sphereGrid(w, r) {
  const polys = [];
  for (let a = 1; a < 12; a++) {
    const ph = -Math.PI/2 + a*Math.PI/12, line = [];
    for (let s = 0; s <= 160; s++) { const t = s/160*2*Math.PI;
      line.push([w, r*Math.cos(ph)*Math.cos(t), r*Math.cos(ph)*Math.sin(t), r*Math.sin(ph)]); }
    polys.push(line);
  }
  for (let m = 0; m < 24; m++) {
    const t = m/24*2*Math.PI, line = [];
    for (let s = 0; s <= 96; s++) { const ph = -Math.PI/2 + s/96*Math.PI;
      line.push([w, r*Math.cos(ph)*Math.cos(t), r*Math.cos(ph)*Math.sin(t), r*Math.sin(ph)]); }
    polys.push(line);
  }
  return polys;
}

export function createQuatSphere({ labels = true, axisLength = 8 } = {}) {
  const group = new THREE.Group();
  const params = { theta: 45, axis: 'i', mode: 'left', w: 0.5,
    showSurface: true, showGrid: true, showCircle: true, showPerp: true, showImages: true, showSlice: false };
  let dirty = true;

  group.add(axesLines(axisLength, { ticks: true, opacity: 0.5 }));

  const grid = new DynLines(6000, COLORS.grid, 0.32);
  const slice = new DynLines(6000, COLORS.line, 0.75);
  const circle = new DynLines(800, COLORS.accent);
  const perp = new DynLines(800, COLORS.line);
  group.add(grid.obj, slice.obj, circle.obj, perp.obj);
  const unitGrid = sphereGrid(0, 1);

  // translucent surface, coloured by where each point started
  const SU = 96, SV = 48, NV = (SU+1)*(SV+1);
  const orig = [], pos = new Float32Array(NV*3), col = new Float32Array(NV*3), ok = new Uint8Array(NV);
  for (let v = 0; v <= SV; v++) for (let u = 0; u <= SU; u++) {
    const ph = -Math.PI/2 + v/SV*Math.PI, t = u/SU*2*Math.PI;
    const x = Math.cos(ph)*Math.cos(t), y = Math.cos(ph)*Math.sin(t), z = Math.sin(ph);
    orig.push([0, x, y, z]);
    const hue = ((Math.atan2(y, x)/(2*Math.PI)) + 1) % 1;
    // light theme: curated cyclic palette, a little lighter toward +k and deeper toward −k
    const c = LIGHT_MODE ? ramp(CYCLIC, hue).lerp(new THREE.Color(z > 0 ? '#ffffff' : '#1b2233'), Math.abs(z) * (z > 0 ? 0.3 : 0.18))
                         : new THREE.Color().setHSL(hue, 0.62, 0.5 + 0.16*z);
    const o = orig.length*3 - 3; col[o]=c.r; col[o+1]=c.g; col[o+2]=c.b;
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = new Uint32Array(SU*SV*6);
  sgeo.setIndex(new THREE.BufferAttribute(idx, 1));
  const surface = new THREE.Mesh(sgeo, LIGHT_MODE
    ? new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.5, roughness: 0.45, metalness: 0, side: THREE.DoubleSide, depthWrite: false })
    : new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }));
  surface.frustumCulled = false;
  group.add(surface);

  const dot = (color, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color })); group.add(m); return m; };
  const dot1 = dot(COLORS.pink, 0.075);
  const dotI = dot(COLORS.i, 0.05), dotJ = dot(COLORS.j, 0.05), dotK = dot(COLORS.k, 0.05);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hit);

  const imgLabels = {};
  if (labels) {
    const off = 0.16, add = (t, c, p, h) => { const s = labelSprite(t, c, h); s.position.set(...p); group.add(s); return s; };
    add('1', COLORS.fg, [off, -off, off], 0.3);
    add('i', COLORS.i, [1, off, 0], 0.3);  add('−i', COLORS.i, [-1, off, 0], 0.3);
    add('j', COLORS.j, [0, off, -1], 0.3); add('−j', COLORS.j, [0, off, 1], 0.3);
    add('k', COLORS.k, [off, 1, 0], 0.3);  add('−k', COLORS.k, [off, -1, 0], 0.3);
    imgLabels.one = add('q·1', COLORS.pink, [0,0,0], 0.26);
  }

  const q = () => qFromAngle(QS_AXES[params.axis], params.theta * Math.PI / 180);
  function makeMap() {
    const qq = q(), qi = qconj(qq);
    if (params.mode === 'left') return p => qmul(qq, p);
    if (params.mode === 'right') return p => qmul(p, qq);
    return p => qmul(qmul(qq, p), qi);
  }

  function updateSurface(map) {
    for (let n = 0; n < NV; n++) {
      const v = P(map(orig[n])), o = n*3;
      const good = v && Math.abs(v[0]) < CAP && Math.abs(v[1]) < CAP && Math.abs(v[2]) < CAP;
      ok[n] = good ? 1 : 0;
      if (good) { pos[o]=v[0]; pos[o+1]=v[1]; pos[o+2]=v[2]; } else { pos[o]=pos[o+1]=pos[o+2]=0; }
    }
    const near = (a, b) => {
      const dx = pos[a*3]-pos[b*3], dy = pos[a*3+1]-pos[b*3+1], dz = pos[a*3+2]-pos[b*3+2];
      return dx*dx + dy*dy + dz*dz < JUMP*JUMP;
    };
    let n = 0;
    for (let v = 0; v < SV; v++) for (let u = 0; u < SU; u++) {
      const a = v*(SU+1)+u, b = a+1, c = a+SU+1, d = c+1;
      if (ok[a] && ok[b] && ok[c] && ok[d] && near(a,b) && near(a,c) && near(b,d) && near(c,d)) {
        idx[n++]=a; idx[n++]=c; idx[n++]=b; idx[n++]=b; idx[n++]=c; idx[n++]=d;
      }
    }
    sgeo.setDrawRange(0, n);
    if (LIGHT_MODE) { idx.fill(0, n); sgeo.computeVertexNormals(); }   // shaded surface needs normals
    sgeo.attributes.position.needsUpdate = true;
    sgeo.index.needsUpdate = true;
  }

  const cJ = new THREE.Color(COLORS.j), cK = new THREE.Color(COLORS.k);
  function place(mesh, p, map) {
    const v = P(map(p));
    const good = v && v.every(c => Math.abs(c) < CAP);
    mesh.visible = !!good;
    if (good) mesh.position.set(...v);
    return good;
  }

  function update() {
    if (!dirty) return;
    dirty = false;
    const map = makeMap();
    surface.visible = params.showSurface;
    grid.obj.visible = params.showGrid;
    circle.obj.visible = params.showCircle;
    perp.obj.visible = params.showPerp;
    slice.obj.visible = params.showSlice;
    const mapP = p => P(map(p));
    if (surface.visible) updateSurface(map);
    if (grid.obj.visible) grid.update(unitGrid, mapP, { cap: CAP, jump: JUMP });
    const u = QS_AXES[params.axis], [a, b] = PERP[params.axis];
    const c1 = [], c2 = [];
    for (let s = 0; s <= 720; s++) {
      const t = s/720*2*Math.PI, ct = Math.cos(t), st = Math.sin(t);
      c1.push([ct, st*u[0], st*u[1], st*u[2]]);
      c2.push([0, ct*a[0]+st*b[0], ct*a[1]+st*b[1], ct*a[2]+st*b[2]]);
    }
    if (circle.obj.visible) circle.update([c1], mapP, { cap: CAP, jump: JUMP });
    if (perp.obj.visible) perp.update([c2], mapP, { cap: CAP, jump: JUMP, colorFn: (pi, k) => (Math.floor(k/12) % 2 ? cK : cJ) });
    if (slice.obj.visible) slice.update(sphereGrid(params.w, Math.sqrt(1 - params.w*params.w)), mapP, { cap: CAP, jump: JUMP });

    place(dot1, [1,0,0,0], map);
    hit.position.copy(dot1.position); hit.visible = dot1.visible;
    if (imgLabels.one) { imgLabels.one.visible = dot1.visible; imgLabels.one.position.copy(dot1.position).add(new THREE.Vector3(0, 0.22, 0)); }
    [[dotI,[0,1,0,0]],[dotJ,[0,0,1,0]],[dotK,[0,0,0,1]]].forEach(([m, p]) => { place(m, p, map); if (!params.showImages) m.visible = false; });
  }

  // status text for the current state (shared by lab and VR)
  function status() {
    const t = ((params.theta % 360) + 360) % 360, near = a => Math.abs(t - a) < 0.6;
    if (params.mode === 'conj')
      return { key: 'conj', text: L(`q p q⁻¹ keeps pure quaternions pure, so the sphere stays the unit sphere. It is rotated by 2θ = ${(2*t % 360).toFixed(0)}° about u. The point 1 never moves.`, `q p q⁻¹ 让纯虚四元数保持纯虚，所以球一直是单位球，只是绕 u 转了 2θ = ${(2*t % 360).toFixed(0)}°。点 1 永远不动。`, `q p q⁻¹ mantiene puros los cuaterniones puros, así que la esfera sigue siendo la esfera unidad. Solo gira 2θ = ${(2*t % 360).toFixed(0)}° alrededor de u. El punto 1 nunca se mueve.`, `q p q⁻¹ は純虚四元数を純虚のまま保つので、球はずっと単位球のままで、u のまわりに 2θ = ${(2*t % 360).toFixed(0)}° 回転するだけです。点 1 は動きません。`) };
    if (near(90) || near(270))
      return { key: 'plane', text: L('q has real part 0, so one point of the sphere is sent to −1, the projection point. It goes to infinity and the sphere shows up as a flat plane.', 'q 的实部为 0，球上有一个点被送到 −1（投影点），飞到无穷远，所以球看起来变成一个平面。', 'q tiene parte real 0, así que un punto de la esfera va a −1, el punto de proyección. Se va al infinito y la esfera aparece como un plano.', 'q の実部が 0 なので、球上の 1 点が射影の中心 −1 に送られて無限遠へ飛び、球は平面に見えます。') };
    if (near(0) || near(360))
      return { key: 'home', text: L('q = 1. Nothing has changed.', 'q = 1，什么都没变。', 'q = 1. No ha cambiado nada.', 'q = 1。何も変わっていません。') };
    if (near(180))
      return { key: 'flip', text: L('q = −1. The sphere has its shape back, but every point is on the opposite side (p → −p) and 1 is at infinity. Only at 360° is everything truly home.', 'q = −1。球的形状复原了，但每个点都跑到了正对面（p → −p），1 在无穷远。要到 360° 才真正回家。', 'q = −1. La esfera recupera su forma, pero cada punto está en el lado opuesto (p → −p) y 1 está en el infinito. Solo a 360° todo vuelve de verdad a casa.', 'q = −1。球の形は戻りましたが、すべての点が反対側にあり（p → −p）、1 は無限遠です。360° で初めて本当に元に戻ります。') };
    const st = Math.tan(t * Math.PI / 360);
    return { key: 'move', text: L(`1 has moved to q, which projects to tan(θ/2) = ${Math.abs(st) > 99 ? '∞' : st.toFixed(2)} along the u axis. Part of the sphere now has negative real part, so it is pushed outside the unit ball and the projected sphere grows.`, `1 被送到 q，投影在 u 轴上 tan(θ/2) = ${Math.abs(st) > 99 ? '∞' : st.toFixed(2)} 的位置。球的一部分实部变负，被推到单位球外面，所以投影出来的球变大了。`, `1 se ha movido a q, que se proyecta en tan(θ/2) = ${Math.abs(st) > 99 ? '∞' : st.toFixed(2)} sobre el eje u. Parte de la esfera tiene ahora parte real negativa, sale de la bola unidad y la esfera proyectada crece.`, `1 は q に移り、u 軸上の tan(θ/2) = ${Math.abs(st) > 99 ? '∞' : st.toFixed(2)} の位置に射影されます。球の一部は実部が負になって単位球の外へ押し出され、射影された球は大きくなります。`) };
  }

  return {
    group, params, hit, dot1,
    set(p) { Object.assign(params, p); dirty = true; },
    update, status,
    q,
    axisThree() { const u = QS_AXES[params.axis]; return new THREE.Vector3(...toThree(u)); },
  };
}
