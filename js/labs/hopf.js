import { createStage, fontsReady } from '../three-kit.js';
import { createHopf } from '../viz/hopf.js';
import { cfmt, cabs2, r4OfState, fromThree, anglesOfBloch } from '../qmath.js';
import { $, segmented, deg, loop } from './ui.js';
import { L as tr } from '../lang.js';

const L = createStage($('left'), { camPos: [3.6, 2.6, 6.2] });
const R = createStage($('right'), { camPos: [2.2, 1.5, 3.0] });
let H, playing = false, setFam;

function readout() {
  const s = H.amplitudes();
  $('aVal').textContent = 'a = ' + cfmt(s[0]);
  $('bVal').textContent = 'b = ' + cfmt(s[1]);
  const pa = cabs2(s[0]), pb = cabs2(s[1]);
  $('aP').textContent = pa.toFixed(3); $('bP').textContent = pb.toFixed(3);
  $('aBar').style.width = pa*100 + '%'; $('bBar').style.width = pb*100 + '%';
  $('r4').textContent = tr('4D point (w, x, y, z) = (', '四维坐标 (w, x, y, z) = (') + r4OfState(s).map(x => (Math.abs(x) < 0.005 ? 0 : x).toFixed(2)).join(', ') + ')';
  $('thOut').textContent = deg(H.params.th); $('phOut').textContent = deg(H.params.ph); $('gaOut').textContent = deg(H.params.ga);
}
function set(p) {
  H.set(p);
  ['th', 'ph', 'ga'].forEach(k => { if (k in p) $(k).value = p[k]; });
  readout();
}

fontsReady().then(() => {
  H = createHopf();
  L.scene.add(H.s3); R.scene.add(H.bloch.group);
  readout();
  ['th', 'ph', 'ga'].forEach(k => $(k).addEventListener('input', e => set({ [k]: +e.target.value })));
  $('play').addEventListener('click', () => { playing = !playing; $('play').textContent = playing ? tr('Pause', '暂停') : tr('Play', '播放'); });
  setFam = segmented('famSeg', v => set({ fam: v }));
  const fam = v => { setFam(v); set({ fam: v }); };
  $('goRing').addEventListener('click', () => fam('ring'));
  $('goScatter').addEventListener('click', () => fam('scatter'));
  $('goNorth').addEventListener('click', () => { fam('one'); set({ th: 0, ph: 0 }); });
  $('goSouth').addEventListener('click', () => { fam('one'); set({ th: 180, ph: 0 }); });

  // drag the state on the Bloch sphere
  const cv = R.renderer.domElement;
  let dragging = false;
  cv.addEventListener('pointerdown', e => {
    if (R.aim(e).intersectObject(H.hit).length) {
      dragging = true; R.controls.enabled = false; cv.classList.add('dragging'); cv.setPointerCapture(e.pointerId);
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    const h = R.aim(e).intersectObject(H.bloch.pick)[0]; if (!h) return;
    const p = H.bloch.group.worldToLocal(h.point.clone()).normalize();
    const [th, ph] = anglesOfBloch(fromThree(p));
    set({ th: Math.round(th*180/Math.PI*2)/2, ph: Math.round(ph*180/Math.PI*2)/2 });
  });
  const end = () => { dragging = false; R.controls.enabled = true; cv.classList.remove('dragging'); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
});

loop(dt => {
  if (H) {
    if (playing) set({ ga: (H.params.ga + dt*40) % 360 });
    H.update();
  }
  L.render(); R.render();
});
