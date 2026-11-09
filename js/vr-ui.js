// In-world UI for the VR page: canvas-textured buttons and text panels.
import * as THREE from 'three';
import { UI_FONT, MATH_FONT, COLORS } from './three-kit.js';

const PX_DEFAULT = 700; // canvas pixels per metre

function canvasPlane(w, h, px = PX_DEFAULT) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * px); cv.height = Math.round(h * px);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return { cv, g: cv.getContext('2d'), tex, mesh, px };
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export class Button3D {
  constructor(label, onClick, { w = 0.17, h = 0.085, sub = '' } = {}) {
    Object.assign(this, canvasPlane(w, h));
    this.label = label; this.sub = sub; this.onClick = onClick;
    this.hover = false; this.active = false; this.flash = 0;
    this.mesh.userData.button = this;
    this.draw();
  }
  setLabel(label, sub = this.sub) { if (label !== this.label || sub !== this.sub) { this.label = label; this.sub = sub; this.draw(); } }
  setActive(a) { if (a !== this.active) { this.active = a; this.draw(); } }
  setHover(h) { if (h !== this.hover) { this.hover = h; this.draw(); } }
  press() { this.flash = 0.18; this.draw(); this.onClick && this.onClick(this); }
  tick(dt) { if (this.flash > 0) { this.flash -= dt; if (this.flash <= 0) this.draw(); } }
  draw() {
    const { g, cv } = this, W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const pressed = this.flash > 0;
    roundRect(g, 4, 4, W - 8, H - 8, H * 0.22);
    g.fillStyle = pressed ? COLORS.accent : this.active ? COLORS.btnActive : this.hover ? COLORS.btnHover : COLORS.btn;
    g.fill();
    g.lineWidth = 5; g.strokeStyle = this.hover || this.active ? COLORS.accent : COLORS.btnBorder; g.stroke();
    g.fillStyle = pressed ? COLORS.btnPressedText : COLORS.fg;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const hasSub = !!this.sub;
    let size = H * (hasSub ? 0.38 : 0.44);
    g.font = `600 ${size}px ${UI_FONT}`;
    while (g.measureText(this.label).width > W * 0.88 && size > 10) { size -= 2; g.font = `600 ${size}px ${UI_FONT}`; }
    g.fillText(this.label, W/2, hasSub ? H * 0.4 : H * 0.53);
    if (hasSub) {
      g.font = `400 ${H * 0.2}px ${UI_FONT}`; g.fillStyle = pressed ? COLORS.btnPressedText : COLORS.muted;
      g.fillText(this.sub, W/2, H * 0.74);
    }
    this.tex.needsUpdate = true;
  }
}

// Lays buttons out in rows on a slanted console. rows: arrays of Button3D.
export function buttonConsole(rows, { gap = 0.018, tilt = -0.55 } = {}) {
  const group = new THREE.Group();
  let y = 0;
  const all = [];
  rows.forEach(row => {
    const h = Math.max(...row.map(b => b.mesh.geometry.parameters.height));
    const total = row.reduce((s, b) => s + b.mesh.geometry.parameters.width, 0) + gap * (row.length - 1);
    let x = -total / 2;
    row.forEach(b => {
      const w = b.mesh.geometry.parameters.width;
      b.mesh.position.set(x + w/2, y - h/2, 0);
      group.add(b.mesh); all.push(b);
      x += w + gap;
    });
    y -= h + gap;
  });
  // backing plate
  const plateH = -y + gap, plateW = Math.max(...rows.map(r => r.reduce((s, b) => s + b.mesh.geometry.parameters.width, 0) + gap * (r.length + 1)));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateH), new THREE.MeshBasicMaterial({ color: COLORS.plate, transparent: true, opacity: 0.85 }));
  plate.position.set(0, y/2 + gap/2, -0.004);
  group.add(plate);
  group.rotation.x = tilt;
  group.userData.buttons = all;
  return group;
}

// Wrapped text (works for Chinese: breaks between any characters, prefers spaces for Latin).
function wrap(g, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    // a Latin word with its trailing spaces, or a single CJK character / punctuation mark
    const tokens = para.match(/[^\s\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]+\s*|\s+|./gu) || [''];
    for (const tok of tokens) {
      const test = line + tok;
      if (g.measureText(test).width <= maxW || (/^[，。：；、！？）」』,.;:!?)]$/.test(tok) && line)) { line = test; continue; }
      if (line) lines.push(line.trimEnd());
      if (g.measureText(tok).width <= maxW) { line = tok.trimStart(); continue; }
      line = '';
      for (const ch of tok) { if (g.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch; }
    }
    lines.push(line);
  }
  return lines;
}

export class TextPanel {
  constructor(w, h, { title = '', titleColor = COLORS.accent, bg = COLORS.panel, size = 0.036, titleSize = 0.06, mathTitle = true, px = PX_DEFAULT } = {}) {
    Object.assign(this, canvasPlane(w, h, px));
    this.opts = { titleColor, bg, size, titleSize, mathTitle };
    this.title = title; this.body = ''; this.big = '';
  }
  set({ title = this.title, body = this.body, big = this.big } = {}) {
    if (title === this.title && body === this.body && big === this.big && this.drawn) return;
    this.title = title; this.body = body; this.big = big; this.drawn = true;
    const { g, cv } = this, PX = this.px, W = cv.width, H = cv.height, o = this.opts, pad = 0.035 * PX;
    g.clearRect(0, 0, W, H);
    roundRect(g, 3, 3, W - 6, H - 6, 0.03 * PX); g.fillStyle = o.bg; g.fill();
    g.lineWidth = 3; g.strokeStyle = COLORS.panelBorder; g.stroke();
    let y = pad;
    g.textBaseline = 'top'; g.textAlign = 'left';
    if (this.title) {
      g.font = `${o.mathTitle ? 'italic 400' : '600'} ${o.titleSize * PX}px ${o.mathTitle ? MATH_FONT : UI_FONT}`;
      g.fillStyle = o.titleColor; g.fillText(this.title, pad, y); y += o.titleSize * PX * 1.25;
    }
    if (this.big) {
      g.font = `italic 400 ${o.size * 1.45 * PX}px ${MATH_FONT}`;
      g.fillStyle = COLORS.fg; g.fillText(this.big, pad, y); y += o.size * 1.45 * PX * 1.35;
    }
    g.font = `400 ${o.size * PX}px ${UI_FONT}`; g.fillStyle = COLORS.panelText;
    for (const line of wrap(g, this.body, W - 2*pad)) {
      if (y + o.size * PX > H - pad * 0.5) break;
      g.fillText(line, pad, y); y += o.size * PX * 1.45;
    }
    this.tex.needsUpdate = true;
  }
}
