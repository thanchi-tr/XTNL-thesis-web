"use client";

/**
 * MonteCarloPlume — a decorative 3D "probability plume" for the hero.
 *
 * ~900 particle streams flow from a single Initial-Capital anchor and diverge
 * across the viewport as an illustrative random walk, forming a dense 3D
 * probability cloud. Colour maps the P5 baseline (cool) → P95 optimistic (hot)
 * envelope. Hovering a milestone compresses the nearby particles into a bright
 * singularity to suggest the compounding engine's velocity.
 *
 * IP-SAFE: every trajectory is generated from a fixed decorative seed with
 * hand-picked drift/vol constants that are NOT derived from, and do not encode,
 * any production edge, expectancy, or strategy parameter. Nothing here reflects
 * real performance data — it is purely a visual effect.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Deterministic decorative RNG (mulberry32 + Box–Muller) ─────────────── */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const X_MIN = -4.3;   // Initial Capital anchor (left)
const X_MAX = 4.7;    // horizon (right)
const PLUME_HEIGHT = 2.7;

export type Quality = "high" | "low";

interface PlumeGeometry {
  geometry: THREE.BufferGeometry;
  dispose: () => void;
}

/* Build all trajectories once into a single interleaved-attribute geometry. */
function buildGeometry(paths: number, steps: number): PlumeGeometry {
  const rand = mulberry32(0x58544e4c); // "XTNL"
  const gauss = () => {
    const u = 1 - rand(), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const count = paths * steps;
  const position = new Float32Array(count * 3);
  const aStep    = new Float32Array(count);
  const aRand    = new Float32Array(count);
  const aPathT   = new Float32Array(count);
  const aPhase   = new Float32Array(count);

  // Decorative constants — not production parameters.
  const DRIFT = 0.02;
  const VOL   = 0.078;
  const Z_SPREAD = 1.05;

  const finalY = new Float32Array(paths);
  const xTmp   = new Float32Array(count);
  const yTmp   = new Float32Array(count);
  const zTmp   = new Float32Array(count);

  const stepW = (X_MAX - X_MIN) / (steps - 1);
  let maxAbsY = 1e-6;

  for (let p = 0; p < paths; p++) {
    let y = gauss() * 0.03;
    const zSeed = (rand() * 2 - 1) * Z_SPREAD;
    const phase = rand() * Math.PI * 2;
    const xOff  = (rand() - 0.5) * stepW * 1.1;   // per-path column break-up
    for (let s = 0; s < steps; s++) {
      const i = p * steps + s;
      const t = s / (steps - 1);        // 0..1 along the path
      y += DRIFT + VOL * gauss();
      const z = zSeed * t + gauss() * 0.05 * t;
      // jitter X off the shared step grid, but keep the anchor (t≈0) tight
      const jt = Math.min(t * 4, 1);
      xTmp[i] = THREE.MathUtils.lerp(X_MIN, X_MAX, t) + (xOff + (rand() - 0.5) * stepW * 0.85) * jt;
      yTmp[i] = y;
      zTmp[i] = z;
      aStep[i]  = t;
      aRand[i]  = rand();
      aPhase[i] = phase;
      if (Math.abs(y) > maxAbsY) maxAbsY = Math.abs(y);
    }
    finalY[p] = y;
  }

  // Percentile rank of each path's outcome → colour + brightness weight.
  const order = Array.from({ length: paths }, (_, i) => i).sort((a, b) => finalY[a] - finalY[b]);
  const pathT = new Float32Array(paths);
  for (let r = 0; r < paths; r++) pathT[order[r]] = paths > 1 ? r / (paths - 1) : 0.5;

  const yScale = PLUME_HEIGHT / (maxAbsY * 2);

  for (let p = 0; p < paths; p++) {
    for (let s = 0; s < steps; s++) {
      const i = p * steps + s;
      position[i * 3 + 0] = xTmp[i];
      position[i * 3 + 1] = yTmp[i] * yScale;
      position[i * 3 + 2] = zTmp[i];
      aPathT[i] = pathT[p];
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aStep",  new THREE.BufferAttribute(aStep, 1));
  geometry.setAttribute("aRand",  new THREE.BufferAttribute(aRand, 1));
  geometry.setAttribute("aPathT", new THREE.BufferAttribute(aPathT, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 8);

  return { geometry, dispose: () => geometry.dispose() };
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uFocusX;
  uniform float uFocusStrength;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uLock;      // 0 = fluid green, 1 = rigid red lockdown

  attribute float aStep;
  attribute float aRand;
  attribute float aPathT;
  attribute float aPhase;

  varying float vColorT;
  varying float vGlow;
  varying float vAlpha;
  varying float vLock;

  void main() {
    float fluid = 1.0 - uLock;
    vec3 pos = position;

    // plume breathing — amplitude grows toward the diverged (right) end (frozen on lock)
    pos.y += sin(uTime * 0.6 + aPhase + pos.x * 0.5) * 0.06 * aStep * fluid;
    pos.z += cos(uTime * 0.5 + aPhase * 1.3) * 0.05 * aStep * fluid;

    // lockdown: snap to a rigid lattice — fluid cloud → static matrix
    vec3 rigid = floor(pos * 1.9 + 0.5) / 1.9;
    pos = mix(pos, rigid, uLock);

    // intro reveal front sweeping left → right
    float edge   = uReveal * 1.15;
    float appear = smoothstep(edge, edge - 0.2, aStep);

    // continuous "compounding front" light sweep
    float front     = fract(uTime * 0.085);
    float frontGlow = smoothstep(0.05, 0.0, abs(aStep - front)) * 0.85 * fluid;

    // milestone singularity — draw particles toward (uFocusX, 0, 0) into a
    // defined bright core (tighter gather + softer pull avoids a white blow-out)
    float d    = pos.x - uFocusX;
    float prox = exp(-d * d * 5.5);
    float pull = uFocusStrength * prox * fluid;
    pos = mix(pos, vec3(uFocusX, 0.0, 0.0), pull * 0.8);
    float focusGlow = pull;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.6 + aPathT * 0.9) * (0.5 + frontGlow + focusGlow * 2.0 + uLock * 0.35);
    gl_PointSize = clamp(size * uPixelRatio * (260.0 / -mv.z), 1.0, 40.0);

    vColorT = aPathT;
    vGlow   = frontGlow + focusGlow * 2.2;
    vAlpha  = mix(appear * (0.42 + aStep * 0.5) * (0.58 + aRand * 0.42), appear * 0.85, uLock);
    vLock   = uLock;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform vec3 uColorLock;

  varying float vColorT;
  varying float vGlow;
  varying float vAlpha;
  varying float vLock;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, r);

    vec3 col = vColorT < 0.5
      ? mix(uColorLow, uColorMid, vColorT * 2.0)
      : mix(uColorMid, uColorHigh, (vColorT - 0.5) * 2.0);
    col += vGlow * 0.62;

    // lockdown → deep red rigid matrix
    col = mix(col, uColorLock, vLock);

    gl_FragColor = vec4(col, soft * vAlpha);
  }
`;

/* Scroll-driven camera keyframes — a gentle drift that keeps the plume framed
   throughout (subtle push-in, then a slight lift to a three-quarter angle).    */
const CAM_KEYS: { pos: [number, number, number]; tgt: [number, number, number] }[] = [
  { pos: [0.0, 0.35, 6.4], tgt: [0.0, 0.0, 0.0] },
  { pos: [0.3, 0.20, 5.9], tgt: [0.8, 0.03, 0.0] },
  { pos: [1.3, 0.55, 5.7], tgt: [0.3, 0.0, 0.0] },
];
const ease = (u: number) => u * u * (3 - 2 * u);

function Plume({
  quality,
  focusRef,
  progressRef,
  lockRef,
}: {
  quality: Quality;
  focusRef: React.MutableRefObject<number | null>;
  progressRef: React.MutableRefObject<number>;
  lockRef: React.MutableRefObject<boolean>;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const start = useRef<number>(0);

  const camPos = useMemo(() => new THREE.Vector3(...CAM_KEYS[0].pos), []);
  const camTgt = useMemo(() => new THREE.Vector3(...CAM_KEYS[0].tgt), []);
  const tmpP = useMemo(() => new THREE.Vector3(), []);
  const tmpT = useMemo(() => new THREE.Vector3(), []);
  const smoothProg = useRef(0);

  const [paths, steps] = quality === "high" ? [1000, 56] : [380, 42];

  const { geometry } = useMemo(() => buildGeometry(paths, steps), [paths, steps]);

  const uniforms = useMemo(
    () => ({
      uTime:          { value: 0 },
      uReveal:        { value: 0 },
      uFocusX:        { value: 0 },
      uFocusStrength: { value: 0 },
      uSize:          { value: 0.115 },
      uPixelRatio:    { value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.75) },
      uLock:          { value: 0 },
      uColorLow:      { value: new THREE.Color("#3f78d8") }, // P5 baseline — cool
      uColorMid:      { value: new THREE.Color("#00cc7a") }, // median — brand green
      uColorHigh:     { value: new THREE.Color("#7df0b0") }, // P95 optimistic — bright
      uColorLock:     { value: new THREE.Color("#ff2637") }, // lockdown — deep red
    }),
    []
  );

  useFrame((state, delta) => {
    const m = matRef.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    if (start.current === 0) start.current = t;
    const since = t - start.current;
    const dt = Math.min(delta, 0.05);   // clamp to avoid jumps after a stall

    m.uniforms.uTime.value = t;

    // eased intro reveal (~2.4s)
    const rp = Math.min(since / 2.4, 1);
    m.uniforms.uReveal.value = 1 - Math.pow(1 - rp, 3);

    // milestone focus — framerate-independent ease
    const focus = focusRef.current;
    m.uniforms.uFocusStrength.value = THREE.MathUtils.damp(
      m.uniforms.uFocusStrength.value, focus === null ? 0 : 1, 9, dt);
    if (focus !== null) m.uniforms.uFocusX.value = focus;

    // lockdown phase-shift — quick snap into the rigid red state
    m.uniforms.uLock.value = THREE.MathUtils.damp(
      m.uniforms.uLock.value, lockRef.current ? 1 : 0, 12, dt);

    // scroll-driven camera traversal — smooth the scroll input first, then derive
    // the camera deterministically so discrete wheel steps read as fluid motion.
    const progTarget = Math.min(Math.max(progressRef.current, 0), 1);
    // silky for small scroll deltas, but snap fast on big jumps (e.g. returning
    // to the hero) so the camera never reads as "stuck" off-screen
    const lambda = Math.abs(progTarget - smoothProg.current) > 0.35 ? 9 : 3.2;
    smoothProg.current = THREE.MathUtils.damp(smoothProg.current, progTarget, lambda, dt);
    const prog = smoothProg.current;
    let a: number, b: number, u: number;
    if (prog < 0.5) { a = 0; b = 1; u = ease(prog / 0.5); }
    else            { a = 1; b = 2; u = ease((prog - 0.5) / 0.5); }
    camPos.set(...CAM_KEYS[a].pos).lerp(tmpP.set(...CAM_KEYS[b].pos), u);
    camTgt.set(...CAM_KEYS[a].tgt).lerp(tmpT.set(...CAM_KEYS[b].tgt), u);
    state.camera.position.copy(camPos);
    state.camera.lookAt(camTgt);

    // subtle pointer parallax — fades out as we dive / lock
    const g = groupRef.current;
    if (g) {
      const damp = (1 - prog) * (1 - m.uniforms.uLock.value);
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, state.pointer.x * 0.13 * damp, 3, dt);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -state.pointer.y * 0.09 * damp, 3, dt);
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={VERT}
          fragmentShader={FRAG}
        />
      </points>
    </group>
  );
}

export default function MonteCarloPlume({
  quality = "high",
  active = true,
  focusRef,
  progressRef,
  lockRef,
}: {
  quality?: Quality;
  active?: boolean;
  focusRef: React.MutableRefObject<number | null>;
  progressRef: React.MutableRefObject<number>;
  lockRef: React.MutableRefObject<boolean>;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.35, 6.4], fov: 42 }}
      style={{ pointerEvents: "none" }}
    >
      <Plume quality={quality} focusRef={focusRef} progressRef={progressRef} lockRef={lockRef} />
    </Canvas>
  );
}
