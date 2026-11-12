import { createStage, fontsReady, prefersReducedMotion } from '../three-kit.js';
import { createEntangle } from '../viz/entangle.js';
import { concurrence, reducedBloch } from '../qmath.js';
import {
  Hm, Xm, applyOne, cnot, ket00, betaState, bellPath, bellCaption, ketString, dirXZ, measureOnce, measureMany, chsh,
} from '../entangleModel.js';
import { $, deg, loop } from './ui.js';
import { L } from '../lang.js';

const D2R = Math.PI / 180;
const stage = createStage($('view'), { camPos: [0, 1.2, 7.0], target: [0, -0.35, 0] });
let E;
const st = { psi: ket00(), saved: null, anim: null, measured: false };

const len = v => Math.hypot(...v);
function render() {
  E.set(st.psi);
  const ta = +$('ta').value * D2R, tb = +$('tb').value * D2R;
  E.setMeasure(dirXZ(ta), dirXZ(tb));
  $('ket').textContent = ketString(st.psi);
  const C = Math.min(1, concurrence(st.psi));
  $('conc').textContent = C.toFixed(2);
  $('lenA').textContent = len(reducedBloch(st.psi, 0)).toFixed(2);
  $('lenB').textContent = len(reducedBloch(st.psi, 1)).toFixed(2);
  $('status').innerHTML = st.measured
    ? L('<b>After measuring</b>: both arrows jumped onto their measurement directions (up or down) and are back on the sphere. The measurement used up the entanglement.', '<b>Tras medir</b>: las dos flechas saltaron a sus direcciones de medida (arriba o abajo) y vuelven a tocar la esfera. La medida gastó el entrelazamiento.')
    : C > 0.98 ? L('<b>Maximally entangled</b>: both arrows have shrunk to the centre. The pair is completely definite, each qubit alone is completely random.', '<b>Entrelazamiento máximo</b>: las dos flechas se han encogido hasta el centro. El par está totalmente definido; cada cúbit por sí solo es completamente aleatorio.')
    : C > 0.02 ? L(`<b>Partly entangled</b> (C = ${C.toFixed(2)}): the arrows are shorter.`, `<b>Entrelazamiento parcial</b> (C = ${C.toFixed(2)}): las flechas son más cortas.`)
    : L('<b>Not entangled</b>: both arrows reach the sphere. Each qubit has its own definite state.', '<b>Sin entrelazamiento</b>: las dos flechas llegan a la esfera. Cada cúbit tiene su propio estado definido.');
  $('restore').disabled = !st.saved;
}
function setPsi(psi, { keepSaved = false } = {}) {
  st.psi = psi;
  if (!keepSaved) { st.saved = null; st.measured = false; $('result').textContent = ''; }
  render();
}

fontsReady().then(() => {
  E = createEntangle();
  stage.scene.add(E.group);
  render();

  $('reset').addEventListener('click', () => { st.anim = null; $('beta').value = 0; $('betaOut').textContent = '0°'; $('stepText').textContent = bellCaption(0); setPsi(ket00()); });
  $('bell').addEventListener('click', () => {
    $('beta').value = 0;
    if (prefersReducedMotion()) { setPsi(bellPath(2)); $('stepText').textContent = bellCaption(2); return; }
    st.anim = { u: 0, pause: 0 }; setPsi(ket00()); $('stepText').textContent = bellCaption(0);
  });
  $('beta').addEventListener('input', e => {
    st.anim = null;
    $('betaOut').textContent = deg(e.target.value);
    setPsi(betaState(+e.target.value * D2R));
    $('stepText').textContent = L('β controls how much entanglement there is.', 'β controla cuánto entrelazamiento hay.');
  });
  $('betaOut').textContent = '0°';
  $('gates').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    st.anim = null;
    const g = b.dataset.g;
    const psi = g === 'HA' ? applyOne(st.psi, Hm, 0) : g === 'XA' ? applyOne(st.psi, Xm, 0)
      : g === 'HB' ? applyOne(st.psi, Hm, 1) : g === 'XB' ? applyOne(st.psi, Xm, 1) : cnot(st.psi);
    setPsi(psi);
  });
  const angleOut = () => { $('taOut').textContent = deg($('ta').value); $('tbOut').textContent = deg($('tb').value); };
  angleOut();
  ['ta', 'tb'].forEach(id => $(id).addEventListener('input', () => { angleOut(); render(); }));

  $('once').addEventListener('click', () => {
    const base = st.saved || st.psi;
    const m = measureOnce(base, +$('ta').value * D2R, +$('tb').value * D2R);
    st.saved = base; st.measured = true;
    const s = i => (i === 0 ? '+' : '−');
    $('result').innerHTML = `${L('Result:', 'Resultado:')} <span class="qa">A ${s(m.ia)}</span>　<span class="qb">B ${s(m.ib)}</span>　${m.ia === m.ib ? L('(same)', '(iguales)') : L('(different)', '(distintos)')}`;
    setPsi(m.psi, { keepSaved: true });
  });
  $('restore').addEventListener('click', () => { if (st.saved) setPsi(st.saved); });
  $('many').addEventListener('click', () => {
    const base = st.saved || st.psi;
    const ta = +$('ta').value, tb = +$('tb').value;
    const r = measureMany(base, ta * D2R, tb * D2R, 1000);
    $('stats').hidden = false;
    const row = document.createElement('tr');
    row.innerHTML = `<td>θA ${ta}° θB ${tb}°</td><td>${r.counts[0][0]}</td><td>${r.counts[0][1]}</td><td>${r.counts[1][0]}</td><td>${r.counts[1][1]}</td><td>${r.E.toFixed(2)}</td>`;
    $('statsBody').prepend(row);
    while ($('statsBody').children.length > 6) $('statsBody').lastChild.remove();
  });
  $('chsh').addEventListener('click', () => {
    const base = st.saved || st.psi;
    const r = chsh(base, 1000);
    $('chshOut').hidden = false;
    $('chshBar').style.width = Math.min(100, Math.max(0, Math.abs(r.S) / 4 * 100)) + '%';
    const verdict = Math.abs(r.S) > 2.05 ? L('Above the classical limit of 2: answers written down in advance cannot explain this.', 'Supera el límite clásico de 2: unas respuestas escritas de antemano no pueden explicarlo.') : L('Not above 2. Try making a Bell state first.', 'No supera 2. Prueba primero a construir un estado de Bell.');
    $('chshText').innerHTML = `S = <b>${r.S.toFixed(2)}</b> ${L('(A uses 0°/90°, B uses 45°/135°).', '(A usa 0°/90°, B usa 45°/135°).')} ${verdict}<br>` +
      r.rows.map(x => `E(${x.a}°, ${x.b}°) = ${x.E.toFixed(2)}`).join(L(', ', ', '));
  });
});

loop(dt => {
  if (E) {
    if (st.anim) {
      const a = st.anim;
      if (a.pause > 0) a.pause -= dt;
      else {
        const before = a.u;
        a.u = Math.min(2, a.u + dt * 0.6);
        if (before < 1 && a.u >= 1) { a.u = 1; a.pause = 1.2; }
        setPsi(bellPath(a.u));
        $('stepText').textContent = bellCaption(a.u);
        if (a.u >= 2) st.anim = null;
      }
    }
    E.tick(dt);
  }
  stage.render();
});
