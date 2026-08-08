// src/lib/fanScene.ts
// The interactive 3D factor fan. Loaded ONLY from a dynamic import inside an
// IntersectionObserver (see FactorFan.astro), so three.js is never fetched on first paint,
// never during a Lighthouse audit, and never under prefers-reduced-motion.
//
// AN INSTRUMENT, NOT PIXEL ART. A first pass rendered into a low-res buffer upscaled with
// image-rendering: pixelated; against a Swiss-minimal page that read as a retro-game artefact
// and was dropped. Now: full resolution, antialiased, flat-shaded wedges over a hairline
// measuring frame — beta rings, radial spokes and tick marks — so the object looks measured,
// which is what it is.
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

/** Device-pixel cap. 2 is the usual ceiling for this site's canvases: beyond it the GPU cost
 *  doubles for no visible gain on the hairlines this scene is made of. */
const MAX_DPR = 2;

export function mountFanScene(opts: FanSceneOpts): () => void {
  const { canvas, beams, onActive, placeLabel } = opts;
  let disposed = false;
  let raf = 0;

  return start();

  function start(): () => void {
    const cleanups: Array<() => void> = [];

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1600 / 880, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(MAX_DPR, window.devicePixelRatio || 1));
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

    // ── A soft ramp. Still banded (flat facets read as planes, which is what a diagram wants)
    // but with enough steps that it no longer looks like a cel-shaded game.
    const rampData = new Uint8Array([96, 140, 178, 210, 236, 255]);
    const ramp = new THREE.DataTexture(rampData, rampData.length, 1, THREE.RedFormat);
    ramp.needsUpdate = true;
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;

    const root = new THREE.Group();
    scene.add(root);

    // ── Beams. Each is an extruded wedge: a flat quad given thickness, so it reads as a solid
    // under the toon ramp rather than as a piece of paper.
    const meshes: {
      key: string; mesh: any; base: any; tip: any;
      /** 0..1 eased hover weight, so the response is animated rather than switched. */
      hover: number; zero: boolean; edge: any;
    }[] = [];
    let gaugeGlow = 0;
    for (const b of beams) {
      const zero = b.beta === 0;
      const geom = beamGeometry(b);
      const mat = new THREE.MeshToonMaterial({
        color: zero ? indigo : ochre,
        gradientMap: ramp,
        transparent: true,
        opacity: zero ? 0.42 : 1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.key = b.key;
      root.add(mesh);
      // The label anchor sits PAST the tip along the beam's own axis, so the text clears the
      // wedge instead of sitting on top of it. 1.18 is enough at every loading, including the
      // short zero stubs.
      const anchor = new THREE.Vector3(b.tip.x, b.tip.y, b.tip.z).multiplyScalar(1.18);
      const record = {
        key: b.key, mesh, base: mat.color.clone(), tip: anchor,
        hover: 0, zero, edge: null as any,
      };
      meshes.push(record);

      // A bright leading edge along the beam's top — the single strongest cue that a flat
      // shape is a solid one.
      const edge = new THREE.Mesh(
        beamEdgeGeometry(b),
        new THREE.MeshBasicMaterial({ color: paper, transparent: true, opacity: zero ? 0.3 : 0.85 }),
      );
      root.add(edge);
      record.edge = edge;
    }

    // ── The asset at the origin: one seal-red mark every beam loads onto.
    const asset = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.075, 0),   // 0 subdivisions = chunky facets, on purpose
      new THREE.MeshToonMaterial({ color: seal, gradientMap: ramp }),
    );
    root.add(asset);

    // ── THE MEASURING FRAME. This is what fills the scene: without it six wedges float in a
    // void and the whole thing reads as empty, which was the complaint. Everything here is
    // derived from the model — no invented furniture.
    //
    //   · concentric rings at beta = 0.1 … 0.5, so a beam's LENGTH is readable as a value
    //     rather than as a relative size;
    //   · one radial spoke per factor, running the full radius, so the six angular slots are
    //     visible even where a beam is short (the two zero factors especially);
    //   · tick marks along each spoke at the ring radii.
    // `gauge`, not `frame`: `frame` is the rAF callback further down and esbuild rejected the
    // duplicate binding.
    const gauge = new THREE.Group();
    root.add(gauge);

    const RING_BETAS = [0.1, 0.2, 0.3, 0.4, 0.5];
    const betaToRadius = (b: number) => 0.55 + b * 2.6;   // matches FAN.minLength/lengthGain

    const ringMat = new THREE.LineBasicMaterial({ color: ink5, transparent: true, opacity: 0.22 });
    ringMat.userData.baseOpacity = 0.22;
    for (const rb of RING_BETAS) {
      const rad = betaToRadius(rb);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad));
      }
      gauge.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    }

    // Spokes + ticks, one per factor, at that factor's own azimuth.
    const spokeMat = new THREE.LineBasicMaterial({ color: ink5, transparent: true, opacity: 0.16 });
    spokeMat.userData.baseOpacity = 0.16;
    const tickMat = new THREE.LineBasicMaterial({ color: ink5, transparent: true, opacity: 0.34 });
    tickMat.userData.baseOpacity = 0.34;
    const outer = betaToRadius(0.5);
    for (const b of beams) {
      const dx = Math.sin(b.azimuth);
      const dz = Math.cos(b.azimuth);
      gauge.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(dx * outer, 0, dz * outer),
        ]),
        spokeMat,
      ));
      // ticks across the spoke at each ring
      for (const rb of RING_BETAS) {
        const rad = betaToRadius(rb);
        const px = Math.cos(b.azimuth) * 0.035;
        const pz = -Math.sin(b.azimuth) * 0.035;
        gauge.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(dx * rad - px, 0, dz * rad - pz),
            new THREE.Vector3(dx * rad + px, 0, dz * rad + pz),
          ]),
          tickMat,
        ));
      }
    }

    // A vertical axis through the origin — the asset's own line, and it stops the object
    // reading as flat when seen from a low angle.
    gauge.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, 1.05, 0),
      ]),
      new THREE.LineBasicMaterial({ color: ink5, transparent: true, opacity: 0.2 }),
    ));

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
        onActive(k);
      }
    };
    canvas.addEventListener('pointermove', onHover);
    cleanups.push(() => canvas.removeEventListener('pointermove', onHover));

    // ── Render at the element's real size; the pixel-art downscale is gone.
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      renderer.setPixelRatio(Math.min(MAX_DPR, window.devicePixelRatio || 1));
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
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

      // HOVER RESPONSE, eased rather than switched. Three things move together, which is what
      // makes it feel like an instrument answering instead of a colour swap:
      //   · the hovered beam LIFTS off the ground plane and scales out slightly;
      //   · it brightens toward paper while the others dim toward the base colour;
      //   · the whole gauge fades up, so the measuring frame is legible while you read a value.
      for (const m of meshes) {
        const active = m.key === hovered;
        m.hover += ((active ? 1 : 0) - m.hover) * Math.min(1, dt * 9);
        m.mesh.position.y = m.hover * 0.12;
        const sc = 1 + m.hover * 0.05;
        m.mesh.scale.setScalar(sc);
        (m.mesh.material as any).color.copy(m.base).lerp(paper, m.hover * 0.55);
        (m.mesh.material as any).opacity = m.zero ? 0.42 + m.hover * 0.4 : 1;
        if (m.edge) m.edge.position.y = m.hover * 0.12;
      }
      gaugeGlow += ((hovered ? 1 : 0) - gaugeGlow) * Math.min(1, dt * 6);
      for (const child of gauge.children) {
        const mat = (child as any).material;
        if (mat && typeof mat.opacity === 'number') {
          mat.opacity = (mat.userData.baseOpacity ?? mat.opacity) * (1 + gaugeGlow * 0.9);
        }
      }

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
