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
    ? L('<b>After measuring</b>: both arrows jumped onto their measurement directions (up or down) and are back on the sphere. The measurement used up the entanglement.', '<b>测量之后</b>：两个箭头跳到了测量方向上（向上或向下），重新顶在球面上。纠缠被测量“用掉”了。', '<b>Tras medir</b>: las dos flechas saltaron a sus direcciones de medida (arriba o abajo) y vuelven a tocar la esfera. La medida gastó el entrelazamiento.', '<b>測定後</b>：2 本の矢印は測定方向（上か下）へ飛び、再び球面に届いています。もつれは測定で「使い切られ」ました。')
    : C > 0.98 ? L('<b>Maximally entangled</b>: both arrows have shrunk to the centre. The pair is completely definite, each qubit alone is completely random.', '<b>最大纠缠</b>：两个箭头都缩成了球心的点。整体完全确定，单看每个比特完全随机。', '<b>Entrelazamiento máximo</b>: las dos flechas se han encogido hasta el centro. El par está totalmente definido; cada cúbit por sí solo es completamente aleatorio.', '<b>最大のもつれ</b>：2 本の矢印はどちらも中心の点に縮みました。全体は完全に確定していますが、各量子ビットを単独で見ると完全にランダムです。')
    : C > 0.02 ? L(`<b>Partly entangled</b> (C = ${C.toFixed(2)}): the arrows are shorter.`, `<b>部分纠缠</b>（C = ${C.toFixed(2)}）：箭头缩短了一些。`, `<b>Entrelazamiento parcial</b> (C = ${C.toFixed(2)}): las flechas son más cortas.`, `<b>部分的なもつれ</b>（C = ${C.toFixed(2)}）：矢印が少し短くなっています。`)
    : L('<b>Not entangled</b>: both arrows reach the sphere. Each qubit has its own definite state.', '<b>没有纠缠</b>：两个箭头都顶在球面上，每个比特各有确定的状态。', '<b>Sin entrelazamiento</b>: las dos flechas llegan a la esfera. Cada cúbit tiene su propio estado definido.', '<b>もつれなし</b>：2 本の矢印はどちらも球面に届いています。各量子ビットはそれぞれ確定した状態です。');
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
    $('stepText').textContent = L('β controls how much entanglement there is.', '用 β 控制纠缠多少。', 'β controla cuánto entrelazamiento hay.', 'β でもつれの量を調節します。');
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
    $('result').innerHTML = `${L('Result:', '结果：', 'Resultado:', '結果：')} <span class="qa">A ${s(m.ia)}</span>　<span class="qb">B ${s(m.ib)}</span>　${m.ia === m.ib ? L('(same)', '（相同）', '(iguales)', '（同じ）') : L('(different)', '（不同）', '(distintos)', '（異なる）')}`;
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
    const verdict = Math.abs(r.S) > 2.05 ? L('Above the classical limit of 2: answers written down in advance cannot explain this.', '超过了经典上限 2：不能用“事先写好的答案”解释。', 'Supera el límite clásico de 2: unas respuestas escritas de antemano no pueden explicarlo.', '古典的上限 2 を超えました：あらかじめ書き込まれた答えでは説明できません。') : L('Not above 2. Try making a Bell state first.', '没有超过 2。试试先做贝尔态。', 'No supera 2. Prueba primero a construir un estado de Bell.', '2 を超えていません。先にベル状態を作ってみましょう。');
    $('chshText').innerHTML = `S = <b>${r.S.toFixed(2)}</b> ${L('(A uses 0°/90°, B uses 45°/135°).', '（A 用 0°/90°，B 用 45°/135°）。', '(A usa 0°/90°, B usa 45°/135°).', '（A は 0°/90°、B は 45°/135°）。')} ${verdict}<br>` +
      r.rows.map(x => `E(${x.a}°, ${x.b}°) = ${x.E.toFixed(2)}`).join(L(', ', '，', ', ', '、'));
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
