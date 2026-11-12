// Quantum Theory VR: four stations in a ring around the viewer.
// Each station can be brought closer, moved, and its 3D model rotated, panned and zoomed
// with the keyboard, the mouse, or VR controllers (sticks, buttons, grip-to-grab).
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { addLights, fontsReady, COLORS, LIGHT_MODE } from './three-kit.js';
import { createQuatSphere } from './viz/quatSphere.js';
import { createHopf } from './viz/hopf.js';
import { createBlochSphere } from './viz/bloch.js';
import { createEntangle } from './viz/entangle.js';
import { Button3D, buttonConsole, TextPanel } from './vr-ui.js';
import { su2, matVec, blochOf, quatOfSU2, GATES, stateFromAngles, rotate3, cabs2, cfmt, cmul, cconj, cadd, nfmt, concurrence } from './qmath.js';
import { L, lang } from './lang.js';
import { ket00, bellPath, bellCaption, betaState, cnot, ketString, dirXZ, measureOnce, chsh } from './entangleModel.js';

const D2R = Math.PI / 180;
const $ = id => document.getElementById(id);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------- renderer, scene, camera ----------
const container = $('xr');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);
const vrButton = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
vrButton.classList.add('vrbtn');   // a <button>, or an <a> message when VR is unavailable
document.body.appendChild(vrButton);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.stage);
scene.fog = new THREE.Fog(COLORS.stage, 8, 18);
if (LIGHT_MODE) {
  // graduated gray sky: light overhead, mid gray at the horizon, darker below
  const sky = new THREE.SphereGeometry(40, 48, 24), p = sky.attributes.position, col = new Float32Array(p.count * 3);
  const top = new THREE.Color('#f5f6f8'), mid = new THREE.Color('#dde1e7'), low = new THREE.Color('#c3c9d3');
  for (let n = 0; n < p.count; n++) {
    const y = p.getY(n) / 40, c = y > 0 ? mid.clone().lerp(top, Math.pow(y, 0.6)) : mid.clone().lerp(low, Math.min(1, -y * 2));
    col[n*3] = c.r; col[n*3+1] = c.g; col[n*3+2] = c.b;
  }
  sky.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  scene.fog = new THREE.Fog('#dde1e7', 9, 30);
}
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
scene.add(new THREE.PolarGridHelper(4.2, 16, 8, 64, COLORS.floorA, COLORS.floorB));
const disc = new THREE.Mesh(new THREE.CircleGeometry(0.35, 48), new THREE.MeshBasicMaterial({ color: COLORS.floorB }));
disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; scene.add(disc);

if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    $('xrNote').textContent = ok ? '' : L('This browser does not support WebXR VR. You can still look around with the mouse. On a headset, open this same address in a WebXR browser such as the Quest Browser.', 'Este navegador no admite WebXR VR. Aun así puedes mirar alrededor con el ratón. En un visor, abre esta misma dirección en un navegador con WebXR, como Quest Browser.');
    if (!ok) $('xrNote').classList.add('nosupport');
  }).catch(() => {});
} else {
  $('xrNote').textContent = L('This browser has no WebXR. VR needs HTTPS and a WebXR browser; for now you can look around with the mouse.', 'Este navegador no tiene WebXR. La VR necesita HTTPS y un navegador con WebXR; por ahora puedes mirar con el ratón.');
  $('xrNote').classList.add('nosupport');
}

// ---------- station rig ----------
const RADIUS = 2.2, VIZ_Y = 1.5;
const buttons = [];
const tickers = [];
const stations = [];
const RANGE = { dist: [0.7, 6], side: [-3, 3], lift: [-1.0, 1.5], zoom: [0.25, 5], pan: 2.5 };

// One station: a group on the ring (panels + model) and a model group the user can rotate/pan/zoom.
function makeStation(angleDeg, modelPos, modelScale = 1) {
  const a = angleDeg * D2R;
  const S = new THREE.Group();
  S.rotation.y = -a;
  scene.add(S);
  const model = new THREE.Group();
  model.position.set(...modelPos);
  S.add(model);
  // floor marker that lights up when this station is the active one
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.floorA, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2; marker.position.set(modelPos[0], 0.004, 0);
  S.add(marker);
  const st = {
    S, model, marker, angle: a, base: new THREE.Vector3(...modelPos), baseScale: modelScale,
    dist: RADIUS, side: 0, lift: 0, zoom: 1, clips: [],
  };
  st.place = () => {
    st.dist = clamp(st.dist, ...RANGE.dist); st.side = clamp(st.side, ...RANGE.side); st.lift = clamp(st.lift, ...RANGE.lift);
    st.zoom = clamp(st.zoom, ...RANGE.zoom);
    S.position.set(Math.sin(a) * st.dist + Math.cos(a) * st.side, st.lift, -Math.cos(a) * st.dist + Math.sin(a) * st.side);
    model.scale.setScalar(st.baseScale * st.zoom);
    const off = model.position.clone().sub(st.base);
    if (off.length() > RANGE.pan) model.position.copy(st.base).add(off.setLength(RANGE.pan));
  };
  st.reset = () => {
    st.dist = RADIUS; st.side = 0; st.lift = 0; st.zoom = 1;
    model.position.copy(st.base); model.quaternion.identity();
    st.place();
  };
  // rotate the model in the station's frame: yaw about up, pitch about the station's horizontal axis
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  st.rotate = (dyaw, dpitch) => {
    qa.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dyaw);
    qb.setFromAxisAngle(new THREE.Vector3(1, 0, 0), dpitch);
    model.quaternion.premultiply(qb).premultiply(qa);
  };
  st.pan = (dx, dy) => { model.position.x += dx; model.position.y += dy; st.place(); };
  st.place();
  stations.push(st);
  return st;
}
function addConsole(st, rows, x = -0.1) {
  const c = buttonConsole(rows);
  c.position.set(x, 1.0, 0.28);
  st.S.add(c);
  c.userData.buttons.forEach(b => buttons.push(b));
  return c;
}
function addInfo(st, x = 1.08) {
  const p = new TextPanel(0.9, 1.05);
  p.mesh.position.set(x, VIZ_Y + 0.05, 0.12);
  p.mesh.rotation.y = -0.38;
  st.S.add(p.mesh);
  return p;
}
// Keep runaway projected geometry inside a box that moves, turns and scales with the model.
function clipBox(st, obj, center, half) {
  const local = [];
  [[1,0,0],[0,1,0],[0,0,1]].forEach((ax, i) => {
    const n = new THREE.Vector3(...ax), c = new THREE.Vector3(...center).dot(n);
    local.push(new THREE.Plane(n.clone(), half[i] - c), new THREE.Plane(n.clone().negate(), half[i] + c));
  });
  st.clips.push({ obj, local, world: local.map(p => p.clone()) });
}
const nmat = new THREE.Matrix3();
function applyClips() {
  for (const st of stations) for (const job of st.clips) {
    st.model.updateMatrixWorld(true);
    nmat.getNormalMatrix(st.model.matrixWorld);
    job.local.forEach((p, i) => job.world[i].copy(p).applyMatrix4(st.model.matrixWorld, nmat));
    job.obj.traverse(o => {
      const m = o.material; if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.clippingPlanes !== job.world) { mm.clippingPlanes = job.world; mm.needsUpdate = true; } });
    });
  }
}
const fq = (q) => `q = ${nfmt(q[0])} ${q[1] < -0.005 ? '−' : '+'} ${Math.abs(q[1]).toFixed(2)}i ${q[2] < -0.005 ? '−' : '+'} ${Math.abs(q[2]).toFixed(2)}j ${q[3] < -0.005 ? '−' : '+'} ${Math.abs(q[3]).toFixed(2)}k`;
const PLAY = L('Play', 'Reproducir'), PAUSE = L('Pause', 'Pausa');
const ON = L('On', 'Sí'), OFF = L('Off', 'No');

// ---------- station 1: quaternion sphere ----------
function stationQuaternion() {
  const st = makeStation(0, [-0.15, VIZ_Y, 0]);
  const qs = createQuatSphere();
  qs.group.scale.setScalar(0.3);
  st.model.add(qs.group);
  clipBox(st, qs.group, [0, 0, 0], [0.85, 0.75, 0.8]);
  const info = addInfo(st);
  let playing = false;
  const setT = t => qs.set({ theta: ((t % 360) + 360) % 360 });
  const modes = ['left', 'conj', 'right'], modeName = { left: 'q · p', conj: 'q p q⁻¹', right: 'p · q' };
  const axes = ['i', 'j', 'k'];
  const bPlay = new Button3D(PLAY, () => { playing = !playing; bPlay.setLabel(playing ? PAUSE : PLAY); bPlay.setActive(playing); });
  const bMode = new Button3D('q · p', () => { const m = modes[(modes.indexOf(qs.params.mode) + 1) % 3]; qs.set({ mode: m }); bMode.setLabel(modeName[m]); },
    { w: 0.2, sub: L('operation', 'operación') });
  const bAxis = new Button3D('i', () => { const a = axes[(axes.indexOf(qs.params.axis) + 1) % 3]; qs.set({ axis: a }); bAxis.setLabel(a); },
    { w: 0.2, sub: L('axis u', 'eje u') });
  const bSlice = new Button3D(OFF, () => { qs.set({ showSlice: !qs.params.showSlice }); bSlice.setLabel(qs.params.showSlice ? ON : OFF); bSlice.setActive(qs.params.showSlice); },
    { w: 0.2, sub: L('slice w = 0.5', 'corte w = 0,5') });
  const bSurf = new Button3D(ON, () => { qs.set({ showSurface: !qs.params.showSurface }); bSurf.setLabel(qs.params.showSurface ? ON : OFF); },
    { w: 0.2, sub: L('surface', 'superficie') });
  addConsole(st, [
    [new Button3D('−15°', () => setT(qs.params.theta - 15)), bPlay, new Button3D('+15°', () => setT(qs.params.theta + 15)),
     new Button3D('90°', () => setT(90)), new Button3D('180°', () => setT(180)), new Button3D('360°', () => setT(0))],
    [bMode, bAxis, bSlice, bSurf],
  ]);
  tickers.push(dt => {
    if (playing) setT(qs.params.theta + dt * 25);
    qs.update();
    const th = qs.params.theta.toFixed(0), mn = modeName[qs.params.mode], s = qs.status().text;
    info.set({ title: L('1 · Quaternion sphere', '1 · Esfera de cuaterniones'), big: fq(qs.q()),
      body: L(`θ = ${th}°, operation ${mn}\n${s}\n\nMultiply the unit sphere by q, then project from −1. At 90° it becomes a plane, at 180° it has its shape back but every point is on the opposite side, and only at 360° is it home. q p q⁻¹ is a 3D rotation by twice the angle.`, `θ = ${th}°, operación ${mn}\n${s}\n\nMultiplica la esfera unidad por q y proyecta desde −1. A 90° se vuelve un plano, a 180° recupera su forma pero cada punto está en el lado opuesto, y solo a 360° vuelve a casa. q p q⁻¹ es una rotación 3D del doble del ángulo.`) });
  });
}

// ---------- station 2: Hopf fibers ----------
function stationHopf() {
  const st = makeStation(90, [-0.1, VIZ_Y, 0]);
  const H = createHopf({ tubeScale: 1.4 });
  H.s3.scale.setScalar(0.24); H.s3.position.set(-0.45, 0, 0);
  H.bloch.group.scale.setScalar(0.3); H.bloch.group.position.set(0.45, 0, 0);
  st.model.add(H.s3, H.bloch.group);
  clipBox(st, H.s3, [-0.45, 0, 0], [0.5, 0.75, 0.6]);
  const info = addInfo(st, 1.18);
  let playing = true;
  const setP = p => H.set(p);
  const bPlay = new Button3D(PAUSE, () => { playing = !playing; bPlay.setLabel(playing ? PAUSE : PLAY); bPlay.setActive(playing); },
    { sub: L('global phase γ', 'fase global γ') });
  bPlay.setActive(true);
  const famBtns = {};
  const fam = f => { setP({ fam: f }); Object.entries(famBtns).forEach(([k, b]) => b.setActive(k === f)); };
  famBtns.one = new Button3D(L('One state', 'Un estado'), () => fam('one'), { w: 0.2 });
  famBtns.ring = new Button3D(L('Latitude ring', 'Anillo de latitud'), () => fam('ring'), { w: 0.2 });
  famBtns.scatter = new Button3D(L('Many states', 'Muchos estados'), () => fam('scatter'), { w: 0.2 });
  famBtns.one.setActive(true);
  const fiber = L('fiber', 'fibra');
  addConsole(st, [
    [new Button3D('θ −15°', () => setP({ th: clamp(H.params.th - 15, 0, 180) })), new Button3D('θ +15°', () => setP({ th: clamp(H.params.th + 15, 0, 180) })),
     new Button3D('φ −30°', () => setP({ ph: (H.params.ph + 330) % 360 })), new Button3D('φ +30°', () => setP({ ph: (H.params.ph + 30) % 360 })), bPlay],
    [famBtns.one, famBtns.ring, famBtns.scatter,
     new Button3D('|0⟩', () => { fam('one'); setP({ th: 0, ph: 0 }); }, { sub: fiber }),
     new Button3D('|1⟩', () => { fam('one'); setP({ th: 180, ph: 0 }); }, { sub: fiber })],
  ], 0.05);
  tickers.push(dt => {
    if (playing) setP({ ga: (H.params.ga + dt * 40) % 360 });
    H.update();
    const s = H.amplitudes(), pa = cabs2(s[0]);
    info.set({ title: L('2 · Hopf fibers', '2 · Fibras de Hopf'), big: `γ = ${H.params.ga.toFixed(0)}°`,
      body: `a = ${cfmt(s[0])}\nb = ${cfmt(s[1])}\n|a|² = ${pa.toFixed(3)}　|b|² = ${(1 - pa).toFixed(3)}\n\n` + L('γ turns, a and b change, the probabilities do not: physically it is the same state. One full loop of the pink point on the left = one point on the Bloch sphere on the right. Squeezing each loop to a point: 3 − 1 = 2 dimensions.', 'γ gira, a y b cambian, las probabilidades no: físicamente es el mismo estado. Una vuelta completa del punto rosa a la izquierda = un punto de la esfera de Bloch a la derecha. Al reducir cada vuelta a un punto: 3 − 1 = 2 dimensiones.') });
  });
}

// ---------- station 3: gates ----------
function stationGates() {
  const st = makeStation(180, [-0.15, VIZ_Y, 0]);
  const B = createBlochSphere();
  B.group.scale.setScalar(0.45);
  st.model.add(B.group);
  const info = addInfo(st);
  const g = { base: stateFromAngles(0, 0), axis: [0,0,1], alpha: 0, anim: null, last: '' };
  const cur = () => matVec(su2(g.axis, g.alpha), g.base);
  const commit = () => { g.base = cur(); g.alpha = 0; };
  const run = (axis, to, label, speed = Math.PI / 1.1) => {
    if (g.anim) return;
    if (g.alpha > 0) commit();
    g.axis = axis; g.anim = { to, speed, label }; g.last = label;
  };
  const reset = (th, ph) => { g.anim = null; g.base = stateFromAngles(th, ph); g.alpha = 0; g.last = ''; };
  const gate = n => new Button3D(n, () => run(GATES[n].axis, GATES[n].angle, n), { w: 0.12 });
  const aboutY = L('about the y axis', 'alrededor de y');
  addConsole(st, [
    [new Button3D('|0⟩', () => reset(0, 0), { w: 0.12 }), new Button3D('|+⟩', () => reset(Math.PI/2, 0), { w: 0.12 }),
     gate('X'), gate('Y'), gate('Z'), gate('H'), gate('S'), gate('T')],
    [new Button3D('360°', () => run([0,1,0], 2*Math.PI, 'y360', Math.PI/1.4), { w: 0.24, sub: aboutY }),
     new Button3D('720°', () => run([0,1,0], 4*Math.PI, 'y720', Math.PI/1.4), { w: 0.24, sub: aboutY })],
  ]);
  tickers.push(dt => {
    if (g.anim) {
      g.alpha = Math.min(g.anim.to, g.alpha + dt * g.anim.speed);
      if (g.alpha >= g.anim.to - 1e-9) { const isGate = g.anim.label.length === 1; g.anim = null; if (isGate) commit(); }
    }
    const psi = cur(), v0 = blochOf(g.base);
    B.setVector(blochOf(psi));
    B.setAxis(g.alpha > 0.01 ? g.axis : null);
    B.setGhost(g.alpha > 0.01 ? v0 : null);
    const steps = Math.ceil(g.alpha / (2 * D2R));
    const trail = [];
    for (let n = 0; n <= steps; n++) trail.push(rotate3(v0, g.axis, g.alpha * n / Math.max(steps, 1)));
    B.setTrail(trail, g.alpha);
    const q = quatOfSU2(su2(g.axis, g.alpha));
    const ov = cadd(cmul(cconj(g.base[0]), psi[0]), cmul(cconj(g.base[1]), psi[1]));
    const ad = g.alpha / D2R, a0 = ad.toFixed(0), a2 = (ad / 2).toFixed(0);
    let msg = L('Press a gate and watch the arrow turn. Every gate is a unit quaternion q = cos(α/2) + n sin(α/2).', 'Pulsa una puerta y mira cómo gira la flecha. Cada puerta es un cuaternión unitario q = cos(α/2) + n sin(α/2).');
    if (g.anim && g.last.length === 1) { const n = GATES[g.last].note; msg = L(n.en + ' (ignoring a global phase).', n.es + ' (salvo una fase global).'); }
    else if (Math.abs(ad - 360) < 1) msg = L('Turned 360°: the arrow is back, but q = −1 and the state has an extra minus sign (a and b both flip).', 'Giro de 360°: la flecha vuelve, pero q = −1 y el estado tiene un signo menos de más (a y b cambian de signo).');
    else if (Math.abs(ad - 720) < 1) msg = L('Turned 720°: q is back to +1, truly restored. One turn of q = two turns of the sphere.', 'Giro de 720°: q vuelve a +1 y todo se recupera de verdad. Una vuelta de q = dos vueltas de la esfera.');
    else if (ad > 1) msg = L(`The sphere turns α = ${a0}°; the quaternion uses α/2 = ${a2}°.`, `La esfera gira α = ${a0}°; el cuaternión usa α/2 = ${a2}°.`);
    info.set({ title: L('3 · Gates = rotations', '3 · Puertas = rotaciones'), big: fq(q),
      body: `${msg}\n\na = ${cfmt(psi[0])}\nb = ${cfmt(psi[1])}\n${L('compared with before', 'comparado con antes')}: ${cfmt(ov)}\nP(0) = ${cabs2(psi[0]).toFixed(2)}　P(1) = ${cabs2(psi[1]).toFixed(2)}` });
  });
}

// ---------- station 4: entanglement ----------
function stationEntangle() {
  const st = makeStation(270, [-0.25, VIZ_Y + 0.38, 0]);
  const E = createEntangle();
  E.group.scale.setScalar(0.3);
  st.model.add(E.group);
  const info = addInfo(st, 1.12);
  const e = { psi: ket00(), saved: null, anim: null, beta: 0, ta: 0, tb: 0, note: bellCaption(0), result: '', chsh: '' };
  const setPsi = (psi, keep = false) => { e.psi = psi; if (!keep) { e.saved = null; e.result = ''; } };
  const angles = [0, 45, 90, 135];
  const bA = new Button3D('0°', () => { e.ta = angles[(angles.indexOf(e.ta) + 1) % 4]; bA.setLabel(e.ta + '°'); }, { sub: L('A direction', 'dirección A') });
  const bB = new Button3D('0°', () => { e.tb = angles[(angles.indexOf(e.tb) + 1) % 4]; bB.setLabel(e.tb + '°'); }, { sub: L('B direction', 'dirección B') });
  const beta = d => {
    e.anim = null; e.beta = clamp(e.beta + d, 0, 180); setPsi(betaState(e.beta * D2R));
    e.note = L(`Turn A by β = ${e.beta}°, then CNOT. β = 90° gives the most entanglement.`, `Gira A un ángulo β = ${e.beta}° y luego CNOT. β = 90° da el máximo entrelazamiento.`);
  };
  addConsole(st, [
    [new Button3D('|00⟩', () => { e.anim = null; e.beta = 0; setPsi(ket00()); e.note = bellCaption(0); e.chsh = ''; }),
     new Button3D(L('Bell state', 'Estado de Bell'), () => { e.beta = 0; setPsi(ket00()); e.anim = { u: 0, pause: 0 }; e.chsh = ''; },
       { w: 0.2, sub: L('H then CNOT', 'H y luego CNOT') }),
     new Button3D('β −15°', () => beta(-15)), new Button3D('β +15°', () => beta(15)),
     new Button3D('CNOT', () => { e.anim = null; setPsi(cnot(e.psi)); e.note = L('CNOT: flips B in the term where A is 1.', 'CNOT: invierte B en el término donde A es 1.'); })],
    [bA, bB,
     new Button3D(L('Measure', 'Medir'), () => {
       const base = e.saved || e.psi;
       const m = measureOnce(base, e.ta * D2R, e.tb * D2R);
       const s = i => (i ? '−' : '+'), same = m.ia === m.ib;
       setPsi(m.psi, true); e.saved = base;
       e.result = L(`Result: A ${s(m.ia)}, B ${s(m.ib)} ${same ? '(same)' : '(different)'}. The arrows jump back to the sphere; the entanglement is used up.`, `Resultado: A ${s(m.ia)}, B ${s(m.ib)} ${same ? '(iguales)' : '(distintos)'}. Las flechas vuelven a la esfera; el entrelazamiento se ha gastado.`);
     }),
     new Button3D(L('Restore', 'Restaurar'), () => { if (e.saved) setPsi(e.saved); }, { sub: L('pre-measurement', 'antes de medir') }),
     new Button3D('CHSH', () => {
       const r = chsh(e.saved || e.psi, 1000), S2 = r.S.toFixed(2), over = Math.abs(r.S) > 2.05;
       e.chsh = L(`CHSH: S = ${S2} (classical limit 2, quantum up to 2√2 ≈ 2.83)${over ? '. Above the classical limit!' : ''}`, `CHSH: S = ${S2} (límite clásico 2, cuántico hasta 2√2 ≈ 2,83)${over ? '. ¡Supera el límite clásico!' : ''}`);
     }, { sub: L('4 × 1000 runs', '4 × 1000 veces') })],
  ]);
  tickers.push(dt => {
    if (e.anim) {
      const a = e.anim;
      if (a.pause > 0) a.pause -= dt;
      else {
        const before = a.u;
        a.u = Math.min(2, a.u + dt * 0.5);
        if (before < 1 && a.u >= 1) { a.u = 1; a.pause = 1.2; }
        setPsi(bellPath(a.u)); e.note = bellCaption(a.u);
        if (a.u >= 2) e.anim = null;
      }
    }
    E.set(e.psi);
    E.setMeasure(dirXZ(e.ta * D2R), dirXZ(e.tb * D2R));
    E.tick(dt);
    const C = Math.min(1, concurrence(e.psi));
    info.set({ title: L('4 · Entanglement', '4 · Entrelazamiento'), big: ketString(e.psi),
      body: `${L('Entanglement C', 'Entrelazamiento C')} = ${C.toFixed(2)}\n${e.note}\n${e.result}\n${e.chsh}\n\n` + L('Arrow length = how definite each qubit is on its own. The more entangled, the more the arrows shrink toward the centre. Dashed white lines are the measurement directions.', 'Longitud de la flecha = cuán definido es cada cúbit por sí solo. Cuanto más entrelazado, más se encogen hacia el centro. Las líneas blancas discontinuas son las direcciones de medida.') });
  });
}

// ---------- which station is active (the one you are facing) ----------
let active = null;
const fwd = new THREE.Vector3(), tmpP = new THREE.Vector3();
function updateActive() {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const eye = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
  let best = null, bestDot = -2;
  for (const st of stations) {
    st.model.getWorldPosition(tmpP); tmpP.sub(eye); tmpP.y = 0; tmpP.normalize();
    const d = tmpP.dot(fwd);
    if (d > bestDot) { bestDot = d; best = st; }
  }
  if (best !== active) {
    active = best;
    stations.forEach(s => { s.marker.material.color.set(s === active ? COLORS.accent : COLORS.floorA); });
  }
}

// ---------- continuous manipulation (keyboard and sticks share these rates) ----------
const RATE = { move: 1.2, rot: 1.6, zoom: 1.0, pan: 0.8 };   // m/s, rad/s, ×e^(rate·s), m/s
function manipulate(st, { dist = 0, side = 0, lift = 0, yaw = 0, pitch = 0, zoom = 0, panX = 0, panY = 0 }, dt) {
  if (!st) return;
  st.dist += dist * RATE.move * dt; st.side += side * RATE.move * dt; st.lift += lift * RATE.move * dt;
  st.zoom *= Math.exp(zoom * RATE.zoom * dt);
  if (yaw || pitch) st.rotate(yaw * RATE.rot * dt, pitch * RATE.rot * dt);
  if (panX || panY) st.pan(panX * RATE.pan * dt / st.zoom, panY * RATE.pan * dt / st.zoom);
  st.place();
}

// keyboard
const keys = new Set();
const isTyping = e => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
window.addEventListener('keydown', e => {
  if (isTyping(e)) return;
  const k = e.key.toLowerCase();
  if (['1', '2', '3', '4'].includes(e.key)) { faceStation(+e.key - 1); return; }
  if (e.key === '0' || e.key === ')') { if (e.shiftKey) stations.forEach(s => s.reset()); else active && active.reset(); return; }
  if (k === 'h' || e.key === '?') { toggleHelp(); return; }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys.add(k);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
function keyboardTick(dt) {
  if (!keys.size) return;
  const has = k => keys.has(k) ? 1 : 0;
  // turn the view (desktop)
  const turn = has('q') - has('e');
  if (turn && !renderer.xr.isPresenting) { yaw += turn * 1.4 * dt; applyLook(); }
  manipulate(active, {
    dist: has('s') - has('w'),
    side: has('d') - has('a'),
    lift: has('r') - has('f'),
    yaw: has('arrowright') - has('arrowleft'),
    pitch: has('arrowdown') - has('arrowup'),
    zoom: (has('=') || has('+')) - (has('-') || has('_')),
    panX: has('l') - has('j'),
    panY: has('i') - has('k'),
  }, dt);
}

// ---------- pointer: buttons, look, rotate/pan/zoom with the mouse ----------
const ray = new THREE.Raycaster();
const targets = () => buttons.map(b => b.mesh);
const hovered = new Set();
const cv = renderer.domElement;
const ndc = new THREE.Vector2();
let mouseHover = null, drag = null;
function mousePick(e) {
  const r = cv.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(targets(), false)[0];
  return hit ? hit.object.userData.button : null;
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  // left = look (or click a button), right or shift+left = rotate model, middle or ctrl+left = pan model
  const mode = e.button === 2 || (e.button === 0 && e.shiftKey) ? 'rotate'
    : e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey)) ? 'pan' : 'look';
  drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, mode, moved: false };
  cv.setPointerCapture(e.pointerId);
  if (e.button === 1) e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!drag) { mouseHover = mousePick(e); return; }
  const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
  drag.lx = e.clientX; drag.ly = e.clientY;
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) { drag.moved = true; cv.classList.add('dragging'); }
  if (!drag.moved) return;
  if (drag.mode === 'look') { yaw += dx * 0.004; pitch = clamp(pitch + dy * 0.004, -1.2, 1.2); applyLook(); }
  else if (drag.mode === 'rotate' && active) { active.rotate(dx * 0.01, dy * 0.01); }
  else if (drag.mode === 'pan' && active) { active.pan(dx * 0.003 / active.zoom, -dy * 0.003 / active.zoom); }
});
cv.addEventListener('pointerup', e => {
  if (drag && !drag.moved && drag.mode === 'look') { const b = mousePick(e); if (b) b.press(); }
  drag = null; cv.classList.remove('dragging');
});
cv.addEventListener('pointerleave', () => { mouseHover = null; });
cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (!active) return;
  const s = Math.sign(e.deltaY);
  if (e.shiftKey) { active.dist += s * 0.15; } else { active.zoom *= Math.exp(-s * 0.1); }
  active.place();
}, { passive: false });

// turn buttons in the HUD: smoothly face a station
let turnTo = null;
function faceStation(n) {
  let target = -(n * 90) * D2R;
  while (target - yaw > Math.PI) target -= 2 * Math.PI;
  while (target - yaw < -Math.PI) target += 2 * Math.PI;
  turnTo = target; pitch = -0.08;
}
$('turn').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) faceStation(+b.dataset.a / 90); });
$('resetAll').addEventListener('click', () => stations.forEach(s => s.reset()));
const helpBox = $('help');
function toggleHelp() {
  helpBox.open = !helpBox.open;
  if (helpPanel) helpPanel.mesh.visible = !helpPanel.mesh.visible;
}

// ---------- VR controllers ----------
const factory = new XRControllerModelFactory();
const grabs = new Map();     // controller -> grab record
let helpPanel = null;
const controllers = [0, 1].map(i => {
  const c = renderer.xr.getController(i);
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.8 }));
  line.scale.z = 4; c.add(line);
  c.userData.line = line;
  c.userData.prev = [];
  c.addEventListener('connected', e => { c.userData.source = e.data; if (e.data.handedness === 'left') attachHelp(grip); });
  c.addEventListener('disconnected', () => { c.userData.source = null; grabs.delete(c); });
  c.addEventListener('selectstart', () => { const b = c.userData.hover; if (b) b.press(); });
  c.addEventListener('squeezestart', () => startGrab(c));
  c.addEventListener('squeezeend', () => endGrab(c));
  scene.add(c);
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(factory.createControllerModel(grip));
  scene.add(grip);
  return c;
});

// grab: the model nearest the controller ray, else the active one
const tmpM = new THREE.Matrix4(), rayDir = new THREE.Vector3(), rayO = new THREE.Vector3();
function stationForController(c) {
  rayO.setFromMatrixPosition(c.matrixWorld);
  tmpM.identity().extractRotation(c.matrixWorld);
  rayDir.set(0, 0, -1).applyMatrix4(tmpM);
  let best = active, bestD = 0.9;
  for (const st of stations) {
    st.model.getWorldPosition(tmpP);
    const t = Math.max(0, tmpP.clone().sub(rayO).dot(rayDir));
    const d = rayO.clone().addScaledVector(rayDir, t).distanceTo(tmpP);
    if (d < bestD) { bestD = d; best = st; }
  }
  return best;
}
function snapshot(c, st) {
  return { st, ctrl0: c.matrixWorld.clone(), model0: st.model.matrixWorld.clone() };
}
function startGrab(c) {
  const st = stationForController(c); if (!st) return;
  const other = [...grabs.entries()].find(([k, v]) => k !== c && v.st === st);
  const rec = snapshot(c, st);
  if (other) {
    const pa = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld), pb = new THREE.Vector3().setFromMatrixPosition(other[0].matrixWorld);
    rec.two = { partner: other[0], d0: Math.max(pa.distanceTo(pb), 0.05), zoom0: st.zoom };
  }
  grabs.set(c, rec);
}
function endGrab(c) {
  const rec = grabs.get(c); grabs.delete(c);
  if (!rec) return;
  // the remaining hand continues a one-hand grab from where things are now
  for (const [k, v] of grabs) if (v.st === rec.st) grabs.set(k, snapshot(k, v.st));
}
const mWorld = new THREE.Matrix4(), mInv = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
function grabTick() {
  for (const [c, g] of grabs) {
    const st = g.st;
    if (g.two) {
      const pa = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld), pb = new THREE.Vector3().setFromMatrixPosition(g.two.partner.matrixWorld);
      st.zoom = g.two.zoom0 * pa.distanceTo(pb) / g.two.d0;
      st.place();
      continue;
    }
    if ([...grabs.values()].some(v => v !== g && v.st === st && v.two)) continue;   // a two-hand scale is in charge
    // model world = controller now × controller at grab⁻¹ × model at grab
    mWorld.copy(c.matrixWorld).multiply(mInv.copy(g.ctrl0).invert()).multiply(g.model0);
    st.S.updateMatrixWorld(true);
    mWorld.premultiply(mInv.copy(st.S.matrixWorld).invert());
    mWorld.decompose(pos, quat, scl);
    st.model.position.copy(pos); st.model.quaternion.copy(quat);
    st.place();
  }
}

// sticks and face buttons
function gamepadTick(dt) {
  for (const c of controllers) {
    const src = c.userData.source, gp = src && src.gamepad;
    if (!gp) continue;
    const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0] || 0, gp.axes[1] || 0];
    const dz = v => (Math.abs(v) < 0.15 ? 0 : v);
    const x = dz(ax[0]), y = dz(ax[1]);
    const pressed = n => !!(gp.buttons[n] && gp.buttons[n].pressed);
    const prev = c.userData.prev;
    const edge = n => pressed(n) && !prev[n];
    const target = grabs.get(c)?.st || active;
    if (src.handedness === 'left') {
      manipulate(target, { side: x, lift: -y }, dt);          // left stick: move the station
      if (edge(4)) target && target.reset();                   // X: reset
      if (edge(5)) toggleHelp();                               // Y: help
    } else {
      manipulate(target, { dist: y, yaw: x }, dt);             // right stick: closer / farther, rotate
      manipulate(target, { zoom: pressed(4) - pressed(5) }, dt); // A / B: zoom in / out
    }
    c.userData.prev = gp.buttons.map(b => b.pressed);
  }
}

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

// help card on the left controller
const HELP = L('Trigger: press a button\nGrip: grab and move / turn the model you point at; grip with both hands to resize\nRight stick ↑↓: bring the station closer / push it away; ←→: rotate the model\nLeft stick: move the station left / right / up / down\nA / B: zoom the model in / out\nX: reset this station · Y: hide this card', 'Gatillo: pulsar un botón\nAgarre: toma el modelo al que apuntas para moverlo y girarlo; con las dos manos cambias su tamaño\nStick derecho ↑↓: acercar / alejar la estación; ←→: girar el modelo\nStick izquierdo: mover la estación a izquierda / derecha / arriba / abajo\nA / B: ampliar / reducir el modelo\nX: restablecer esta estación · Y: ocultar esta tarjeta');
function attachHelp(grip) {
  if (helpPanel) return;
  helpPanel = new TextPanel(0.3, 0.27, { title: L('Controls', 'Controles'), titleSize: 0.022, size: 0.0135, px: 2000, mathTitle: false });
  helpPanel.set({ body: HELP });
  helpPanel.mesh.position.set(0, 0.06, -0.2);
  helpPanel.mesh.rotation.x = -0.9;
  grip.add(helpPanel.mesh);
}

// ---------- build and run ----------
fontsReady().then(() => {
  stationQuaternion();
  stationHopf();
  stationGates();
  stationEntangle();

  // labels on the floor pointing at each station
  L(['1 Quaternions', '2 Hopf fibers', '3 Gates', '4 Entanglement'], ['1 Cuaterniones', '2 Fibras de Hopf', '3 Puertas', '4 Entrelazamiento']).forEach((t, n) => {
    const p = new TextPanel(0.7, 0.12, { title: t, titleSize: 0.065, bg: 'rgba(0,0,0,0)', mathTitle: false, titleColor: COLORS.muted });
    p.set({});
    const a = n * 90 * D2R;
    p.mesh.position.set(Math.sin(a) * 1.0, 0.01, -Math.cos(a) * 1.0);
    p.mesh.rotation.set(-Math.PI / 2, -a, 0, 'YXZ');
    scene.add(p.mesh);
  });

  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (turnTo !== null) {
      yaw += (turnTo - yaw) * Math.min(1, dt * 6); applyLook();
      if (Math.abs(turnTo - yaw) < 0.002) turnTo = null;
    }
    updateActive();
    keyboardTick(dt);
    gamepadTick(dt);
    grabTick();
    for (const t of tickers) t(dt);
    applyClips();
    hovered.clear();
    controllerHover();
    if (!renderer.xr.isPresenting && mouseHover) hovered.add(mouseHover);
    for (const b of buttons) { b.setHover(hovered.has(b)); b.tick(dt); }
    renderer.render(scene, camera);
  });
});

// exposed for automated checks
window.__qtl = { stations, get active() { return active; }, lang };
