// Pointer interaction for the fluid sky — several models, switchable at runtime.
//
// WHY A MODE UNIFORM RATHER THAN SEPARATE SHADERS: switching models must not
// recompile or reload, because the only way to judge motion is to flip between
// options on the real page while moving the pointer. One program, one branch on
// uMode, costs a few dead instructions and buys instant comparison.
//
// WHERE THE PERTURBATION LANDS, and why that is the whole safety story:
// the shader turns a scalar field f into a ramp displacement — WHERE ALONG THE
// PALETTE RAMP each pixel samples — and then runs that through the asymmetric
// legibility gate (skyLegibility.ts). So a model that perturbs either
//   · the SAMPLE COORDINATE (changing where fbm is evaluated), or
//   · the FIELD f itself (an additive impulse)
// is gated for free — its excursion is subject to the same clamp as the ambient
// churn, on both archetypes, including the inverted danger direction on reading
// pages. Only a model that writes tone or colour DIRECTLY would bypass the gate,
// which is why none of these do.
//
// CALIBRATION (measured, not guessed): the sky's own ambient churn moves a pixel by
// up to ~115/255 over 250ms. A previous round established that a pointer effect
// contributing ~10/255 at its peak reads as "the sky felt touched" and that ~25/255
// read as "disturbed". Every amplitude below is scaled to land in the former band.
// The user's repeated instruction across six tuning rounds was "MILD. very mild."

/** Interaction models, in picker order. 0 is always OFF. */
export interface InteractionMode {
  id: number;
  key: string;
  label: string;
  /** One line for the picker — what you would SEE. */
  hint: string;
}

export const INTERACTION_MODES: InteractionMode[] = [
  { id: 0, key: 'off',     label: 'Off',        hint: 'no pointer response' },
  { id: 1, key: 'lens',    label: 'Lens',       hint: 'the sky’s own pattern bends, like a bead of water' },
  { id: 2, key: 'bloom',   label: 'Bloom',      hint: 'tone answers the pointer, no distortion' },
  { id: 3, key: 'vortex',  label: 'Vortex',     hint: 'a slow swirl that relaxes back' },
  { id: 4, key: 'ripple',  label: 'Ripple',     hint: 'fine expanding rings, a drop touching the surface' },
  { id: 5, key: 'wind',    label: 'Wind',       hint: 'movement drifts the strata, like air over mist' },
];

export const DEFAULT_MODE = 0;

/** Uniforms the interaction adds, appended to SKY_UNIFORMS. */
export const INTERACTION_UNIFORMS = [
  'uMode',       // float: which model (0 = off)
  'uPtr',        // vec4: xy = smoothed pointer in sample space, z = presence 0..1, w = speed
  'uPtrVel',     // vec2: smoothed pointer velocity, sample units / second
  'uNodes',      // vec4[8]: xy = impact point, z = strength, w = age in seconds
] as const;

/** How many ripple impact nodes the shader loops over. MUST match the GLSL's
 *  constant loop bound — WebGL1 forbids a dynamic one. */
export const NODE_COUNT = 8;

// ── Pure helpers, unit-tested ───────────────────────────────────────────────

/** Exponential smoothing factor for a given time constant and frame delta.
 *  Frame-rate independent: the same tau produces the same decay whether the loop
 *  runs at 30fps or 120fps, which matters because this canvas throttles to ~30fps
 *  idle and runs full-rate while scrolling. */
export function smoothingAlpha(dtSeconds: number, tauSeconds: number): number {
  if (tauSeconds <= 0) return 1;
  const a = 1 - Math.exp(-Math.max(0, dtSeconds) / tauSeconds);
  return Math.min(1, Math.max(0, a));
}

/** Ripple node lifetime in seconds. A node past this is dead and reusable. */
export const NODE_LIFETIME = 2.4;

/** Strength of a ripple node at a given age: rises fast, then decays smoothly to
 *  exactly 0 at NODE_LIFETIME so a node never pops out mid-visible. */
export function nodeStrength(ageSeconds: number): number {
  if (ageSeconds < 0 || ageSeconds >= NODE_LIFETIME) return 0;
  const t = ageSeconds / NODE_LIFETIME;
  // (1-t)^2 decay with a short attack, so the impact is immediate but not a pop
  const attack = Math.min(1, ageSeconds / 0.05);
  return attack * (1 - t) * (1 - t);
}

/** Speed (sample units/sec) mapped to a 0..1 drive for velocity-driven models.
 *  Saturates so a fast flick does not produce a huge effect — the cap is what
 *  keeps a sudden movement from reading as a "big event". */
export function speedDrive(speed: number, saturateAt = 1.6): number {
  if (!(speed > 0)) return 0;
  return Math.min(1, speed / saturateAt);
}

// ── The GLSL ────────────────────────────────────────────────────────────────
// NOTE: no backticks anywhere in this string, not even inside comments. A backtick
// in a GLSL comment terminates the template literal and broke the build five times
// in an earlier round; the shader source living in .ts files is the reason the
// hazard exists at all, so the rule is enforced by a test.

/** Declarations, inserted with the other uniforms. */
export const INTERACTION_UNIFORM_DECLS = `
    uniform float uMode;
    uniform vec4  uPtr;        // xy = pointer (sample space), z = presence, w = speed
    uniform vec2  uPtrVel;     // smoothed velocity, sample units/sec
    uniform vec4  uNodes[8];   // xy = impact, z = strength, w = age (seconds)
`;

/**
 * The interaction block. Call BEFORE the warp is evaluated:
 *   vec2 pOffset = vec2(0.0);
 *   float fAdd = 0.0;
 *   skyInteract(vUv, sy, pOffset, fAdd);
 * then add pOffset to the sample coordinate and fAdd to the field.
 *
 * Both outputs feed the field, so both are gated downstream — see the module note.
 */
export const INTERACTION_GLSL = `
    // Distance to the pointer, and it needs NO aspect correction — an earlier
    // version of this comment claimed it did, which reads like a bug and is not one.
    // Both axes are already in the same units: the JS side divides pointer x by the
    // canvas WIDTH and pointer y by the viewport WIDTH too (not the height), so the
    // sample space is isotropic in screen terms and the footprint is a true circle.
    // The field's own 6.2-vs-12.7 anisotropy is applied by skyShader.ts to pOffset
    // exactly as it is to the coordinate itself, which is what preserves that.
    // Do not "fix" this by scaling x — that would make the footprint an ellipse.
    vec2 ptrDelta(vec2 uv, float syNow) {
      return vec2(uv.x - uPtr.x, (syNow - uPtr.y));
    }

    void skyInteract(vec2 uv, float syNow, out vec2 pOffset, out float fAdd) {
      pOffset = vec2(0.0);
      fAdd = 0.0;
      if (uMode < 0.5 || uPtr.z < 0.001) return;

      vec2 d = ptrDelta(uv, syNow);
      float dist = length(d) + 1e-6;
      vec2 dir = d / dist;
      float presence = uPtr.z;

      // ── 1. LENS — refraction, sample-coordinate ─────────────────────────
      // A bead of water resting on the surface: the field is sampled from closer to
      // the pointer inside a radius, so the sky's OWN strata magnify. Nothing is
      // added, so the pixel histogram is unchanged; only WHERE values come from
      // moves. The envelope is a smoothstep to zero, so there is no circular rim.
      //
      // MAGNIFY, NOT PINCH, and measured rather than chosen by taste: at the 0.5x
      // internal resolution, magnifying LOWERS high-frequency energy inside the disc
      // (it enlarges features already there) while pinching RAISES it by a similar
      // amount — on marbled strata at half resolution a pinch shimmers under the
      // cursor and a magnify reads as glass. It also matches the metaphor, since a
      // water bead is convex.
      //
      // THE RIM is this model's classic failure — a faint visible circle at the
      // envelope edge. The envelope is the compact cubic bump w(u) = (1-u^2)^3 on
      // u = dist/R, and the offset is dist * A * w. That form has w, w' AND w''
      // all vanishing at u = 1, so the disc is C2 at its own edge and a rim is
      // impossible by construction rather than merely faint. A
      // (1 - smoothstep(0,R,dist))^2 envelope — the obvious choice, and what this
      // first shipped with — is only C1 there and additionally kinks partway in.
      //
      // The peak displacement is at u = 1/sqrt(7) ~ 0.378, NOT at the centre, where
      // it is zero by construction. A = 0.16 gives ~1.19x magnification centrally
      // with a radial Jacobian that stays strictly positive, so the field can never
      // fold over itself (that would need A > 1).
      if (uMode < 1.5) {
        // R: 0.13 viewport widths ~ 208px radius, a 416px lens (26% of viewport
        // width) at 1600. Up from 0.085 on request for a bigger lens, and it also
        // buys SMOOTHNESS for free: position lag is set by the time constant in px,
        // so a larger radius makes the same lag a smaller fraction of the footprint
        // (0.30R -> 0.20R at 2400px/s). The field's own feature scale is ~58px
        // across, so the disc now spans ~7 features and structure clearly BENDS.
        //
        // Not larger than this: at ~0.18 the lens spans over a third of the screen,
        // where the footprint approaches parity with the sky's own churn and reads as
        // the "way too big drop of water" scale. That is a GEOMETRY ceiling and
        // cannot be bought back by lowering the amplitude.
        //
        // Reading pages run a 1.9x finer field, so R shrinks there to keep roughly the
        // same number of features under the lens.
        float R = 0.13 * mix(1.0, 0.62, uReading);
        // A trimmed 0.16 -> 0.14 because peak displacement scales with R*A: at the
        // larger radius the old A gave ~7.9px of pull (1.5x the previous 5.2px), which
        // overshoots "mild". 0.14 lands at ~6.9px — a little more present than before,
        // since the ask was for more presence, but not a different order of effect.
        float A = 0.14 * mix(1.0, 0.85, uReading);
        // Slightly quieter while moving, but only slightly. Two rounds of tuning
        // walked this down: 0.85 deep made the lens drop to ~15% during any ordinary
        // move, so following it felt like the effect cutting out and reappearing when
        // you stopped; 0.45 still cost ~43% at a flick, which COMPOUNDED with position
        // lag — the lens was both weaker AND behind the cursor exactly when moving
        // fast, which is the "works slowly, poorly when quick" failure.
        //
        // Now 0.18 deep: a fast move keeps ~82% strength, so what you see at speed is
        // a lens that stays under the cursor rather than a faint smear left behind.
        // The rest-vs-moving distinction is preserved (a bead of water settles when you
        // stop) but it is no longer the dominant term. The guard against becoming the
        // rejected directional trail is now the SHRINKING position lag in the JS, which
        // is the honest place for it — a trail is a lag artefact, not an amplitude one.
        A *= presence * (1.0 - 0.18 * min(1.0, uPtr.w / 1.6));
        float u = dist / R;
        if (u < 1.0) {
          float s = 1.0 - u * u;
          float w = s * s * s;                 // C2 compact bump
          // d is already dir * dist, so this needs no normalize and no divide.
          pOffset = -d * (A * w);
        }
      }

      // ── 2. BLOOM — tone, via the field ──────────────────────────────────
      // No geometric distortion at all: a soft local push of the FIELD, which the
      // ramp then reads as a small tonal shift. Routed through the field (not the
      // colour) specifically so the legibility gate governs it.
      //
      // MEASURED, then retuned: at 0.030 the diff showed +0/255 — completely
      // invisible. The reason is scale, not magnitude: fbm here returns roughly
      // 0..1 and the ramp displacement multiplies (f - 0.5) by 0.34, so a 0.03 field
      // push moves the ramp lookup by ~0.010 of the full dawn-to-ground span — a
      // fraction of one palette band. Raised to 0.14, which is ~0.048 of the ramp
      // (about a quarter band) and lands in the "touched, not disturbed" range.
      else if (uMode < 2.5) {
        float R = 0.115;                       // ~166px at 1440 wide
        float k = 1.0 - smoothstep(0.0, R, dist);
        // smooth^3 so the edge vanishes rather than ending in a visible disc
        fAdd = k * k * k * 0.14 * presence;
      }

      // ── 3. VORTEX — angular, sample-coordinate, driven by TURNING ───────
      // Rotational shear, and the drive is the pointer's signed TURNING RATE, not
      // its speed. That distinction is the whole model.
      //
      // A vortex driven by SPEED is the rejected "stirring up a mix of colors" model
      // wearing a different hat: sustained rotational displacement following a moving
      // cursor reads as stirring whether the offset is tangential or axial. Driving it
      // from turning rate separates them CATEGORICALLY rather than by tuning — a
      // straight stroke has zero curvature, so it produces a bit-identical image to
      // Off. You have to actually turn the pointer to disturb the sky, which is what
      // "a spoon turned once in ink" means physically.
      //
      // Differential rotation (falling off with radius) rather than rigid, because
      // rigidly rotating a noise field is almost invisible — nothing shears.
      else if (uMode < 3.5) {
        float R = 0.085;
        float u = dist / R;
        if (u < 1.0) {
          float s = 1.0 - u * u;
          float w = s * s * s;                 // same C2 bump as the lens: no rim
          vec2 tangent = vec2(-dir.y, dir.x);
          // uPtrVel.x carries the signed turning rate for this model (see the JS).
          // Signed, so turning back the other way unwinds the twist instead of
          // accumulating it — that is what makes it relax rather than smear.
          float spin = clamp(uPtrVel.x, -1.0, 1.0) * 0.075 * w * presence;
          pOffset = tangent * spin;
        }
      }

      // ── 4. RIPPLE — expanding rings, via the field ──────────────────────
      // The model built and tuned in an earlier round, ported: each node is a
      // Gaussian-enveloped radial wave whose radius grows with its own age, so the
      // ring travels outward independently of the pointer. Constants are the
      // TUNED ones from that round (see git history): the footprint fix was
      // geometry, not amplitude.
      else if (uMode < 4.5) {
        for (int i = 0; i < 8; i++) {
          vec4 nd = uNodes[i];
          if (nd.z > 0.001) {
            vec2 nDelta = vec2(uv.x - nd.x, syNow - nd.y);
            float nDist = length(nDelta) + 1e-6;
            float R = nd.w * 0.085;            // wavefront speed
            float ring = exp(-pow((nDist - R) * 26.0, 2.0));
            float wave = sin((nDist - R) * 78.0);
            fAdd += ring * wave * nd.z * 0.055;
          }
        }
      }

      // ── 5. WIND — advection, sample-coordinate, divergence-free ─────────
      // Driven by VELOCITY, so a still pointer does nothing at all. The offset is
      // the curl of a scalar potential, which makes the flow divergence-free: it
      // moves the field around without piling values up anywhere, so it cannot
      // brighten or darken a region — the strongest legibility argument of the set.
      // potential  phi = exp(-(dist/R)^2) * (uPtrVel . d)
      // flow       = perp(grad phi), evaluated analytically below.
      // MEASURED, then retuned: +3/255, below the noise floor. Two causes, both
      // scale rather than amplitude — the velocity that drives it is in sample
      // units/second (a brisk move is ~1-2, not hundreds), and the curl of a
      // gaussian is largest at the envelope's shoulder, not the centre, so a broad R
      // spreads what little there is over a wide area. Tightened R and raised the
      // coefficient; the divergence-free construction is kept, since that is what
      // guarantees it cannot pile brightness up anywhere.
      else {
        float R = 0.115;
        float q = dist / R;
        float env = exp(-q * q);
        float drive = min(1.0, uPtr.w / 1.6) * presence;
        // grad of the gaussian envelope, times the velocity projection
        float proj = dot(uPtrVel, d);
        vec2 gradEnv = -2.0 * d / (R * R) * env;
        vec2 gradPhi = gradEnv * proj + env * uPtrVel;
        vec2 flow = vec2(gradPhi.y, -gradPhi.x);   // perpendicular => curl
        pOffset = flow * 0.30 * drive;
      }
    }
`;
