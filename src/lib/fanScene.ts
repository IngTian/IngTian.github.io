// src/lib/fanScene.ts
// The interactive 3D factor fan. Loaded ONLY from a dynamic import inside an
// IntersectionObserver (see FactorFan.astro), so three.js is never fetched on first paint,
// never during a Lighthouse audit, and never under prefers-reduced-motion.
//
// PIXEL ART, WITHOUT DRAWING ANY:
//   1. the renderer targets a LOW-RESOLUTION buffer (PIXEL_H tall) that CSS scales back up
//      with image-rendering: pixelated — so every edge is a hard, chunky pixel;
//   2. materials are MeshToonMaterial against a 4-step gradient texture, so lighting
//      quantises into flat bands instead of smooth shading;
//   3. geometry is flat-shaded, so each facet is one solid colour.
// All three are renderer settings, not artwork. That distinction matters: hand-authored
// illustration is exactly what failed three times in this section, and none of this asks for
// a taste call about where to put a shape.
//
// EVERY NUMBER COMES FROM THE MODEL. Beam length and width are the betas computed in
// factorModel.ts; nothing here invents geometry. The scene is the equation, rotatable.

// A STATIC import, deliberately. This module is itself only ever reached through a dynamic
// import() in FactorFan.astro, so Vite emits three.js in this module's chunk and fetches it at
// that moment — not on first paint. Using require() here would break in ESM, and a second
// dynamic import inside would only add a round trip.
import * as THREE from 'three';

import type { Vec3 } from './factorModel';

export interface SceneBeam {
  key: string;
  label: string;
  beta: number;
  azimuth: number;
  elevation: number;
  length: number;
  halfWidth: number;
  tip: Vec3;
}

export interface FanSceneOpts {
  canvas: HTMLCanvasElement;
  beams: SceneBeam[];
  /** Called when the pointer is over a beam, so the page can show its signals. */
  onActive: (key: string | null) => void;
  /** Called every frame with each beam's tip in normalised [0,1] screen space, so the DOM
   *  labels ride the geometry instead of guessing where it went. */
  placeLabel: (key: string, x: number, y: number) => void;
}

/** Vertical resolution of the render buffer. 320 gives visibly chunky pixels at any viewport
 *  while keeping the fan's own edges readable; the CSS upscale does the rest. */
const PIXEL_H = 320;

export function mountFanScene(opts: FanSceneOpts): () => void {
  const { canvas, beams, onActive, placeLabel } = opts;
  let disposed = false;
  let raf = 0;

  return start();

  function start(): () => void {
    const cleanups: Array<() => void> = [];

    const dpr = 1;   // deliberately 1: the point is a low-res buffer, not a crisp one
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1600 / 880, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;   // the colours ARE the palette tokens

    // ── Palette, read from the live CSS tokens so both themes work with no branching here.
    const css = getComputedStyle(document.documentElement);
    const tok = (name: string, fallback: string) =>
      new THREE.Color((css.getPropertyValue(name).trim() || fallback));
    const ochre = tok('--ochre', '#c8a36a');
    const indigo = tok('--indigo', '#6d7689');
    const seal = tok('--seal', '#b23a2e');
    const paper = tok('--paper', '#efe9dd');
    const ink5 = tok('--ink-5', '#b8b1a1');

    // ── The toon ramp: 4 hard steps, which is what quantises the shading into flat bands.
    const rampData = new Uint8Array([70, 130, 200, 255]);
    const ramp = new THREE.DataTexture(rampData, rampData.length, 1, THREE.RedFormat);
    ramp.needsUpdate = true;
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;

    const root = new THREE.Group();
    scene.add(root);

    // ── Beams. Each is an extruded wedge: a flat quad given thickness, so it reads as a solid
    // under the toon ramp rather than as a piece of paper.
    const meshes: { key: string; mesh: any; base: any; tip: any }[] = [];
    for (const b of beams) {
      const zero = b.beta === 0;
      const geom = beamGeometry(b);
      const mat = new THREE.MeshToonMaterial({
        color: zero ? indigo : ochre,
        gradientMap: ramp,
        transparent: zero,
        opacity: zero ? 0.42 : 1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.key = b.key;
      root.add(mesh);
      // The label anchor sits PAST the tip along the beam's own axis, so the text clears the
      // wedge instead of sitting on top of it. 1.18 is enough at every loading, including the
      // short zero stubs.
      const anchor = new THREE.Vector3(b.tip.x, b.tip.y, b.tip.z).multiplyScalar(1.18);
      meshes.push({ key: b.key, mesh, base: mat.color.clone(), tip: anchor });

      // A bright leading edge along the beam's top — the single strongest cue that a flat
      // shape is a solid one.
      const edge = new THREE.Mesh(
        beamEdgeGeometry(b),
        new THREE.MeshBasicMaterial({ color: paper, transparent: true, opacity: zero ? 0.3 : 0.85 }),
      );
      root.add(edge);
    }

    // ── The asset at the origin: one seal-red mark every beam loads onto.
    const asset = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.075, 0),   // 0 subdivisions = chunky facets, on purpose
      new THREE.MeshToonMaterial({ color: seal, gradientMap: ramp }),
    );
    root.add(asset);

    // ── A ground grid, so the fan sits on a plane instead of floating in a void.
    const grid = new THREE.PolarGridHelper(2.4, 6, 4, 48, ink5, ink5);
    (grid.material as any).transparent = true;
    (grid.material as any).opacity = 0.16;
    grid.position.y = -0.002;
    root.add(grid);

    // ── Light: one key, one fill. Flat and directional, which is what the toon ramp wants.
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-2.4, 3.0, 2.2);
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    camera.position.set(0, 1.15, -2.55);
    camera.lookAt(0, 0.42, 0.6);

    // ── Drag to rotate. Pointer events only, so touch and mouse share one path.
    let yaw = 0;
    let pitch = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let spin = 0.055;          // gentle idle rotation, so it reads as interactive at a glance

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.classList.add('is-dragging');
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.006;
      pitch = Math.max(-0.5, Math.min(0.75, pitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
      spin = 0;                // once the visitor takes control, stop drifting under them
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      canvas.classList.remove('is-dragging');
      canvas.releasePointerCapture?.(e.pointerId);
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    cleanups.push(() => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    });

    // ── Hover: raycast to find which beam is under the pointer.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hovered: string | null = null;
    const onHover = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(meshes.map((m) => m.mesh), false)[0];
      const k = hit ? (hit.object.userData.key as string) : null;
      if (k !== hovered) {
        hovered = k;
        for (const m of meshes) {
          const active = m.key === k;
          (m.mesh.material as any).color.copy(active ? paper : m.base);
        }
        onActive(k);
      }
    };
    canvas.addEventListener('pointermove', onHover);
    cleanups.push(() => canvas.removeEventListener('pointermove', onHover));

    // ── Size the buffer LOW and let CSS scale it up. This is the pixel-art step.
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      const h = PIXEL_H;
      const w = Math.round((r.width / r.height) * h);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    cleanups.push(() => ro.disconnect());

    // ── Pause when offscreen: a rAF loop behind the fold is wasted battery.
    let visible = true;
    const vio = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); });
    vio.observe(canvas);
    cleanups.push(() => vio.disconnect());

    const project = new THREE.Vector3();
    let last = 0;
    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      // ~30fps is plenty for a slow rotation and halves the GPU work.
      if (now - last < 33) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!dragging) yaw += spin * dt;
      root.rotation.y = yaw;
      root.rotation.x = pitch;

      // Labels ride the geometry: project each tip and hand normalised coords to the page.
      for (const m of meshes) {
        project.copy(m.tip).applyMatrix4(root.matrixWorld).project(camera);
        placeLabel(m.key, (project.x + 1) / 2, (-project.y + 1) / 2);
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const c of cleanups) c();
      for (const m of meshes) {
        m.mesh.geometry.dispose();
        (m.mesh.material as any).dispose();
      }
      ramp.dispose();
      renderer.dispose();
    };
  }
}

/** A beam as an extruded wedge: narrow at the origin, `halfWidth` at the tip, with real
 *  thickness so the toon ramp has facets to band. */
function beamGeometry(b: SceneBeam) {
  const root = 0.02;
  const th = Math.max(0.018, b.halfWidth * 0.34);   // thickness scales with the loading
  const ca = Math.cos(b.azimuth), sa = Math.sin(b.azimuth);
  const ce = Math.cos(b.elevation), se = Math.sin(b.elevation);
  // axis along the beam, and a horizontal perpendicular for the width
  const ax = { x: sa * ce, y: se, z: ca * ce };
  const px = { x: ca, y: 0, z: -sa };
  const up = {
    x: px.y * ax.z - px.z * ax.y,
    y: px.z * ax.x - px.x * ax.z,
    z: px.x * ax.y - px.y * ax.x,
  };
  const P = (along: number, across: number, thick: number) => [
    ax.x * along + px.x * across + up.x * thick,
    ax.y * along + px.y * across + up.y * thick,
    ax.z * along + px.z * across + up.z * thick,
  ];
  const L = b.length;
  const verts: number[] = [];
  const quad = (a: number[], c: number[], d: number[], e: number[]) => {
    verts.push(...a, ...c, ...d, ...a, ...d, ...e);
  };
  // eight corners: root/tip × left/right × top/bottom
  const rlt = P(0, -root, th), rrt = P(0, root, th), rlb = P(0, -root, -th), rrb = P(0, root, -th);
  const tlt = P(L, -b.halfWidth, th), trt = P(L, b.halfWidth, th);
  const tlb = P(L, -b.halfWidth, -th), trb = P(L, b.halfWidth, -th);
  quad(rlt, rrt, trt, tlt);   // top
  quad(rrb, rlb, tlb, trb);   // bottom
  quad(rlb, rlt, tlt, tlb);   // left
  quad(rrt, rrb, trb, trt);   // right
  quad(tlt, trt, trb, tlb);   // tip cap
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

/** A thin bright strip along the beam's top leading edge. */
function beamEdgeGeometry(b: SceneBeam) {
  const th = Math.max(0.018, b.halfWidth * 0.34) + 0.004;
  const ca = Math.cos(b.azimuth), sa = Math.sin(b.azimuth);
  const ce = Math.cos(b.elevation), se = Math.sin(b.elevation);
  const ax = { x: sa * ce, y: se, z: ca * ce };
  const px = { x: ca, y: 0, z: -sa };
  const up = {
    x: px.y * ax.z - px.z * ax.y,
    y: px.z * ax.x - px.x * ax.z,
    z: px.x * ax.y - px.y * ax.x,
  };
  const P = (along: number, across: number) => [
    ax.x * along + px.x * across + up.x * th,
    ax.y * along + px.y * across + up.y * th,
    ax.z * along + px.z * across + up.z * th,
  ];
  const w = 0.012;
  const a = P(0.02, -w), c = P(0.02, w), d = P(b.length, b.halfWidth), e = P(b.length, b.halfWidth - w * 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...c, ...d, ...a, ...d, ...e], 3));
  g.computeVertexNormals();
  return g;
}
