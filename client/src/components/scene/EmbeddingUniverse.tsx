import { Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ProjectedPoint } from "@shared/types";

const AMBIENT_COUNT = 280;

type UniverseProps = {
  points: ProjectedPoint[];
  queryProjection?: [number, number, number];
  highlightedIds: Set<string>;
  selectedId?: string;
  onSelect: (point: ProjectedPoint) => void;
  onHover: (point?: ProjectedPoint) => void;
  resetToken: number;
  fitToken: number;
  reducedMotion: boolean;
};

function AmbientField({ reducedMotion }: { reducedMotion: boolean }) {
  const positions = useMemo(() => {
    const values = new Float32Array(AMBIENT_COUNT * 3);
    for (let index = 0; index < AMBIENT_COUNT; index += 1) {
      const radius = 4.8 + (index % 11) * 0.16;
      const theta = index * 0.73;
      values[index * 3] = Math.cos(theta) * radius;
      values[index * 3 + 1] = Math.sin(theta * 1.11) * 2.2;
      values[index * 3 + 2] = Math.sin(theta) * radius;
    }
    return values;
  }, []);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(() => {
    if (reducedMotion) return;
    let frame: number | undefined;
    const tick = () => {
      if (pointsRef.current) pointsRef.current.rotation.y += 0.00035;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      } else if (document.visibilityState === "visible" && frame === undefined) {
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reducedMotion]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={AMBIENT_COUNT} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#596064" size={0.022} sizeAttenuation transparent opacity={0.6} />
    </points>
  );
}

function Grid() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
      <gridHelper args={[10, 18, "#2a3030", "#171b1b"]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function WaveBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() } }), []);
  useFrame(({ clock, pointer }) => {
    if (!materialRef.current) return;
    if (!reducedMotion) materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    materialRef.current.uniforms.uPointer.value.lerp(new THREE.Vector2(pointer.x, pointer.y), 0.035);
  });
  return (
    <mesh position={[0, 0, -6]}>
      <planeGeometry args={[18, 12]} />
      <shaderMaterial ref={materialRef} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`uniform float uTime; uniform vec2 uPointer; varying vec2 vUv; void main(){vec2 uv=vUv*2.0-1.0;float t=uTime*0.12;float w=sin(uv.x*3.4+t+uPointer.x*0.4)*0.11+sin(uv.y*4.2-t*0.7+uPointer.y*0.3)*0.08+sin((uv.x+uv.y)*6.0+t*0.45)*0.035;float horizon=smoothstep(0.9,-0.55,uv.y);vec3 graphite=vec3(0.008,0.012,0.012);vec3 sage=vec3(0.075,0.13,0.12);vec3 amber=vec3(0.16,0.105,0.045);vec3 color=graphite+sage*(0.34+0.22*w)*horizon+amber*max(0.0,w)*0.08;float vignette=1.0-smoothstep(0.25,1.25,length(uv*vec2(0.85,0.72)));gl_FragColor=vec4(color*vignette,0.92);}`} />
    </mesh>
  );
}

function SceneContents({ props }: { props: UniverseProps }) {
  const controlsRef = useRef<any>(null);
  const parallaxRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(({ pointer }) => {
    if (props.reducedMotion || !parallaxRef.current) return;
    parallaxRef.current.rotation.y += (pointer.x * 0.018 - parallaxRef.current.rotation.y) * 0.035;
    parallaxRef.current.rotation.x += (-pointer.y * 0.012 - parallaxRef.current.rotation.x) * 0.035;
  });

  useEffect(() => {
    if (props.resetToken > 0) {
      camera.position.set(4.8, 2.4, 6.8);
      controlsRef.current?.target.set(0, 0, 0);
      controlsRef.current?.update();
    }
  }, [camera, props.resetToken]);

  useEffect(() => {
    if (props.fitToken > 0 && props.points.length > 0) {
      const box = new THREE.Box3();
      props.points.forEach(point => box.expandByPoint(new THREE.Vector3(point.x * 2.8, point.y * 2.2, point.z * 2.8)));
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(2.5, box.getSize(new THREE.Vector3()).length() * 0.55);
      camera.position.set(center.x + radius, center.y + radius * 0.55, center.z + radius);
      controlsRef.current?.target.copy(center);
      controlsRef.current?.update();
    }
  }, [camera, props.fitToken, props.points]);

  const queryPosition = props.queryProjection ? [props.queryProjection[0] * 2.8, props.queryProjection[1] * 2.2, props.queryProjection[2] * 2.8] as [number, number, number] : undefined;
  const retrievedPoints = props.points.filter(point => props.highlightedIds.has(point.chunkId));

  return (
    <>
      <PerspectiveCamera makeDefault position={[4.8, 2.4, 6.8]} fov={42} />
      <ambientLight intensity={0.38} color="#c9d1ce" />
      <pointLight position={[2, 4, 4]} intensity={3} distance={12} color="#d6a85e" />
      <pointLight position={[-4, 1, -2]} intensity={1.4} distance={10} color="#93a6a1" />
      <group ref={parallaxRef}>
      <WaveBackdrop reducedMotion={props.reducedMotion} />
      <AmbientField reducedMotion={props.reducedMotion} />
      <Grid />
      <group>
        {props.points.map(point => {
          const active = props.highlightedIds.has(point.chunkId);
          const selected = props.selectedId === point.chunkId;
          return (
            <mesh
              key={point.chunkId}
              position={[point.x * 2.8, point.y * 2.2, point.z * 2.8]}
              scale={selected ? 1.8 : active ? 1.5 : 1}
              onPointerOver={event => { event.stopPropagation(); props.onHover(point); }}
              onPointerOut={event => { event.stopPropagation(); props.onHover(undefined); }}
              onClick={event => { event.stopPropagation(); props.onSelect(point); }}
            >
              <sphereGeometry args={[selected ? 0.105 : 0.07, 12, 12]} />
              <meshStandardMaterial color={active ? "#d6a85e" : selected ? "#f3e7cc" : "#aab7b3"} emissive={active ? "#7e5724" : "#1c2523"} emissiveIntensity={active ? 1.2 : 0.25} roughness={0.52} metalness={0.55} />
            </mesh>
          );
        })}
      </group>
      {props.queryProjection && (
        <>
          <mesh position={[props.queryProjection[0] * 2.8, props.queryProjection[1] * 2.2, props.queryProjection[2] * 2.8]}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#f4f0e7" emissive="#f4f0e7" emissiveIntensity={1.1} roughness={0.2} metalness={0.2} />
          </mesh>
          <mesh position={[props.queryProjection[0] * 2.8, props.queryProjection[1] * 2.2, props.queryProjection[2] * 2.8]}>
            <ringGeometry args={[0.25, 0.29, 32]} />
            <meshBasicMaterial color="#d6a85e" transparent opacity={0.75} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      {queryPosition && retrievedPoints.map(point => <Line key={`link-${point.chunkId}`} points={[queryPosition, [point.x * 2.8, point.y * 2.2, point.z * 2.8]]} color="#d6a85e" lineWidth={0.55} transparent opacity={0.28} />)}
      </group>
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} minDistance={2.6} maxDistance={14} makeDefault />
    </>
  );
}

export default function EmbeddingUniverse(props: UniverseProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="always"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor("#0b0d0d", 0);
      }}
      fallback={<div className="scene-fallback">WebGL unavailable — use the evidence table below.</div>}
    >
      <SceneContents props={props} />
    </Canvas>
  );
}
