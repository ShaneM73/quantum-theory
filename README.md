# Quantum Theory Labs · 量子理论实验室

Interactive 3D labs that go from quaternions to quantum entanglement, plus a WebXR VR version.
从四元数到量子纠缠的一组 3D 交互实验，以及一个 WebXR 虚拟现实版本。

**Live site:** https://shanem73.github.io/quantum-theory/

Languages: **English** (default), **中文**, **Español**, **日本語**, from the language menu in the top bar of every page. The choice is remembered across pages. Link straight to a language with `?lang=zh`, `?lang=es` or `?lang=ja`.

## Labs

| Page | Topic | What you can do |
| --- | --- | --- |
| [`quaternion.html`](quaternion.html) | 四元数球 · Quaternion sphere | Multiply the unit sphere of pure quaternions by *q*, stereographically projected from −1 (as in 3Blue1Brown's video). Drag the point 1 along the axis, see the sphere turn into a plane at 90°, flip at 180°, return at 360°. Compare *q·p*, *p·q* and *q p q⁻¹* (rotation by 2θ). Onion slices at fixed real part *w*. |
| [`hopf.html`](hopf.html) | 霍普夫纤维 · Hopf fibration & Bloch sphere | A qubit (a, b) is a point on S³. Turning the global phase moves it around a circle (a fiber) while probabilities stay fixed. Each Bloch-sphere point ↔ one circle; rings of states make linked tori. Counts dimensions: 3 − 1 = 2. |
| [`gates.html`](gates.html) | 量子门 · Gates as rotations | X, Y, Z, H, S, T animated as Bloch-sphere rotations, each shown as its unit quaternion cos(α/2) + n sin(α/2). Free rotation up to 720°: at 360° the arrow is back but q = −1 and both amplitudes flip sign. |
| [`entanglement.html`](entanglement.html) | 量子纠缠 · Entanglement | Step-by-step H + CNOT into a Bell state; reduced Bloch vectors shrink to the centre as entanglement grows (slider β). Measure along chosen directions, collect statistics, and run a CHSH test (S ≈ 2√2 > 2). |
| [`vr.html`](vr.html) | VR | All four labs as stations in a ring around you, operated with controller rays and 3D buttons. Works with mouse on desktop. |

## VR controls

The station you face is the active one (yellow ring on the floor). Each station can be brought closer or pushed away, moved, and its 3D model rotated, panned and zoomed.

| | Keyboard | Mouse | VR controllers |
| --- | --- | --- | --- |
| Closer / farther | `W` / `S` | `Shift` + wheel | right stick ↑ / ↓ |
| Move station | `A` `D` (left/right), `R` `F` (up/down) | | left stick |
| Rotate model | arrow keys | right-drag or `Shift`+drag | right stick ← / →, or grip and turn your hand |
| Pan model | `I` `J` `K` `L` | middle-drag or `Ctrl`+drag | grip and move your hand |
| Zoom model | `+` / `−` | wheel | `A` / `B`, or grip with both hands and pull apart |
| Look around | `Q` / `E`, `1`–`4` to face a station | left-drag | turn your head |
| Reset | `0` (this station), `Shift`+`0` (all) | "Reset all stations" button | `X` |
| Help | `H` | | `Y` toggles the card on the left controller |

Pressing 3D buttons: click them, or point the controller ray and pull the trigger.

## Run locally

It is a static site with no build step. Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

WebXR needs HTTPS (or `localhost`). For a headset on the same network, use the GitHub Pages URL, or a tunnel such as `npx localtunnel --port 8000`. Tested target: Meta Quest Browser.

## Structure

```
index.html            home / learning path
quaternion.html  hopf.html  gates.html  entanglement.html  vr.html
css/site.css          shared styles
js/qmath.js           quaternions, complex numbers, SU(2), one- and two-qubit math
js/entangleModel.js   Bell-state path, measurement sampling, CHSH
js/i18n.js, js/lang.js language switch (HTML uses data-zh / data-es / data-ja; scripts use L(en, zh, es, ja))
js/three-kit.js       three.js helpers (stage, labels, arrows, dynamic lines)
js/viz/               reusable 3D scenes: quatSphere, hopf, bloch, entangle
js/labs/              page controllers for the desktop labs
js/vr.js, js/vr-ui.js WebXR stations, 3D buttons and text panels
```

The same `js/viz/*` scenes power both the desktop labs and the VR stations, so a fix in one place shows up in both.

## Conventions

- A qubit (a, b) is identified with the quaternion **a + b·j**; global phase is left multiplication by cos γ + i sin γ.
- Projection: unit quaternion w + xi + yj + zk ↦ (x, y, z)/(1 + w).
- Gate ↔ quaternion: −iσx, −iσy, −iσz ↔ i, j, k, so U = cos(α/2) I − i sin(α/2) n·σ ↔ q = cos(α/2) + sin(α/2)(nₓi + n_yj + n_zk).

Built with [three.js](https://threejs.org) r160 (loaded from jsDelivr).
