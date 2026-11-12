import { createStage, fontsReady, COLORS, prefersReducedMotion } from '../three-kit.js';
import { createBlochSphere } from '../viz/bloch.js';
import {
  su2, matVec, blochOf, quatOfSU2, qmul, GATES, stateFromAngles, rotate3, cfmt, cabs2, cmul, cconj, cadd, nfmt,
} from '../qmath.js';
import { $, segmented, deg, loop } from './ui.js';
import { L } from '../lang.js';

const D2R = Math.PI / 180, R2 = Math.SQRT1_2;
const AXES = { x: [1,0,0], y: [0,1,0], z: [0,0,1], h: [R2,0,R2] };
const AXIS_NAME = L({ x: 'the x axis', y: 'the y axis', z: 'the z axis', h: 'the (x+z)/√2 axis' }, { x: 'el eje x', y: 'el eje y', z: 'el eje z', h: 'el eje (x+z)/√2' });
const INITS = {
  '0': [0, 0], '1': [Math.PI, 0], '+': [Math.PI/2, 0], '-': [Math.PI/2, Math.PI], '+i': [Math.PI/2, Math.PI/2],
};

const stage = createStage($('view'), { camPos: [2.3, 1.6, 3.1] });
let bloch;
const st = {
  base: stateFromAngles(0, 0),   // state before the current rotation
  axisKey: 'z', axis: AXES.z,
  alpha: 0,                       // Bloch rotation angle (radians)
  qtot: [1, 0, 0, 0],
  hist: [],
  anim: null,                     // { to, speed, gate }
};
let setAxisSeg;

const current = () => matVec(su2(st.axis, st.alpha), st.base);
const qOf = (axis, alpha) => quatOfSU2(su2(axis, alpha));

// ---------- SVG dials ----------
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function dialFrame(svg) {
  svg.innerHTML = '';
  svg.append(svgEl('circle', { cx: 0, cy: 0, r: 50, fill: 'none', stroke: COLORS.dialRing, 'stroke-width': 1.5 }));
  svg.append(svgEl('line', { x1: -56, y1: 0, x2: 56, y2: 0, stroke: COLORS.dialAxis }));
  svg.append(svgEl('line', { x1: 0, y1: -56, x2: 0, y2: 56, stroke: COLORS.dialAxis }));
}
function hand(svg, x, y, color, { dashed = false, width = 3 } = {}) {
  svg.append(svgEl('line', { x1: 0, y1: 0, x2: x, y2: -y, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', ...(dashed ? { 'stroke-dasharray': '4 4', opacity: 0.6 } : {}) }));
  if (!dashed) svg.append(svgEl('circle', { cx: x, cy: -y, r: 4, fill: color }));
}
function drawDials(psi) {
  const a = st.alpha;
  const dA = $('dAngle'); dialFrame(dA);
  // angles measured from the top, clockwise
  const H = (ang, r) => [r*Math.sin(ang), r*Math.cos(ang)];
  hand(dA, ...H(a, 48), COLORS.accent);
  hand(dA, ...H(a/2, 32), COLORS.pink);
  const amp = (svg, z, z0, color) => {
    dialFrame(svg);
    hand(svg, z0[0]*50, z0[1]*50, COLORS.ghost, { dashed: true, width: 2 });
    hand(svg, z[0]*50, z[1]*50, color);
  };
  amp($('dA'), psi[0], st.base[0], COLORS.k);
  amp($('dB'), psi[1], st.base[1], COLORS.j);
  $('aV').textContent = cfmt(psi[0]); $('bV').textContent = cfmt(psi[1]);
}

const qhtml = q => `<span class="w">${nfmt(q[0])}</span> <span class="i">${q[1] < -0.005 ? '−' : '+'} ${Math.abs(q[1]).toFixed(2)}<i>i</i></span> <span class="j">${q[2] < -0.005 ? '−' : '+'} ${Math.abs(q[2]).toFixed(2)}<i>j</i></span> <span class="k">${q[3] < -0.005 ? '−' : '+'} ${Math.abs(q[3]).toFixed(2)}<i>k</i></span>`;

function render() {
  const psi = current();
  const v0 = blochOf(st.base), v = blochOf(psi);
  bloch.setVector(v);
  bloch.setGhost(st.alpha > 0.01 ? v0 : null);
  bloch.setAxis(st.alpha > 0.01 || st.anim ? st.axis : null);
  const steps = Math.ceil(st.alpha / (1.5*D2R));
  const trail = [];
  for (let n = 0; n <= steps; n++) trail.push(rotate3(v0, st.axis, st.alpha * n / Math.max(steps, 1)));
  bloch.setTrail(trail, st.alpha);

  const q = qOf(st.axis, st.alpha);
  $('qnow').innerHTML = 'q = ' + qhtml(q);
  $('qtot').innerHTML = L('q<sub>total</sub> = ', 'q<sub>total</sub> = ') + qhtml(qmul(q, st.qtot));
  $('alphaOut').textContent = deg((st.alpha / D2R).toFixed(0));
  $('alpha').value = Math.round(st.alpha / D2R);
  drawDials(psi);

  const ov = cadd(cmul(cconj(st.base[0]), psi[0]), cmul(cconj(st.base[1]), psi[1]));   // <base|now>
  const ad = st.alpha / D2R;
  const p0 = cabs2(psi[0]);
  let s;
  if (st.anim && st.anim.gate) { const g = st.anim.gate, n = GATES[g].note; s = `<b>${g}</b>: ` + L(`${n.en} (the real ${g} gate = this rotation × a global phase).`, `${n.es} (la puerta ${g} real = esta rotación × una fase global).`); }
  else if (Math.abs(ad - 360) < 1) s = L('<b>Turned 360°</b>: the arrow is back where it started, but q = −1 and both a and b have flipped sign.', '<b>Giro de 360°</b>: la flecha vuelve a su sitio, pero q = −1 y tanto a como b han cambiado de signo.');
  else if (Math.abs(ad - 720) < 1) s = L('<b>Turned 720°</b>: q is back to +1. This time everything is truly restored.', '<b>Giro de 720°</b>: q vuelve a +1. Esta vez todo se recupera de verdad.');
  else if (ad < 0.5) s = L('Pick a gate, or drag the α slider, and watch the arrow turn.', 'Elige una puerta o mueve el control α y mira cómo gira la flecha.');
  else s = L(`Rotating α = ${ad.toFixed(0)}° about ${AXIS_NAME[st.axisKey]}. The quaternion uses α/2 = ${(ad/2).toFixed(0)}°.`, `Girando α = ${ad.toFixed(0)}° alrededor de ${AXIS_NAME[st.axisKey]}. El cuaternión usa α/2 = ${(ad/2).toFixed(0)}°.`);
  $('status').innerHTML = `${s}<br>${L(`P(measure 0) = ${p0.toFixed(2)}, P(measure 1) = ${(1 - p0).toFixed(2)}.`, `P(medir 0) = ${p0.toFixed(2)}, P(medir 1) = ${(1 - p0).toFixed(2)}.`)}`;
  $('sign').innerHTML = L('Compared with before: ⟨ψ<sub>before</sub>|ψ<sub>now</sub>⟩ = ', 'Comparado con antes: ⟨ψ<sub>antes</sub>|ψ<sub>ahora</sub>⟩ = ') + `<span class="mono" style="color:var(--fg)">${cfmt(ov)}</span>` +
    (Math.abs(ov[0] + 1) < 0.01 ? ` <b style="color:var(--pink)">${L('an extra minus sign', 'un signo menos de más')}</b>` : '');
  $('hist').innerHTML = st.hist.length ? st.hist.map(h => `<span>${h}</span>`).join('') : '<span class="muted" style="background:none;border:0;padding:0">' + L('none yet', 'ninguna todavía') + '</span>';
}

function commit(label) {
  st.qtot = qmul(qOf(st.axis, st.alpha), st.qtot);
  st.base = current();
  if (label) st.hist.push(label);
  st.alpha = 0;
  render();
}
function setAxis(key) { st.axisKey = key; st.axis = AXES[key]; setAxisSeg && setAxisSeg(key); }

function runGate(g) {
  if (st.alpha > 0.01) commit(`R${st.axisKey}(${Math.round(st.alpha/D2R)}°)`);
  const G = GATES[g];
  st.axis = G.axis; st.axisKey = g === 'H' ? 'h' : ({ X: 'x', Y: 'y', Z: 'z', S: 'z', T: 'z' })[g];
  setAxisSeg(st.axisKey);
  if (prefersReducedMotion()) { st.alpha = G.angle; commit(g); return; }
  st.anim = { to: G.angle, speed: Math.PI / 1.1, gate: g };
}

fontsReady().then(() => {
  bloch = createBlochSphere({ labels: true });
  stage.scene.add(bloch.group);
  setAxisSeg = segmented('axisSeg', v => { if (st.alpha > 0.01) commit(`R${st.axisKey}(${Math.round(st.alpha/D2R)}°)`); setAxis(v); render(); });

  $('inits').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    st.anim = null; st.base = stateFromAngles(...INITS[b.dataset.s]); st.alpha = 0; st.qtot = [1,0,0,0]; st.hist = [];
    render();
  });
  $('gates').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b && !st.anim) runGate(b.dataset.g); });
  $('alpha').addEventListener('input', e => { st.anim = null; st.alpha = +e.target.value * D2R; render(); });
  document.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { st.anim = null; st.alpha = +b.dataset.a * D2R; render(); }));
  $('spin').addEventListener('click', () => { st.alpha = 0; st.anim = { to: 4*Math.PI, speed: Math.PI / 1.6 }; });
  $('commit').addEventListener('click', () => { if (st.alpha > 0.01) commit(`R${st.axisKey}(${Math.round(st.alpha/D2R)}°)`); });
  render();
});

loop(dt => {
  if (bloch && st.anim) {
    st.alpha = Math.min(st.anim.to, st.alpha + dt * st.anim.speed);
    const done = st.alpha >= st.anim.to - 1e-9;
    const g = st.anim.gate;
    if (done) { st.anim = null; if (g) commit(g); else render(); }
    else render();
  }
  stage.render();
});
