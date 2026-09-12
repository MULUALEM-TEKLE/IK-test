import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Leva } from 'leva'
import { Suspense, useRef } from 'react'
import type { Group } from 'three'
import { Character } from './Character'

const COMPARE = location.search.includes('compare')

// x, z, height. Compare mode: a step whose edge runs under the character's path (straddle pose), then a staircase
const BOXES: [x: number, z: number, h: number][] = COMPARE
  ? [
      [2, -0.62, 0.22],
      [4.2, 0, 0.15],
      [5.4, 0, 0.3],
      [6.6, 0, 0.45],
    ]
  : [
      [2, 0, 0.15],
      [3.2, 0, 0.3],
      [4.4, 0, 0.45],
      [-2.5, 1.5, 0.2],
      [0, -3, 0.35],
    ]

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
        <color attach="background" args={['#1e1f24']} />
        <hemisphereLight args={['#cfd8ff', '#3a2f22', 0.8]} />
        <directionalLight
          position={[4, 8, 3]}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <group ref={ground}>
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[60, 60]} />
            <meshStandardMaterial color="#4a4d55" />
          </mesh>
          {BOXES.map(([x, z, h], i) => (
            <mesh key={i} position={[x, h / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[1.2, h, 1.2]} />
              <meshStandardMaterial color="#7a6a55" />
            </mesh>
          ))}
        </group>
        <gridHelper args={[60, 60, '#333', '#2a2b30']} position-y={0.001} />
        <Suspense fallback={null}>
          <Character ground={ground} forceIK={forceIK} yaw={COMPARE ? Math.PI / 2 : 0} role={role} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
      <div className="hint">WASD to run · drag to orbit</div>
    </div>
  )
}
