// Core math: quaternions, complex numbers, single-qubit SU(2), two-qubit states.
// Pure functions only — shared by every lab page and the VR page.

// ---------- quaternions [w, x, y, z] = w + x i + y j + z k ----------
export const qmul = (a, b) => [
  a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
  a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
  a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
  a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
];
export const qconj = q => [q[0], -q[1], -q[2], -q[3]];
export const qnorm = q => Math.hypot(q[0], q[1], q[2], q[3]);

// Unit quaternion cos(angle) + sin(angle) u  (the video's convention: angle is q's own angle)
export function qFromAngle(u, angle) {
  const s = Math.sin(angle);
  return [Math.cos(angle), s*u[0], s*u[1], s*u[2]];
}

// Stereographic projection of a unit quaternion from -1 into (i, j, k) space.
export function stereo(q) {
  const d = 1 + q[0];
  if (d < 1e-6) return null;
  return [q[1]/d, q[2]/d, q[3]/d];
}

// (i, j, k) or Bloch (x, y, z) -> three.js coordinates. k / z points up.
export const toThree = v => [v[0], v[2], -v[1]];
export const fromThree = p => [p.x, -p.z, p.y];

export const normalize3 = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/n, v[1]/n, v[2]/n]; };

// Rodrigues rotation of a 3-vector about unit axis n by angle a (right-handed).
export function rotate3(v, n, a) {
  const c = Math.cos(a), s = Math.sin(a), d = n[0]*v[0] + n[1]*v[1] + n[2]*v[2];
  const cx = [n[1]*v[2] - n[2]*v[1], n[2]*v[0] - n[0]*v[2], n[0]*v[1] - n[1]*v[0]];
  return [0, 1, 2].map(k => v[k]*c + cx[k]*s + n[k]*d*(1 - c));
}

// ---------- complex numbers [re, im] ----------
export const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const cmul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
export const cconj = a => [a[0], -a[1]];
export const cabs2 = a => a[0]*a[0] + a[1]*a[1];
export const cexpi = t => [Math.cos(t), Math.sin(t)];
export const cscale = (a, s) => [a[0]*s, a[1]*s];
export const carg = a => Math.atan2(a[1], a[0]);

export function cfmt(z, digits = 2) {
  const r = Math.abs(z[0]) < 0.005 ? 0 : z[0], i = Math.abs(z[1]) < 0.005 ? 0 : z[1];
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(digits)} ${i < 0 ? '−' : '+'} ${Math.abs(i).toFixed(digits)}i`;
}
export const nfmt = (x, d = 2) => (x < -0.5 * 10**-d ? '−' : '') + Math.abs(x).toFixed(d);

// ---------- one qubit: state [a, b] = a|0> + b|1> ----------
export function stateFromAngles(th, ph) {
  return [[Math.cos(th/2), 0], cscale(cexpi(ph), Math.sin(th/2))];
}
export function blochOf(s) {
  const ab = cmul(cconj(s[0]), s[1]);           // a* b
  return [2*ab[0], 2*ab[1], cabs2(s[0]) - cabs2(s[1])];
}
export function anglesOfBloch(v) {
  const th = Math.acos(Math.max(-1, Math.min(1, v[2])));
  let ph = Math.atan2(v[1], v[0]); if (ph < 0) ph += 2*Math.PI;
  return [th, ph];
}
// R^4 point (Re a, Im a, Re b, Im b), i.e. the quaternion a + b j.
export const r4OfState = s => [s[0][0], s[0][1], s[1][0], s[1][1]];

// SU(2) element U = cos(α/2) I − i sin(α/2) n·σ  (rotates the Bloch vector by α about n)
export function su2(n, alpha) {
  const c = Math.cos(alpha/2), s = Math.sin(alpha/2);
  return [
    [[c, -s*n[2]], [-s*n[1], -s*n[0]]],
    [[s*n[1], -s*n[0]], [c, s*n[2]]],
  ];
}
// The unit quaternion of an SU(2) matrix, using −iσx ↔ i, −iσy ↔ j, −iσz ↔ k.
export function quatOfSU2(U) {
  return [U[0][0][0], -U[0][1][1], U[1][0][0], -U[0][0][1]];
}
export const matVec = (U, s) => [
  cadd(cmul(U[0][0], s[0]), cmul(U[0][1], s[1])),
  cadd(cmul(U[1][0], s[0]), cmul(U[1][1], s[1])),
];
export const matMul = (A, B) => [0, 1].map(i => [0, 1].map(j => cadd(cmul(A[i][0], B[0][j]), cmul(A[i][1], B[1][j]))));

const R2 = Math.SQRT1_2;
// Named gates as rotations (axis on the Bloch sphere, angle). Each equals the textbook gate up to a global phase.
export const GATES = {
  X: { axis: [1,0,0], angle: Math.PI,   phase: '−i', note: { en: 'X = rotate 180° about x', zh: 'X = 绕 x 轴转 180°' , es: 'X = girar 180° alrededor de x', ja: 'X = x 軸のまわりに 180° 回転' } },
  Y: { axis: [0,1,0], angle: Math.PI,   phase: '−i', note: { en: 'Y = rotate 180° about y', zh: 'Y = 绕 y 轴转 180°' , es: 'Y = girar 180° alrededor de y', ja: 'Y = y 軸のまわりに 180° 回転' } },
  Z: { axis: [0,0,1], angle: Math.PI,   phase: '−i', note: { en: 'Z = rotate 180° about z', zh: 'Z = 绕 z 轴转 180°' , es: 'Z = girar 180° alrededor de z', ja: 'Z = z 軸のまわりに 180° 回転' } },
  H: { axis: [R2,0,R2], angle: Math.PI, phase: '−i', note: { en: 'H = rotate 180° about (x+z)/√2', zh: 'H = 绕 (x+z)/√2 轴转 180°' , es: 'H = girar 180° alrededor de (x+z)/√2', ja: 'H = (x+z)/√2 軸のまわりに 180° 回転' } },
  S: { axis: [0,0,1], angle: Math.PI/2, phase: 'e^{−iπ/4}', note: { en: 'S = rotate 90° about z', zh: 'S = 绕 z 轴转 90°' , es: 'S = girar 90° alrededor de z', ja: 'S = z 軸のまわりに 90° 回転' } },
  T: { axis: [0,0,1], angle: Math.PI/4, phase: 'e^{−iπ/8}', note: { en: 'T = rotate 45° about z', zh: 'T = 绕 z 轴转 45°' , es: 'T = girar 45° alrededor de z', ja: 'T = z 軸のまわりに 45° 回転' } },
};

// Eigenstates of n·σ for a measurement direction given by Bloch angles.
export function measBasis(th, ph) {
  const plus = stateFromAngles(th, ph);
  const minus = [[Math.sin(th/2), 0], cscale(cexpi(ph), -Math.cos(th/2))];
  return [plus, minus];
}

// ---------- two qubits: psi[2*a + b] for |a b>, qubit A first ----------
export const ket00 = () => [[1,0],[0,0],[0,0],[0,0]];

export function applyOne(psi, U, which) {
  const out = psi.map(z => [z[0], z[1]]);
  const pairs = which === 0 ? [[0,2],[1,3]] : [[0,1],[2,3]];
  for (const [p, q] of pairs) {
    const v = matVec(U, [psi[p], psi[q]]);
    out[p] = v[0]; out[q] = v[1];
  }
  return out;
}
export const cnot = psi => [psi[0], psi[1], psi[3], psi[2]];  // control A, target B

export function reducedBloch(psi, which) {
  // rho_A[i][j] = sum_k psi[i k] psi*[j k]
  const idx = (i, k) => which === 0 ? 2*i + k : 2*k + i;
  const rho = (i, j) => {
    let s = [0, 0];
    for (let k = 0; k < 2; k++) s = cadd(s, cmul(psi[idx(i, k)], cconj(psi[idx(j, k)])));
    return s;
  };
  const r01 = rho(0, 1);
  return [2*r01[0], -2*r01[1], rho(0,0)[0] - rho(1,1)[0]];
}
export const concurrence = psi => 2*Math.sqrt(cabs2(cadd(cmul(psi[0], psi[3]), cscale(cmul(psi[1], psi[2]), -1))));

// Joint measurement of A along basis bA and B along basis bB. Returns outcome probabilities p[ia][ib].
export function jointProbs(psi, bA, bB) {
  const p = [[0,0],[0,0]];
  for (let ia = 0; ia < 2; ia++) for (let ib = 0; ib < 2; ib++) {
    let amp = [0, 0];
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++)
      amp = cadd(amp, cmul(cmul(cconj(bA[ia][a]), cconj(bB[ib][b])), psi[2*a + b]));
    p[ia][ib] = cabs2(amp);
  }
  return p;
}
// Correlation E = P(same) − P(different), with outcomes ±1.
export const correlation = p => p[0][0] + p[1][1] - p[0][1] - p[1][0];

export function sampleJoint(p, rnd = Math.random) {
  let r = rnd();
  for (let ia = 0; ia < 2; ia++) for (let ib = 0; ib < 2; ib++) { r -= p[ia][ib]; if (r <= 0) return [ia, ib]; }
  return [1, 1];
}
// Product state after outcome (ia, ib).
export function productState(bA, bB, ia, ib) {
  const out = [];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) out.push(cmul(bA[ia][a], bB[ib][b]));
  return out;
}
