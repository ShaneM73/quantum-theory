import { createStage, fontsReady } from '../three-kit.js';
import { createQuatSphere } from '../viz/quatSphere.js';
import { $, segmented, deg, loop } from './ui.js';
import { L } from '../lang.js';

const stage = createStage($('view'), { camPos: [3.4, 2.4, 5.6] });
let qs;
let playing = false;

const fmt = x => (x < -0.0049 ? '−' : '+') + Math.abs(x).toFixed(2);
function readout() {
  const q = qs.q();
  const lead = (q[0] < -0.0049 ? '−' : '') + Math.abs(q[0]).toFixed(2);
  $('qline').innerHTML = `q = <span class="w">${lead}</span> <span class="i">${fmt(q[1])}<i>i</i></span> <span class="j">${fmt(q[2])}<i>j</i></span> <span class="k">${fmt(q[3])}<i>k</i></span>`;
  $('status').textContent = qs.status().text;
  $('thetaOut').textContent = deg(qs.params.theta);
}
function set(p) { qs.set(p); if ('theta' in p) $('theta').value = p.theta; readout(); }

fontsReady().then(() => {
  qs = createQuatSphere();
  stage.scene.add(qs.group);
  readout();

  $('theta').addEventListener('input', e => set({ theta: +e.target.value }));
  $('presets').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) set({ theta: +b.dataset.t }); });
  segmented('axisSeg', v => set({ axis: v }));
  segmented('modeSeg', v => set({ mode: v }));
  const tog = { tSurf: 'showSurface', tGrid: 'showGrid', tCircle: 'showCircle', tPerp: 'showPerp', tImgs: 'showImages' };
  Object.entries(tog).forEach(([id, key]) => $(id).addEventListener('change', e => set({ [key]: e.target.checked })));
  $('tSlice').addEventListener('change', e => { $('sliceGroup').hidden = !e.target.checked; set({ showSlice: e.target.checked }); });
  $('w').addEventListener('input', e => { $('wOut').textContent = (+e.target.value).toFixed(2); set({ w: +e.target.value }); });
  $('play').addEventListener('click', () => { playing = !playing; $('play').textContent = playing ? L('Pause', '暂停') : L('Play', '播放'); });

  // drag the pink point (image of 1) along the axis: its projection sits at tan(θ/2)
  const cv = stage.renderer.domElement;
  let dragging = false;
  cv.addEventListener('pointerdown', e => {
    if (qs.params.mode === 'conj') return;
    const ray = stage.aim(e);
    if (qs.hit.visible && ray.intersectObject(qs.hit).length) {
      dragging = true; stage.controls.enabled = false; playing = false; $('play').textContent = L('Play', '播放');
      cv.classList.add('dragging'); cv.setPointerCapture(e.pointerId);
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    const r = stage.aim(e).ray, U = qs.axisThree();
    const b = U.dot(r.direction), c = r.direction.dot(r.direction), dd = -U.dot(r.origin), ee = -r.direction.dot(r.origin);
    const den = c - b*b; if (Math.abs(den) < 1e-6) return;
    const s = (b*ee - c*dd) / den;
    let t = 2 * Math.atan(s) * 180 / Math.PI; if (t < 0) t += 360;
    set({ theta: Math.round(t*2)/2 });
  });
  const end = () => { dragging = false; stage.controls.enabled = true; cv.classList.remove('dragging'); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
});

loop(dt => {
  if (qs) {
    if (playing) set({ theta: (qs.params.theta + dt*30) % 360 });
    qs.update();
  }
  stage.render();
});
