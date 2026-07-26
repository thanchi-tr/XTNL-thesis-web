"use client";

/**
 * LogoMesh3D — the XTNL mark built as REAL 3D geometry (cylinders for the
 * signature strokes, spheres/torus for the nodes), not a flat SVG rotated
 * with a CSS transform. A flat plane collapses to an invisible sliver at 90°
 * and reads wrong past it; real tubes have volume from every angle, occlude
 * each other correctly as the group turns, and the node spheres parallax
 * against one another — it actually looks like an object, not a card.
 *
 * Drag physics (spin + inertia + settle into a perpetual slow showcase
 * rotation) are applied directly to the THREE.Group's rotation.y inside
 * useFrame — same model as before, now driving real 3D rotation instead of
 * a CSS transform.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const FRICTION = 0.94;
const IDLE_SPIN_RPS = (5.5 * Math.PI) / 180; // rad/sec perpetual showcase spin
// The mark's raw geometry spans ~8.25 world units top-to-bottom. Camera is
// pulled back to z=12 at fov=26, giving a visible frustum height of roughly
// 2 * 12 * tan(13deg) ~= 5.5 units — BASE_SCALE keeps the mark's rendered
// height (8.25 * BASE_SCALE) well inside that with real margin, so nothing
// clips at any rotation or during the idle "breathe" scale pulse.
const BASE_SCALE = 0.4;

/* Points lifted from XtnlLogo's 0-80 viewBox, normalized to world units and
   given a little Z relief so the mark reads as faceted rather than flat. */
const P = {
  nodeA:   new THREE.Vector3(-1.625, 4.0,  0.35),
  nodeB:   new THREE.Vector3( 1.375, 3.375, -0.35),
  leftV:   new THREE.Vector3(-2.875, -1.5, -0.22),
  rightV:  new THREE.Vector3( 2.875, -1.5,  0.22),
  bottomV: new THREE.Vector3( 0,     -4.25, 0),
  apex:    new THREE.Vector3( 0,      1.375, 0),
};

const GREEN = "#00e688";
const GREEN_BRIGHT = "#e6fff4";
const BLUE = "#2fd0ff";

function Edge({ a, b, radius, color, opacity = 1, emissiveIntensity = 1.4 }: {
  a: THREE.Vector3; b: THREE.Vector3; radius: number; color: string; opacity?: number; emissiveIntensity?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: mid, quaternion: quat, length: len };
  }, [a, b]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 10, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity < 1}
        opacity={opacity}
        toneMapped={false}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  );
}

function Node({ p, radius, color, glow = 2.2 }: { p: THREE.Vector3; radius: number; color: string; glow?: number }) {
  return (
    <group position={p}>
      <mesh>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} toneMapped={false} roughness={0.25} />
      </mesh>
      {/* soft halo */}
      <mesh>
        <sphereGeometry args={[radius * 2.1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Ring({ p, radius }: { p: THREE.Vector3; radius: number }) {
  return (
    <mesh position={p}>
      <torusGeometry args={[radius, radius * 0.16, 10, 24]} />
      <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={1.1} toneMapped={false} />
    </mesh>
  );
}

function Mark({
  spinRef, velocityRef, tiltRef, draggingRef,
}: {
  spinRef: React.MutableRefObject<number>;
  velocityRef: React.MutableRefObject<number>;
  tiltRef: React.MutableRefObject<number>;
  draggingRef: React.MutableRefObject<boolean>;
}) {
  const group = useRef<THREE.Group>(null);
  const { clock } = useThree();

  useFrame((_, delta) => {
    if (!group.current) return;

    // While the pointer is actively dragging, LogoPortrait writes
    // spinRef.current directly (absolute position from drag delta) — this
    // loop must NOT also integrate velocity on top of that in the same
    // frame, or the two systems fight and the rotation jitters/overshoots.
    if (!draggingRef.current) {
      if (Math.abs(velocityRef.current) > 0.0004) {
        spinRef.current += velocityRef.current;
        velocityRef.current *= FRICTION;
      } else {
        spinRef.current += IDLE_SPIN_RPS * delta;
        velocityRef.current = 0;
      }
    }

    const breathe = 1 + Math.sin(clock.elapsedTime * 0.7) * 0.02;
    group.current.rotation.y = spinRef.current;
    group.current.rotation.x = tiltRef.current;
    group.current.scale.setScalar(breathe * BASE_SCALE);
  });

  return (
    <group ref={group}>
      {/* upper ambient fill — a faint translucent plane behind the crossing strokes */}
      <mesh position={[0, 0.9, -0.4]}>
        <planeGeometry args={[5.6, 5.2]} />
        <meshBasicMaterial color={GREEN} transparent opacity={0.05} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* faint upper diamond edges */}
      <Edge a={P.apex} b={P.rightV} radius={0.028} color={GREEN} opacity={0.5} emissiveIntensity={0.6} />
      <Edge a={P.apex} b={P.leftV}  radius={0.028} color={GREEN} opacity={0.5} emissiveIntensity={0.6} />
      {/* lower diamond edges */}
      <Edge a={P.rightV} b={P.bottomV} radius={0.045} color={GREEN} opacity={0.42} emissiveIntensity={0.8} />
      <Edge a={P.leftV}  b={P.bottomV} radius={0.045} color={GREEN} opacity={0.42} emissiveIntensity={0.8} />
      {/* threshold midline */}
      <Edge a={P.leftV} b={P.rightV} radius={0.022} color={GREEN} opacity={0.4} emissiveIntensity={0.6} />

      {/* the crossing X — the hero strokes */}
      <Edge a={P.nodeA} b={P.rightV} radius={0.1}  color={GREEN} emissiveIntensity={1.7} />
      <Edge a={P.nodeB} b={P.leftV}  radius={0.08} color={GREEN} opacity={0.85} emissiveIntensity={1.4} />

      {/* nodes */}
      <Node p={P.nodeA} radius={0.34} color={GREEN_BRIGHT} glow={2.6} />
      <Node p={P.nodeB} radius={0.28} color={GREEN_BRIGHT} glow={2.3} />
      <Node p={P.leftV} radius={0.14} color={GREEN} glow={1.6} />
      <Node p={P.rightV} radius={0.19} color={BLUE} glow={2.2} />
      <Ring p={P.bottomV} radius={0.3} />
    </group>
  );
}

export default function LogoMesh3D({
  spinRef, velocityRef, tiltRef, draggingRef, active,
}: {
  spinRef: React.MutableRefObject<number>;
  velocityRef: React.MutableRefObject<number>;
  tiltRef: React.MutableRefObject<number>;
  draggingRef: React.MutableRefObject<boolean>;
  active: boolean;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 12], fov: 26 }}
      style={{ pointerEvents: "none" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
      }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 5, 6]} intensity={40} color="#dfffef" />
      <pointLight position={[-5, -3, 4]} intensity={18} color="#2fd0ff" />
      <Mark spinRef={spinRef} velocityRef={velocityRef} tiltRef={tiltRef} draggingRef={draggingRef} />
    </Canvas>
  );
}
