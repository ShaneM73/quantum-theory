// Small three.js helpers shared by the lab pages and the VR page.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Theme is set on <html data-theme> by js/i18n.js before modules run: 'dark' (default) or 'light'.
export const THEME = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
const DARK = {
  stage: '#07090d', fg: '#e7ebf2', muted: '#8d97a8', accent: '#f0d24a', pink: '#ff6fd8',
  i: '#7ee08a', j: '#ff9b6b', k: '#6fc3ff', axis: '#8a94a6',
  labelStroke: 'rgba(7,9,13,0.9)',
  grid: '#dfe7f2', line: '#ffffff', soft: '#c9d3e2', shell: '#3a4a63', ghost: '#9aa4b5', base: '#1b2230',
  // VR panels and buttons
  panel: 'rgba(16,20,28,0.88)', panelText: '#c3cad6', panelBorder: '#262e3b',
  btn: '#1b2230', btnHover: '#2a3445', btnActive: '#3a3420', btnBorder: '#3a4558', btnPressedText: '#0d1016', plate: '#10141c',
  floorA: '#2a3242', floorB: '#1b2230',
  // gates dials
  dialRing: '#3a4558', dialAxis: '#262e3b',
};
const LIGHT = {
  stage: '#e3e7ec', fg: '#161b26', muted: '#5b6474', accent: '#c79200', pink: '#d6249f',
  i: '#1f9d3a', j: '#e0622a', k: '#1f7fd1', axis: '#7a8496',
  labelStroke: 'rgba(255,255,255,0.95)',
  grid: '#3b4658', line: '#161b26', soft: '#4a5568', shell: '#b9c6db', ghost: '#8a94a6', base: '#dfe4ec',
  panel: 'rgba(255,255,255,0.95)', panelText: '#2a3140', panelBorder: '#d5dbe5',
  btn: '#eef1f6', btnHover: '#e2e8f1', btnActive: '#fbefc4', btnBorder: '#c3cbd8', btnPressedText: '#ffffff', plate: '#e6eaf0',
  floorA: '#b7bfcc', floorB: '#d3d8e0',
  dialRing: '#b9c2cf', dialAxis: '#dde2ea',
};
export const COLORS = THEME === 'light' ? LIGHT : DARK;
// how much meshes glow in their own colour: strong on black, low on white so colours stay saturated
export const GLOW = THEME === 'light' ? 0.08 : 0.4;
export const LIGHT_MODE = THEME === 'light';

// ---- colour maps used by the light (figure) theme ----
// Cyclic: for angles and phases (longitude, φ, phase of an amplitude). Ends where it starts.
export const CYCLIC = ['#3b6fd8', '#6f5bd6', '#b24fb6', '#e0577a', '#ef8445', '#e6b532', '#78b85a', '#2c9f9a', '#3b6fd8'];
// Diverging: for the Bloch sphere's latitude, |1⟩ (coral) → equator (near white) → |0⟩ (blue).
export const DIVERGING = ['#e4663f', '#f2a27c', '#f6ddcf', '#eef0f6', '#cfdcf3', '#8fb2ea', '#3d74d6'];
// Sample a list of colour stops at t in [0, 1].
export function ramp(stops, t) {
  const n = stops.length - 1, x = Math.min(Math.max(t, 0), 1) * n, i = Math.min(Math.floor(x), n - 1);
  return new THREE.Color(stops[i]).lerp(new THREE.Color(stops[i + 1]), x - i);
}
// Solid material: matte with a self-glow on black; softly glossy and shaded on white.
export function solidMaterial(color, glow = 1) {
  const c = new THREE.Color(color);
  return LIGHT_MODE
    ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0.05 })
    : new THREE.MeshLambertMaterial({ color: c, emissive: c.clone().multiplyScalar(0.4 * glow) });
}

export const MATH_FONT = 'Newsreader, Georgia, "Times New Roman", serif';
export const UI_FONT = document.documentElement.getAttribute('data-lang') === 'ja'
  ? '"IBM Plex Sans", "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", system-ui, sans-serif'
  : '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';

export const fontsReady = () =>
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).catch(() => {});

// A text sprite that always faces the camera.
export function labelSprite(text, color = COLORS.fg, height = 0.3, { italic = true, font = MATH_FONT } = {}) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const px = 84;
  const f = `${italic ? 'italic ' : ''}500 ${px}px ${font}`;
  g.font = f;
  const w = Math.ceil(g.measureText(text).width) + 40;
  cv.width = w; cv.height = 128;
  g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = COLORS.labelStroke; g.strokeText(text, w/2, 66);
  g.fillStyle = color; g.fillText(text, w/2, 66);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(height * w / 128, height, 1);
  sp.renderOrder = 10;
  return sp;
}

export function axesLines(L, { ticks = false, opacity = 0.45, color = COLORS.axis, tick = 0.05 } = {}) {
  const pts = [];
  [[1,0,0],[0,1,0],[0,0,1]].forEach(d => {
    pts.push(-L*d[0], -L*d[1], -L*d[2], L*d[0], L*d[1], L*d[2]);
    if (ticks) for (let n = -Math.floor(L); n <= L; n++) {
      if (!n) continue;
      const o = d[0] ? [0, tick, 0] : [tick, 0, 0];
      pts.push(n*d[0]-o[0], n*d[1]-o[1], n*d[2]-o[2], n*d[0]+o[0], n*d[1]+o[1], n*d[2]+o[2]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

// A growable set of line segments whose positions are recomputed from polylines each update.
export class DynLines {
  constructor(maxSegs, color, opacity = 1) {
    this.max = maxSegs;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(maxSegs * 6);
    this.col = new Float32Array(maxSegs * 6);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.base = new THREE.Color(color);
    this.obj = new THREE.LineSegments(this.geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
    this.obj.frustumCulled = false;
  }
  // polys: arrays of points; map(p) -> [x,y,z] in three coords or null. colorFn(polyIdx, ptIdx) -> THREE.Color
  update(polys, map, { cap = 28, jump = 6, colorFn } = {}) {
    let n = 0;
    const P = this.pos, C = this.col;
    for (let pi = 0; pi < polys.length; pi++) {
      let prev = null, prevC = null;
      const poly = polys[pi];
      for (let k = 0; k < poly.length; k++) {
        const v = map(poly[k]);
        const ok = v && Math.abs(v[0]) < cap && Math.abs(v[1]) < cap && Math.abs(v[2]) < cap;
        const c = colorFn ? colorFn(pi, k) : this.base;
        if (ok && prev && n < this.max) {
          const dx = v[0]-prev[0], dy = v[1]-prev[1], dz = v[2]-prev[2];
          if (dx*dx + dy*dy + dz*dz < jump*jump) {
            const o = n * 6;
            P[o]=prev[0]; P[o+1]=prev[1]; P[o+2]=prev[2]; P[o+3]=v[0]; P[o+4]=v[1]; P[o+5]=v[2];
            C[o]=prevC.r; C[o+1]=prevC.g; C[o+2]=prevC.b; C[o+3]=c.r; C[o+4]=c.g; C[o+5]=c.b;
            n++;
          }
        }
        prev = ok ? v : null; prevC = c;
      }
    }
    this.geo.setDrawRange(0, n * 2);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// An arrow made of meshes (lines are 1px in WebGL, too thin for VR).
export function makeArrow(color, { shaft = 0.018, head = 0.055, headLen = 0.14 } = {}) {
  const group = new THREE.Group();
  const mat = solidMaterial(color, 1.1);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(shaft, shaft, 1, 12), mat);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(head, headLen, 20), mat);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(head * 0.8, 16, 12), mat);
  group.add(cyl, cone, ball);
  const up = new THREE.Vector3(0, 1, 0);
  group.userData.set = (v3) => {
    const L = v3.length();
    ball.visible = L < headLen * 1.2;
    cyl.visible = cone.visible = !ball.visible;
    if (L < 1e-6) { ball.position.set(0,0,0); return; }
    group.quaternion.setFromUnitVectors(up, v3.clone().normalize());
    const sl = Math.max(L - headLen, 0.0001);
    cyl.scale.set(1, sl, 1); cyl.position.set(0, sl/2, 0);
    cone.position.set(0, L - headLen/2, 0);
    ball.position.set(0, 0, 0);
  };
  group.userData.setColor = (c) => { mat.color.set(c); if (mat.emissive && !LIGHT_MODE) mat.emissive.set(c).multiplyScalar(0.44); };
  return group;
}

export function addLights(scene) {
  if (THEME === 'light') {
    // studio lighting for figures: soft sky/ground fill, a warm key light and a cool rim light
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dee8, 1.6));
    const key = new THREE.DirectionalLight(0xfff4e8, 1.9); key.position.set(3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe9ff, 0.8); rim.position.set(-4, 2, -3); scene.add(rim);
    return;
  }
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const d = new THREE.DirectionalLight(0xffffff, 1.6);
  d.position.set(3, 5, 4); scene.add(d);
}

// A full-size renderer + camera + orbit controls inside a container element (lab pages).
export function createStage(el, { camPos = [3.4, 2.4, 5.6], target = [0, 0, 0], fov = 42, minDist = 1.2, maxDist = 60 } = {}) {
  // light theme: transparent canvas over the CSS gray gradient (screenshots capture both)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: LIGHT_MODE, preserveDrawingBuffer: LIGHT_MODE });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (LIGHT_MODE) renderer.setClearColor(0x000000, 0); else renderer.setClearColor(new THREE.Color(COLORS.stage));
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  addLights(scene);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.02, 400);
  camera.position.set(...camPos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = minDist; controls.maxDistance = maxDist;
  const baseLen = new THREE.Vector3(...camPos).sub(new THREE.Vector3(...target)).length();
  const stage = { el, renderer, scene, camera, controls };
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // narrow screens: pull back so the subject fits
    const ar = w / h, want = baseLen * (ar < 0.6 ? 1.6 : ar < 1 ? 1.35 : 1);
    const off = camera.position.clone().sub(controls.target);
    if (off.length() < want) camera.position.copy(controls.target).add(off.setLength(want));
  };
  new ResizeObserver(resize).observe(el);
  resize();
  stage.render = () => { controls.update(); renderer.render(scene, camera); };
  // pointer helper: returns a raycaster aimed at the pointer
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  stage.aim = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
  };
  return stage;
}

export const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
