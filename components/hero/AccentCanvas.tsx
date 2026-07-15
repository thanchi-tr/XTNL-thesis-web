"use client";

/**
 * AccentCanvas — a spacious 3D wireframe surface used as a section motif,
 * viewed through slow parallax "camera work" so it reads as depth, not a badge.
 *
 *   "surface" → a rolling response manifold (the analytics/architecture layer)
 *   "well"    → a mean-reversion potential basin (the risk governor's pull to centre)
 *
 * Decorative only — the height fields are illustrative math, not production data.
 * Lines fade into the distance so the mesh dissolves into the page.
 * Pauses (frameloop="never") when the section is off-screen.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type AccentVariant = "surface" | "well";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uMode;   // 0 = surface, 1 = well
  varying float vDepth;
  varying float vH;
  varying vec2  vUv;

  void main() {
    vec3 p = position;          // plane local space, z displaced below
    float t = uTime;
    float h;
    if (uMode < 0.5) {
      // rolling response manifold
      h = 0.55 * sin(p.x * 0.55 + t * 0.55)
        + 0.42 * sin(p.y * 0.48 - t * 0.42)
        + 0.26 * sin((p.x + p.y) * 0.38 + t * 0.30);
    } else {
      // mean-reversion potential well — high rim, low centre + slow breathing
      float r2 = p.x * p.x + p.y * p.y;
      h = 0.052 * r2 - 1.15 + 0.16 * sin(r2 * 0.45 - t * 0.7);
    }
    vH = h;
    vUv = uv;
    p.z = h;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uFadeNear;
  uniform float uFadeFar;
  varying float vDepth;
  varying float vH;
  varying vec2  vUv;

  void main() {
    float f = clamp((vDepth - uFadeNear) / (uFadeFar - uFadeNear), 0.0, 1.0);

    // feather every edge of the plane so there is no hard rectangular cut-off
    float ex = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
    float ey = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
    float edge = ex * ey;

    float alpha = (1.0 - f) * 0.30 * edge;        // subtle, dissolves into distance
    vec3 col = mix(uNear, uFar, f);
    col += smoothstep(0.6, 1.7, vH) * 0.18;       // faint crest highlight
    gl_FragColor = vec4(col, alpha);
  }
`;

function Surface({ variant }: { variant: AccentVariant }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime:     { value: 0 },
      uMode:     { value: variant === "well" ? 1 : 0 },
      uNear:     { value: new THREE.Color(variant === "well" ? "#3a7fd0" : "#00b86e") },
      uFar:      { value: new THREE.Color("#050c15") },   // blends into --base
      uFadeNear: { value: 2.2 },
      uFadeFar:  { value: 13.0 },
    }),
    [variant]
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mat.current) mat.current.uniforms.uTime.value = t;
    // slow parallax orbit — the "camera work" that reveals depth
    const a = t * 0.06;
    camera.position.x = Math.sin(a) * 0.9;
    camera.position.y = 2.4 + Math.sin(a * 0.7) * 0.25;
    camera.position.z = 5.4 + Math.cos(a) * 0.5;
    camera.lookAt(0, -0.35, -2.0);
  });

  return (
    <mesh rotation={[-1.36, 0, 0]} position={[0, -0.2, -1.5]}>
      <planeGeometry args={[22, 20, 40, 34]} />
      <shaderMaterial
        ref={mat}
        wireframe
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </mesh>
  );
}

export default function AccentCanvas({
  variant,
  active,
}: {
  variant: AccentVariant;
  active: boolean;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 2.4, 5.4], fov: 38 }}
      style={{ pointerEvents: "none" }}
    >
      <Surface variant={variant} />
    </Canvas>
  );
}
