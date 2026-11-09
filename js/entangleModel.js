// Two-qubit model used by the entanglement lab and the VR station.
import {
  su2, applyOne, cnot, ket00, measBasis, jointProbs, correlation, sampleJoint, productState, cabs2, carg, matVec,
} from './qmath.js';

const r = Math.SQRT1_2;
export const Hm = [[[r,0],[r,0]],[[r,0],[-r,0]]];
export const Xm = [[[0,0],[1,0]],[[1,0],[0,0]]];
export const Ry = t => su2([0,1,0], t);

export function ctrlRy(psi, t) {           // rotate B by Ry(t) only where A = 1
  const v = matVec(Ry(t), [psi[2], psi[3]]);
  return [psi[0], psi[1], v[0], v[1]];
}
export const betaState = beta => cnot(applyOne(ket00(), Ry(beta), 0));

// Bell-state preparation as a continuous path: u in [0, 2].
// 0→1: rotate A from |0> to |+> (same as H on |0>); 1→2: controlled-Ry(π) (equals CNOT on this state).
export function bellPath(u) {
  const a = applyOne(ket00(), Ry(Math.PI/2 * Math.min(u, 1)), 0);
  return u <= 1 ? a : ctrlRy(a, Math.PI * (u - 1));
}
export function bellCaption(u) {
  if (u <= 0) return '从 |00⟩ 开始：两个箭头都指向北极，各自完全确定。';
  if (u < 1) return '第 1 步：H 作用在 A 上，A 的箭头从 |0⟩ 转向赤道。B 不动。';
  if (u === 1) return '第 1 步完成：(|00⟩ + |10⟩)/√2。A 在赤道上，B 还是 0，还没有纠缠。';
  if (u < 2) return '第 2 步：CNOT。A 是 1 的那一项里，B 被翻转……两个箭头一起往球心缩。';
  return '完成：(|00⟩ + |11⟩)/√2。两个箭头都缩成球心的点：整体确定，单看每个都是完全随机的。';
}

export function ketString(psi) {
  const names = ['|00⟩', '|01⟩', '|10⟩', '|11⟩'];
  const terms = [];
  psi.forEach((z, n) => {
    const m = Math.sqrt(cabs2(z)); if (m < 0.005) return;
    const ph = carg(z);
    let coef;
    if (Math.abs(ph) < 0.01) coef = m.toFixed(2);
    else if (Math.abs(Math.abs(ph) - Math.PI) < 0.01) coef = '−' + m.toFixed(2);
    else if (Math.abs(ph - Math.PI/2) < 0.01) coef = m.toFixed(2) + 'i';
    else if (Math.abs(ph + Math.PI/2) < 0.01) coef = '−' + m.toFixed(2) + 'i';
    else coef = `${m.toFixed(2)}e^{${(ph*180/Math.PI).toFixed(0)}°i}`;
    terms.push({ coef, name: names[n] });
  });
  return terms.map((t, k) => {
    const neg = t.coef.startsWith('−');
    const c = neg ? t.coef.slice(1) : t.coef;
    return (k === 0 ? (neg ? '−' : '') : (neg ? ' − ' : ' + ')) + (c === '1.00' ? '' : c) + t.name;
  }).join('');
}

// Measurement directions in the x–z plane, theta from +z.
export const dirXZ = th => [Math.sin(th), 0, Math.cos(th)];
export const basisXZ = th => measBasis(th, 0);

export function measureOnce(psi, thA, thB, rnd) {
  const bA = basisXZ(thA), bB = basisXZ(thB);
  const p = jointProbs(psi, bA, bB);
  const [ia, ib] = sampleJoint(p, rnd);
  return { ia, ib, psi: productState(bA, bB, ia, ib) };
}
export function measureMany(psi, thA, thB, N = 1000, rnd = Math.random) {
  const p = jointProbs(psi, basisXZ(thA), basisXZ(thB));
  const c = [[0,0],[0,0]];
  for (let n = 0; n < N; n++) { const [ia, ib] = sampleJoint(p, rnd); c[ia][ib]++; }
  const E = (c[0][0] + c[1][1] - c[0][1] - c[1][0]) / N;
  return { counts: c, E, Etheory: correlation(p) };
}
export function chsh(psi, N = 1000) {
  const D = Math.PI/180;
  const sets = [[0, 45], [0, 135], [90, 45], [90, 135]];
  const rows = sets.map(([a, b]) => ({ a, b, ...measureMany(psi, a*D, b*D, N) }));
  const S = rows[0].E - rows[1].E + rows[2].E + rows[3].E;
  return { rows, S };
}
export { applyOne, cnot, ket00 };
