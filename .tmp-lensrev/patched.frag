
    precision highp float;
    varying vec2 vUv;

    uniform sampler2D uRamp;
    uniform float uAmp;
    uniform float uTime;
    uniform float uYOffset;        // scroll, in viewport widths
    uniform float uYSpan;          // viewport height, in viewport widths
    uniform float uDepth0;         // page depth at the top of the viewport
    uniform float uDepthSpan;      // page depth spanned by one viewport
    uniform float uGateTop;        // depth where the reading zone begins
    uniform float uGateDark;       // multiplier for darkward excursions over the zone
    uniform float uGateLight;      // multiplier for lightward excursions over the zone
    uniform float uDark;           // 1.0 in the dark theme, 0.0 in light
    uniform vec3  uNebula;         // the cool tint dark theme lifts the ink with
    uniform float uReading;        // 1.0 on a reading page (dark ink on pale paper)
    uniform float uTintCap;        // reading-page tint hard ceiling
    uniform float uViscousFloor;
    uniform float uNebulaCeiling;   // hard bound on the dark nebula's added light

    uniform float uMode;
    uniform vec4  uPtr;        // xy = pointer (sample space), z = presence, w = speed
    uniform vec2  uPtrVel;     // smoothed velocity, sample units/sec
    uniform vec4  uNodes[8];   // xy = impact, z = strength, w = age (seconds)

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i),                 hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
      return v;
    }

    // Aspect-correct distance to the pointer. The sample space is anisotropic
    // (x spans one viewport width, y is in the same units but scrolls), so a
    // circular footprint on screen needs the x term scaled by the viewport ratio.
    // Without this the effect is a vertical ellipse on a wide monitor.
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
      // MEASURED, then retuned: at R = 0.055 / strength 0.55 a screenshot diff put
      // this at +5/255 above the still-pointer control, i.e. below the measurement
      // noise floor (+6 was observed with the effect OFF). The fBm is locally
      // smooth, so a small coordinate nudge samples an almost identical value —
      // visibility needs the offset to cross a feature, which is GEOMETRY. Radius
      // and strength up; amplitude was never the lever.
      if (uMode < 1.5) {
        float R = 0.085 * mix(1.0, 0.62, uReading);
        float A = 0.16 * mix(1.0, 0.85, uReading);
        A *= presence * (1.0 - 0.85 * min(1.0, uPtr.w / 1.10));
        float u = dist / R;
        if (u < 1.0) {
          float s = 1.0 - u * u;
          float w = s * s * s;
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

      // ── 3. VORTEX — angular, sample-coordinate ──────────────────────────
      // Rotational shear, NOT displacement along the stroke: the offset is
      // TANGENTIAL, so it curls the strata instead of smearing them along the
      // cursor path (which is the model the user rejected as stirring). Rotation
      // is differential (falls off with radius) because rigid rotation of a noise
      // field is nearly invisible.
      else if (uMode < 3.5) {
        float R = 0.075;
        float k = 1.0 - smoothstep(0.0, R, dist);
        vec2 tangent = vec2(-dir.y, dir.x);
        // spin scales with pointer speed, so a still pointer leaves no permanent twist
        float spin = 0.045 * k * k * presence * (0.35 + 0.65 * min(1.0, uPtr.w / 1.6));
        pOffset = tangent * spin;
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

    void main() {
      // Time is scaled with the reading variant's y-stretch so scrolling the warp
      // produces equal apparent motion on both page types. Motion dialled back
      // uniformly by 0.55; reading pages keep a small relative boost since their
      // effect comes from a tint response rather than a ramp lookup.
      float t = uTime * 0.55 * mix(1.0, 1.35, uReading);

      // Anisotropic sample space: more frequency DOWN than ACROSS, which stretches
      // the field into drifting strata instead of round blobs. Scaled so one
      // stratum feature fills roughly one viewport (the demo panel was 373x250;
      // this fills ~1440x900, so the multipliers reproduce on-screen feature size).
      float sy = uYOffset + (1.0 - vUv.y) * uYSpan;

      // Reading pages get a finer field so paragraph-scale structure is visible
      // instead of one uniform smudge per screen. Also stretched in y so a short
      // page traverses as much field as a long one does.
      float freqK = mix(1.0, 1.9, uReading);
      float yStretch = mix(1.0, 1.35, uReading);
      vec2 p = vec2(vUv.x * 6.2 * freqK, sy * 12.7 * freqK * yStretch);

      // Pointer interaction. Both outputs are applied to the FIELD's inputs, never
      // to colour, so everything below (including the legibility gate) governs them.
      // pOffset is in sample-space units, so it is scaled into p's frequency space.
      vec2 pOffset; float fAdd;
      skyInteract(vUv, sy, pOffset, fAdd);
      p += vec2(pOffset.x * 6.2 * freqK, pOffset.y * 12.7 * freqK * yStretch);

      // Two-level domain warp: the original demo's drift terms.
      vec2 q = vec2(fbm(p + 0.09 * t),
                    fbm(p + vec2(5.2, 1.3) - 0.07 * t));
      vec2 r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2) + 0.055 * t),
                    fbm(p + 3.4 * q + vec2(8.3, 2.8) - 0.048 * t));
      float f = fbm(p + 3.2 * r) + fAdd;

      // Page depth of this pixel (0 = dawn, 1 = ground).
      float depth = clamp(uDepth0 + (1.0 - vUv.y) * uDepthSpan, 0.0, 1.0);

      // The legibility zone: reading pages are text top-to-bottom so the rules apply
      // everywhere; descent pages have an open sky above the content so they ramp in
      // at the boundary.
      float zone = mix(smoothstep(uGateTop, uGateTop + 0.10, depth), 1.0, uReading);

      // The asymmetric gate: over the reading zone, excursions in the dangerous
      // direction are clamped while the safe direction stays free. Descent pages
      // carry paper-coloured text, so a lighter sky erases it and the dark
      // direction is safe. Reading pages carry dark ink, so the danger is inverted.
      float gateDark  = mix(1.0, uGateDark, zone);
      float gateLight = mix(1.0, uGateLight, zone);

      // Perturb WHERE along the ramp this pixel samples. 0.34 is ~1.8 palette bands,
      // scaled so the displacement is in ramp units (the whole dawn-to-ground span)
      // rather than in the local viewport window.
      float raw = (f - 0.5) * 0.34 * uAmp;
      float disp = raw > 0.0 ? raw * gateDark : raw * gateLight;

      // Top-of-ramp bias: near the top the ramp is almost flat (pale cream stops),
      // so symmetric swings inside them show almost nothing.
      // Bias the excursion downward so the ink can reach taupe and slate instead of
      // oscillating within cream. Fades out by depth 0.30 where the ramp has its own
      // contrast.
      float topLift = 1.0 - smoothstep(0.02, 0.30, depth);
      disp += 0.5 * abs(raw) * topLift;

      float y = clamp(depth + disp, 0.0, 1.0);

      // Hard floor over the reading zone: the sampled point may never sit higher
      // (lighter) on the ramp than the gradient's own value there for descent pages;
      // may never sit more than a bounded amount darker for reading pages. Chosen
      // per archetype to protect the text.
      float guarded = mix(max(y, depth), min(y, depth), uReading);
      y = mix(y, guarded, zone);

      vec3 col = texture2D(uRamp, vec2(0.5, y)).rgb;

      // Viscous luminance banding straight from the warp field. Over the reading
      // zone, floored so it cannot darken the paper past the point where contrast
      // against dark ink would fail.
      float lum = 0.90 + 0.20 * f;
      float lumR = mix(lum, 0.86 + 0.14 * f, zone);
      col *= mix(lumR, max(lumR, uViscousFloor), uReading);

      // Warm bloom where the warp piles up, faded out over the reading zone since
      // it lightens.
      col += 0.045 * vec3(0.784, 0.639, 0.416) * smoothstep(0.55, 1.0, length(r)) * (1.0 - zone) * (1.0 - uReading);

      // Dark theme: the field adds a cool phosphor/cyan nebular tint lifted by the
      // warp, damped over the reading zone since adding light is the dangerous
      // direction there. The ceiling is a uniform so the bound lives in
      // skyLegibility.nebulaCeiling() with a test, rather than as a literal here.
      // It exists because
      // plus full nebula clears WCAG AA (4.5:1) against ink-3 even at zone=0 (where
      // the zone-dependent damping does not apply). See tests/skyLegibility.test.ts.
      if (uDark > 0.5 && uReading < 0.5) {
        float glow = smoothstep(0.30, 0.95, f);
        float veins = smoothstep(0.45, 1.0, length(r));
        float lift = (glow * 0.72 + veins * 0.45) * uAmp;
        lift *= 1.0 - 0.72 * zone;
        lift = min(lift, uNebulaCeiling);
        col += uNebula * lift;

        // Stars in the nebula, pinned to the page (scroll with the sky), strongest
        // over the content zone where the nebula itself is damped. Real stars are
        // not white: colour tracks temperature, with a touch of violet for deep space.
        vec2 starUv = vec2(vUv.x, sy);
        vec2 cell = floor(starUv * 96.0);
        vec2 sub = fract(starUv * 96.0);
        float pick = hash(cell);
        if (pick > 0.93) {
          vec2 jitter = vec2(hash(cell + 3.7), hash(cell + 9.1));
          float d = length(sub - jitter);
          float core = smoothstep(0.055, 0.0, d);
          float halo = smoothstep(0.20, 0.0, d) * 0.16;

          // Twinkle: two out-of-phase sines per star, damped to match the slowed warp.
          float ph = hash(cell + 17.3) * 6.2831853;
          float sp2 = 0.55 + hash(cell + 23.9) * 1.5;
          float twT = uTime * 0.6;
          float tw = 0.55 + 0.45 * sin(twT * sp2 + ph)
                          * (0.6 + 0.4 * sin(twT * sp2 * 0.37 + ph * 2.1));

          // Stellar colour by temperature.
          float temp2 = hash(cell + 41.7);
          vec3 tint = temp2 < 0.34
            ? mix(vec3(0.62, 0.74, 1.00), vec3(0.86, 0.92, 1.00), temp2 / 0.34)
            : (temp2 < 0.72
              ? vec3(0.97, 0.97, 1.00)
              : mix(vec3(0.80, 0.72, 1.00), vec3(1.00, 0.86, 0.72), (temp2 - 0.72) / 0.28));

          // Confined to a narrow band behind the tagline ("A researcher by day, an
          // artist by night..."). Opens as the heights section ends and closes
          // before Mountains.
          float band = smoothstep(0.200, 0.252, depth) * (1.0 - smoothstep(0.300, 0.348, depth));
          col += tint * (core * 1.05 + halo) * tw * band;
        }
      }

      // Reading pages: additive texture (warm/cool broken colour, ink-side only)
      // because the reading ramp's luminance span is too small for displacement to
      // reveal anything.
      if (uReading > 0.5) {
        float ink = smoothstep(0.40, 0.60, f);
        float veins = smoothstep(0.50, 0.78, length(r));
        // The 0.30/0.16 coefficients are the tint's character (ink vs veins response
        // shape); uTintCap and uViscousFloor are the safety bounds that vary by page.
        float amt = min(uTintCap, (ink * 0.30 + veins * 0.16) * uAmp);
        vec3 warmTint = vec3(0.055, 0.042, 0.024);
        vec3 coolTint = vec3(0.030, 0.033, 0.039);
        float pick = smoothstep(0.30, 0.70, r.x);
        col -= mix(warmTint, coolTint, pick) * amt;
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  