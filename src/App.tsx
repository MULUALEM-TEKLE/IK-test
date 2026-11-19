import { Canvas } from '@react-three/fiber'
import { Edges, Grid, OrbitControls } from '@react-three/drei'
import { Leva } from 'leva'
import { Suspense, useRef } from 'react'
import type { Group } from 'three'
import { Character } from './Character'

const COMPARE = location.search.includes('compare')

// One course along +x: a step whose edge runs under the path (straddle pose), stairs up, stairs down, a ramp and a platform.
// x, z, height (1.2 m blocks)
const BOXES: [x: number, z: number, h: number][] = [
  [2.2, -0.62, 0.22],
  [4.2, 0, 0.15],
  [5.4, 0, 0.3],
  [6.6, 0, 0.45],
  [7.8, 0, 0.3],
  [9, 0, 0.15],
  [13.6, 0, 0.35],
]
// x start, length, rise: a slope up to the platform
const RAMP = { x: 10.6, len: 2.4, rise: 0.35 }
const RAMP_ANGLE = Math.atan2(RAMP.rise, RAMP.len)
const RAMP_EXTRA = 0.3 // longer at the low end only, so that end sinks into the ground
const RAMP_LEN = Math.hypot(RAMP.len, RAMP.rise) + RAMP_EXTRA

export default function App() {
  if (!COMPARE) return <Scene />
  return (
    <div className="compare">
      <header>
        <h1>Foot locking with two-bone IK</h1>
        <p>
          Same Mixamo run clip, same input. <b>Left:</b> raw animation, the planted foot slides and clips through
          steps. <b>Right:</b> toe contacts are detected from velocity and height, locked in place with
          inertialization, and the leg is re-solved with two-bone IK so the foot stays put.
        </p>
      </header>
      <div className="row">
        <Scene forceIK={false} label="IK off" role="driver" />
        <Scene forceIK label="IK on" role="follower" />
      </div>
      <Leva hidden />
    </div>
  )
}

function Scene({ forceIK, label, role }: { forceIK?: boolean; label?: string; role?: 'driver' | 'follower' }) {
  const ground = useRef<Group>(null)
  return (
    <div className="scene">
      {label && <div className="label">{label}</div>}
      <Canvas shadows gl={{ preserveDrawingBuffer: COMPARE }} camera={{ position: COMPARE ? [0, 1.5, 4.6] : [3, 2.2, 4], fov: 45 }}>
        <color attach="background" args={['#14161b']} />
        <fog attach="fog" args={['#14161b', 9, 32]} />
        <hemisphereLight args={['#cfd8ff', '#2a2420', 0.55]} />
        <directionalLight
          position={[6, 9, 5]}
          color="#fff1e0"
          intensity={2.4}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
        />
        <directionalLight position={[-6, 4, -7]} color="#8fb3ff" intensity={1.3} />
        <group ref={ground}>
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[80, 80]} />
            <meshStandardMaterial color="#1b1d23" roughness={1} />
          </mesh>
          {BOXES.map(([x, z, h], i) => (
            <mesh key={i} position={[x, h / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[1.2, h, 1.2]} />
              <meshStandardMaterial color="#cfc6b8" roughness={0.85} />
              <Edges color="#8a8172" />
            </mesh>
          ))}
          <mesh
            position={[
              RAMP.x + RAMP.len / 2 + Math.sin(RAMP_ANGLE) * 0.05 - (Math.cos(RAMP_ANGLE) * RAMP_EXTRA) / 2,
              RAMP.rise / 2 - Math.cos(RAMP_ANGLE) * 0.05 - (Math.sin(RAMP_ANGLE) * RAMP_EXTRA) / 2,
              0,
            ]}
            rotation-z={RAMP_ANGLE}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[RAMP_LEN, 0.1, 1.2]} />
            <meshStandardMaterial color="#cfc6b8" roughness={0.85} />
            <Edges color="#8a8172" />
          </mesh>
        </group>
        <Grid
          infiniteGrid
          position-y={0.002}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#2b2f38"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#3c4352"
          fadeDistance={34}
          fadeStrength={1.5}
        />
        <Suspense fallback={null}>
          <Character ground={ground} forceIK={forceIK} yaw={COMPARE ? Math.PI / 2 : 0} role={role} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
      <div className="hint">WASD to run · drag to orbit</div>
    </div>
  )
}
