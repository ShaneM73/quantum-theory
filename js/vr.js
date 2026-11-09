// Quantum Theory VR: four stations in a ring around the viewer.
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { addLights, fontsReady, COLORS } from './three-kit.js';
import { createQuatSphere } from './viz/quatSphere.js';
import { createHopf } from './viz/hopf.js';
import { createBlochSphere } from './viz/bloch.js';
import { createEntangle } from './viz/entangle.js';
import { Button3D, buttonConsole, TextPanel } from './vr-ui.js';
import { su2, matVec, blochOf, quatOfSU2, GATES, stateFromAngles, rotate3, cabs2, cfmt, cmul, cconj, cadd, nfmt, concurrence } from './qmath.js';
import { L } from './lang.js';
import { ket00, bellPath, bellCaption, betaState, cnot, ketString, dirXZ, measureOnce, chsh } from './entangleModel.js';

const D2R = Math.PI / 180;
const $ = id => document.getElementById(id);

// ---------- renderer, scene, camera ----------
const container = $('xr');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }));

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.stage);
scene.fog = new THREE.Fog(COLORS.stage, 7, 16);
addLights(scene);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.02, 100);
camera.position.set(0, 1.6, 0);
let yaw = 0, pitch = -0.08;
const applyLook = () => camera.rotation.set(pitch, yaw, 0, 'YXZ');
applyLook();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// floor
const floor = new THREE.PolarGridHelper(4.2, 16, 8, 64, 0x2a3242, 0x1b2230);
scene.add(floor);
const disc = new THREE.Mesh(new THREE.CircleGeometry(0.35, 48), new THREE.MeshBasicMaterial({ color: 0x1b2230 }));
disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; scene.add(disc);

if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    $('xrNote').textContent = ok ? '' : L('This browser does not support WebXR VR. You can still look around with the mouse. On a headset, open this same address in a WebXR browser such as the Quest Browser.', '这个浏览器不支持 WebXR VR，可以先用鼠标浏览。头显里请用 Quest 浏览器等打开同一个网址。');
    if (!ok) $('xrNote').classList.add('nosupport');
  }).catch(() => {});
} else {
  $('xrNote').textContent = L('This browser has no WebXR. VR needs HTTPS and a WebXR browser; for now you can look around with the mouse.', '这个浏览器没有 WebXR。需要 HTTPS 和支持 WebXR 的浏览器才能进入 VR；现在可以用鼠标浏览。');
  $('xrNote').classList.add('nosupport');
}

// ---------- station scaffolding ----------
const RADIUS = 2.2, VIZ_Y = 1.5;
const buttons = [];
const tickers = [];
const clipJobs = [];

function makeStation(angleDeg) {
  const a = angleDeg * D2R;
  const g = new THREE.Group();
  g.position.set(Math.sin(a) * RADIUS, 0, -Math.cos(a) * RADIUS);
  g.rotation.y = -a;
  scene.add(g);
  return g;
}
function addConsole(station, rows, x = -0.1) {
  const c = buttonConsole(rows);
  c.position.set(x, 1.0, 0.28);
  station.add(c);
  c.userData.buttons.forEach(b => buttons.push(b));
  return c;
}
function addInfo(station, w = 0.9, h = 1.05) {
  const p = new TextPanel(w, h);
  p.mesh.position.set(1.08, VIZ_Y + 0.05, 0.12);
  p.mesh.rotation.y = -0.38;
  station.add(p.mesh);
  return p;
}
// keep runaway projected geometry (planes, lines through infinity) inside a box around the station
function clipTo(station, obj, center, half) {
  station.updateMatrixWorld(true);
  const q = new THREE.Quaternion(); station.getWorldQuaternion(q);
  const c = station.localToWorld(new THREE.Vector3(...center));
  const planes = [];
  [[1,0,0],[0,1,0],[0,0,1]].forEach((ax, i) => {
    const n = new THREE.Vector3(...ax).applyQuaternion(q);
    const h = half[i], d = n.dot(c);
    planes.push(new THREE.Plane(n.clone(), h - d), new THREE.Plane(n.clone().negate(), h + d));
  });
  clipJobs.push({ obj, planes });
}
function applyClips() {
  for (const { obj, planes } of clipJobs) obj.traverse(o => {
    const m = o.material; if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.clippingPlanes !== planes) { mm.clippingPlanes = planes; mm.needsUpdate = true; } });
  });
}
const fq = (q) => `q = ${nfmt(q[0])} ${q[1] < -0.005 ? '−' : '+'} ${Math.abs(q[1]).toFixed(2)}i ${q[2] < -0.005 ? '−' : '+'} ${Math.abs(q[2]).toFixed(2)}j ${q[3] < -0.005 ? '−' : '+'} ${Math.abs(q[3]).toFixed(2)}k`;

// ---------- station 1: quaternion sphere ----------
function stationQuaternion() {
  const S = makeStation(0);
  const qs = createQuatSphere();
  qs.group.scale.setScalar(0.3);
  qs.group.position.set(-0.15, VIZ_Y, 0);
  S.add(qs.group);
  clipTo(S, qs.group, [-0.15, VIZ_Y, 0], [0.85, 0.75, 0.8]);
  const info = addInfo(S);
  let playing = false;
  const setT = t => qs.set({ theta: ((t % 360) + 360) % 360 });
  const modes = ['left', 'conj', 'right'], modeName = { left: 'q · p', conj: 'q p q⁻¹', right: 'p · q' };
  const axes = ['i', 'j', 'k'];
  const bPlay = new Button3D(L('Play', '播放'), () => { playing = !playing; bPlay.setLabel(playing ? L('Pause', '暂停') : L('Play', '播放')); bPlay.setActive(playing); });
  const bMode = new Button3D('q · p', () => { const m = modes[(modes.indexOf(qs.params.mode) + 1) % 3]; qs.set({ mode: m }); bMode.setLabel(modeName[m]); }, { w: 0.2, sub: L('operation', '运算') });
  const bAxis = new Button3D('i', () => { const a = axes[(axes.indexOf(qs.params.axis) + 1) % 3]; qs.set({ axis: a }); bAxis.setLabel(a); }, { w: 0.2, sub: L('axis u', '转轴 u') });
  const bSlice = new Button3D(L('Off', '关'), () => { qs.set({ showSlice: !qs.params.showSlice }); bSlice.setLabel(qs.params.showSlice ? L('On', '开') : L('Off', '关')); bSlice.setActive(qs.params.showSlice); }, { w: 0.2, sub: L('slice w = 0.5', '洋葱层 w=0.5') });
  const bSurf = new Button3D(L('On', '开'), () => { qs.set({ showSurface: !qs.params.showSurface }); bSurf.setLabel(qs.params.showSurface ? L('On', '开') : L('Off', '关')); }, { w: 0.2, sub: L('surface', '球面') });
  addConsole(S, [
    [new Button3D('−15°', () => setT(qs.params.theta - 15)), bPlay, new Button3D('+15°', () => setT(qs.params.theta + 15)),
     new Button3D('90°', () => setT(90)), new Button3D('180°', () => setT(180)), new Button3D('360°', () => setT(0))],
    [bMode, bAxis, bSlice, bSurf],
  ]);
  tickers.push(dt => {
    if (playing) setT(qs.params.theta + dt * 25);
    qs.update();
    info.set({ title: L('1 · Quaternion sphere', '1 · 四元数球'), big: fq(qs.q()), body: L(`θ = ${qs.params.theta.toFixed(0)}°, operation ${modeName[qs.params.mode]}\n${qs.status().text}\n\nMultiply the unit sphere by q, then project from −1. At 90° it becomes a plane, at 180° it has its shape back but every point is on the opposite side, and only at 360° is it home. q p q⁻¹ is a 3D rotation by twice the angle.`, `θ = ${qs.params.theta.toFixed(0)}°，运算 ${modeName[qs.params.mode]}\n${qs.status().text}\n\n把单位球乘以 q，再从 −1 投影。90° 时变平面，180° 形状复原但点都到了对面，360° 才回家。q p q⁻¹ 是三维旋转，角度翻倍。`) });
  });
}

// ---------- station 2: Hopf fibers ----------
function stationHopf() {
  const S = makeStation(90);
  const H = createHopf({ tubeScale: 1.4 });
  H.s3.scale.setScalar(0.24);
  H.s3.position.set(-0.55, VIZ_Y, 0);
  H.bloch.group.scale.setScalar(0.3);
  H.bloch.group.position.set(0.35, VIZ_Y, 0);
  S.add(H.s3, H.bloch.group);
  clipTo(S, H.s3, [-0.55, VIZ_Y, 0], [0.5, 0.75, 0.6]);
  const info = addInfo(S);
  info.mesh.position.x = 1.18;
  let playing = true;
  const setP = p => H.set(p);
  const bPlay = new Button3D(L('Pause', '暂停'), () => { playing = !playing; bPlay.setLabel(playing ? L('Pause', '暂停') : L('Play', '播放')); bPlay.setActive(playing); }, { sub: L('global phase γ', '整体相位 γ') });
  bPlay.setActive(true);
  const famBtns = {};
  const fam = f => { setP({ fam: f }); Object.entries(famBtns).forEach(([k, b]) => b.setActive(k === f)); };
  famBtns.one = new Button3D(L('One state', '一个态'), () => fam('one'), { w: 0.2 });
  famBtns.ring = new Button3D(L('Latitude ring', '一圈纬线'), () => fam('ring'), { w: 0.2 });
  famBtns.scatter = new Button3D(L('Many states', '很多态'), () => fam('scatter'), { w: 0.2 });
  famBtns.one.setActive(true);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  addConsole(S, [
    [new Button3D('θ −15°', () => setP({ th: clamp(H.params.th - 15, 0, 180) })), new Button3D('θ +15°', () => setP({ th: clamp(H.params.th + 15, 0, 180) })),
     new Button3D('φ −30°', () => setP({ ph: (H.params.ph + 330) % 360 })), new Button3D('φ +30°', () => setP({ ph: (H.params.ph + 30) % 360 })), bPlay],
    [famBtns.one, famBtns.ring, famBtns.scatter,
     new Button3D('|0⟩', () => { fam('one'); setP({ th: 0, ph: 0 }); }, { sub: L('fiber', '的纤维') }), new Button3D('|1⟩', () => { fam('one'); setP({ th: 180, ph: 0 }); }, { sub: L('fiber', '的纤维') })],
  ], 0.05);
  tickers.push(dt => {
    if (playing) setP({ ga: (H.params.ga + dt * 40) % 360 });
    H.update();
    const s = H.amplitudes(), pa = cabs2(s[0]);
    info.set({ title: L('2 · Hopf fibers', '2 · 霍普夫纤维'), big: `γ = ${H.params.ga.toFixed(0)}°`,
      body: `a = ${cfmt(s[0])}\nb = ${cfmt(s[1])}\n|a|² = ${pa.toFixed(3)}　|b|² = ${(1 - pa).toFixed(3)}\n\n` +
        L('γ turns, a and b change, the probabilities do not: physically it is the same state. One full loop of the pink point on the left = one point on the Bloch sphere on the right. Squeezing each loop to a point: 3 − 1 = 2 dimensions.', 'γ 在转，a、b 在变，概率不变：物理上是同一个态。左边粉色点绕一整圈 = 右边布洛赫球上一个点。每圈缩成一点：3 − 1 = 2 维。') });
  });
}

// ---------- station 3: gates ----------
function stationGates() {
  const S = makeStation(180);
  const B = createBlochSphere();
  B.group.scale.setScalar(0.45);
  B.group.position.set(-0.15, VIZ_Y, 0);
  S.add(B.group);
  const info = addInfo(S);
  const st = { base: stateFromAngles(0, 0), axis: [0,0,1], alpha: 0, anim: null, last: '' };
  const cur = () => matVec(su2(st.axis, st.alpha), st.base);
  const commit = () => { st.base = cur(); st.alpha = 0; };
  const run = (axis, to, label, speed = Math.PI / 1.1) => {
    if (st.anim) return;
    if (st.alpha > 0) commit();
    st.axis = axis; st.anim = { to, speed, label }; st.last = label;
  };
  const reset = (th, ph) => { st.anim = null; st.base = stateFromAngles(th, ph); st.alpha = 0; st.last = ''; };
  const gate = g => new Button3D(g, () => run(GATES[g].axis, GATES[g].angle, g), { w: 0.12 });
  addConsole(S, [
    [new Button3D('|0⟩', () => reset(0, 0), { w: 0.12 }), new Button3D('|+⟩', () => reset(Math.PI/2, 0), { w: 0.12 }),
     gate('X'), gate('Y'), gate('Z'), gate('H'), gate('S'), gate('T')],
    [new Button3D('360°', () => run([0,1,0], 2*Math.PI, 'y360', Math.PI/1.4), { w: 0.24, sub: L('about the y axis', '绕 y 轴转') }),
     new Button3D('720°', () => run([0,1,0], 4*Math.PI, 'y720', Math.PI/1.4), { w: 0.24, sub: L('about the y axis', '绕 y 轴转') })],
  ]);
  tickers.push(dt => {
    if (st.anim) {
      st.alpha = Math.min(st.anim.to, st.alpha + dt * st.anim.speed);
      if (st.alpha >= st.anim.to - 1e-9) {
        const isGate = st.anim.label.length === 1;
        st.anim = null;
        if (isGate) commit();
      }
    }
    const psi = cur(), v0 = blochOf(st.base);
    B.setVector(blochOf(psi));
    B.setAxis(st.alpha > 0.01 ? st.axis : null);
    B.setGhost(st.alpha > 0.01 ? v0 : null);
    B.clearTrail();
    const steps = Math.ceil(st.alpha / (2 * D2R));
    for (let n = 0; n <= steps; n++) B.pushTrail(rotate3(v0, st.axis, st.alpha * n / Math.max(steps, 1)));
    const q = quatOfSU2(su2(st.axis, st.alpha));
    const ov = cadd(cmul(cconj(st.base[0]), psi[0]), cmul(cconj(st.base[1]), psi[1]));
    const ad = st.alpha / D2R;
    let msg = L('Press a gate and watch the arrow turn. Every gate is a unit quaternion q = cos(α/2) + n sin(α/2).', '点一个门看箭头怎么转。每个门都是一个单位四元数 q = cos(α/2) + n sin(α/2)。');
    if (st.anim && st.last.length === 1) msg = L(GATES[st.last].note.en + ' (ignoring a global phase).', GATES[st.last].note.zh + '（去掉整体相位）。');
    else if (Math.abs(ad - 360) < 1) msg = L('Turned 360°: the arrow is back, but q = −1 and the state has an extra minus sign (a and b both flip).', '转了 360°：箭头回到原处，但 q = −1，状态多了一个负号（a、b 都变号）。');
    else if (Math.abs(ad - 720) < 1) msg = L('Turned 720°: q is back to +1, truly restored. One turn of q = two turns of the sphere.', '转了 720°：q 回到 +1，这次真正复原。q 转一圈 = 球转两圈。');
    else if (ad > 1) msg = L(`The sphere turns α = ${ad.toFixed(0)}°; the quaternion uses α/2 = ${(ad/2).toFixed(0)}°.`, `球上转 α = ${ad.toFixed(0)}°，四元数里写 α/2 = ${(ad/2).toFixed(0)}°。`);
    info.set({ title: L('3 · Gates = rotations', '3 · 量子门 = 旋转'), big: fq(q),
      body: `${msg}\n\na = ${cfmt(psi[0])}\nb = ${cfmt(psi[1])}\n${L('compared with before', '和转之前比')}: ${cfmt(ov)}\nP(0) = ${cabs2(psi[0]).toFixed(2)}　P(1) = ${cabs2(psi[1]).toFixed(2)}` });
  });
}

// ---------- station 4: entanglement ----------
function stationEntangle() {
  const S = makeStation(270);
  const E = createEntangle();
  E.group.scale.setScalar(0.3);
  E.group.position.set(-0.25, VIZ_Y + 0.38, 0);
  S.add(E.group);
  const info = addInfo(S);
  info.mesh.position.x = 1.12;
  const st = { psi: ket00(), saved: null, anim: null, beta: 0, ta: 0, tb: 0, note: bellCaption(0), result: '', chsh: '' };
  const setPsi = (psi, keep = false) => { st.psi = psi; if (!keep) { st.saved = null; st.result = ''; } };
  const angles = [0, 45, 90, 135];
  const bA = new Button3D('0°', () => { st.ta = angles[(angles.indexOf(st.ta) + 1) % 4]; bA.setLabel(st.ta + '°'); }, { sub: L('A direction', 'A 测量方向') });
  const bB = new Button3D('0°', () => { st.tb = angles[(angles.indexOf(st.tb) + 1) % 4]; bB.setLabel(st.tb + '°'); }, { sub: L('B direction', 'B 测量方向') });
  const beta = d => { st.anim = null; st.beta = Math.max(0, Math.min(180, st.beta + d)); setPsi(betaState(st.beta * D2R)); st.note = L(`Turn A by β = ${st.beta}°, then CNOT. β = 90° gives the most entanglement.`, `先把 A 转 β = ${st.beta}°，再 CNOT。β = 90° 纠缠最强。`); };
  addConsole(S, [
    [new Button3D('|00⟩', () => { st.anim = null; st.beta = 0; setPsi(ket00()); st.note = bellCaption(0); st.chsh = ''; }),
     new Button3D(L('Bell state', '贝尔态'), () => { st.beta = 0; setPsi(ket00()); st.anim = { u: 0, pause: 0 }; st.chsh = ''; }, { w: 0.2, sub: L('H then CNOT', 'H 然后 CNOT') }),
     new Button3D('β −15°', () => beta(-15)), new Button3D('β +15°', () => beta(15)),
     new Button3D('CNOT', () => { st.anim = null; setPsi(cnot(st.psi)); st.note = L('CNOT: flips B in the term where A is 1.', 'CNOT：A 是 1 的那一项里翻转 B。'); })],
    [bA, bB,
     new Button3D(L('Measure', '测一次'), () => {
       const base = st.saved || st.psi;
       const m = measureOnce(base, st.ta * D2R, st.tb * D2R);
       const s = i => (i ? '−' : '+');
       setPsi(m.psi, true); st.saved = base;
       st.result = L(`Result: A ${s(m.ia)}, B ${s(m.ib)} ${m.ia === m.ib ? '(same)' : '(different)'}. The arrows jump back to the sphere; the entanglement is used up.`, `测量结果：A ${s(m.ia)}，B ${s(m.ib)}${m.ia === m.ib ? '（相同）' : '（不同）'}。箭头跳回球面，纠缠被用掉了。`);
     }),
     new Button3D(L('Restore', '恢复'), () => { if (st.saved) { setPsi(st.saved); } }, { sub: L('pre-measurement', '测量前') }),
     new Button3D('CHSH', () => {
       const r = chsh(st.saved || st.psi, 1000);
       st.chsh = L(`CHSH: S = ${r.S.toFixed(2)} (classical limit 2, quantum up to 2√2 ≈ 2.83)${Math.abs(r.S) > 2.05 ? '. Above the classical limit!' : ''}`, `CHSH：S = ${r.S.toFixed(2)}（经典上限 2，量子最多 2√2 ≈ 2.83）${Math.abs(r.S) > 2.05 ? '，超过了经典上限！' : ''}`);
     }, { sub: L('4 × 1000 runs', '4×1000 次') })],
  ]);
  tickers.push(dt => {
    if (st.anim) {
      const a = st.anim;
      if (a.pause > 0) a.pause -= dt;
      else {
        const before = a.u;
        a.u = Math.min(2, a.u + dt * 0.5);
        if (before < 1 && a.u >= 1) { a.u = 1; a.pause = 1.2; }
        setPsi(bellPath(a.u)); st.note = bellCaption(a.u);
        if (a.u >= 2) st.anim = null;
      }
    }
    E.set(st.psi);
    E.setMeasure(dirXZ(st.ta * D2R), dirXZ(st.tb * D2R));
    E.tick(dt);
    const C = Math.min(1, concurrence(st.psi));
    info.set({ title: L('4 · Entanglement', '4 · 量子纠缠'), big: ketString(st.psi),
      body: `${L('Entanglement C', '纠缠度 C')} = ${C.toFixed(2)}\n${st.note}\n${st.result}\n${st.chsh}\n\n${L('Arrow length = how definite each qubit is on its own. The more entangled, the more the arrows shrink toward the centre. Dashed white lines are the measurement directions.', '箭头长度 = 单个比特有多确定。纠缠越强，箭头越往球心缩。白色虚线是测量方向。')}` });
  });
}

// ---------- interaction ----------
const ray = new THREE.Raycaster();
const targets = () => buttons.map(b => b.mesh);
const hovered = new Set();

const factory = new XRControllerModelFactory();
const controllers = [0, 1].map(i => {
  const c = renderer.xr.getController(i);
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.8 }));
  line.scale.z = 4; c.add(line);
  c.userData.line = line;
  c.addEventListener('selectstart', () => { const b = c.userData.hover; if (b) b.press(); });
  scene.add(c);
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(factory.createControllerModel(grip));
  scene.add(grip);
  return c;
});
const tmpM = new THREE.Matrix4();
function controllerHover() {
  for (const c of controllers) {
    c.userData.hover = null;
    if (!renderer.xr.isPresenting) continue;
    tmpM.identity().extractRotation(c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(c.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
    const hit = ray.intersectObjects(targets(), false)[0];
    c.userData.line.scale.z = hit ? hit.distance : 4;
    if (hit) { c.userData.hover = hit.object.userData.button; hovered.add(c.userData.hover); }
  }
}

// desktop: drag to look, click to press
const cv = renderer.domElement;
const ndc = new THREE.Vector2();
let mouseHover = null, down = null;
function mousePick(e) {
  const r = cv.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(targets(), false)[0];
  return hit ? hit.object.userData.button : null;
}
cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (down) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { down.moved = true; cv.classList.add('dragging'); }
    if (down.moved) {
      yaw = down.yaw + dx * 0.004; pitch = Math.max(-1.2, Math.min(1.2, down.pitch + dy * 0.004)); applyLook();
    }
  } else mouseHover = mousePick(e);
});
cv.addEventListener('pointerup', e => {
  if (down && !down.moved) { const b = mousePick(e); if (b) b.press(); }
  down = null; cv.classList.remove('dragging');
});
cv.addEventListener('pointerleave', () => { mouseHover = null; });
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { yaw += 0.1; applyLook(); }
  if (e.key === 'ArrowRight') { yaw -= 0.1; applyLook(); }
});
// turn buttons: smoothly face a station
let turnTo = null;
$('turn').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  let target = -(+b.dataset.a) * D2R;
  while (target - yaw > Math.PI) target -= 2*Math.PI;
  while (target - yaw < -Math.PI) target += 2*Math.PI;
  turnTo = target; pitch = -0.08;
});

// ---------- build and run ----------
fontsReady().then(() => {
  stationQuaternion();
  stationHopf();
  stationGates();
  stationEntangle();

  // arrows on the floor pointing at each station
  const labelsRing = L(['1 Quaternions', '2 Hopf fibers', '3 Gates', '4 Entanglement'], ['1 四元数', '2 霍普夫', '3 量子门', '4 纠缠']);
  labelsRing.forEach((t, n) => {
    const p = new TextPanel(0.6, 0.12, { title: t, titleSize: 0.07, bg: 'rgba(0,0,0,0)', mathTitle: false, titleColor: COLORS.muted });
    p.set({});
    const a = n * 90 * D2R;
    p.mesh.position.set(Math.sin(a) * 1.0, 0.01, -Math.cos(a) * 1.0);
    p.mesh.rotation.set(-Math.PI/2, -a, 0, 'YXZ');
    scene.add(p.mesh);
  });

  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (turnTo !== null) {
      yaw += (turnTo - yaw) * Math.min(1, dt * 6); applyLook();
      if (Math.abs(turnTo - yaw) < 0.002) turnTo = null;
    }
    for (const t of tickers) t(dt);
    applyClips();
    hovered.clear();
    controllerHover();
    if (!renderer.xr.isPresenting && mouseHover) hovered.add(mouseHover);
    for (const b of buttons) { b.setHover(hovered.has(b)); b.tick(dt); }
    renderer.render(scene, camera);
  });
});
