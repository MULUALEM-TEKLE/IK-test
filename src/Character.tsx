import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useMemo, useRef } from 'react'
import { AnimationClip, Box3, EventDispatcher, Group, Mesh, MeshBasicMaterial, Object3D, Raycaster, SkinnedMesh, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createContact, lookAtTip, twoBoneIK, updateContact, type FootContact } from './ik'

const MODEL = '/ybot.glb' // mesh + skeleton
const ANIMS = '/zen_ben.glb' // clips (same mixamorig skeleton)
const RUN_SPEED = 3.5
const UP = new Vector3(0, 1, 0)
const DOWN = new Vector3(0, -1, 0)

type Leg = {
  hip: Object3D
  knee: Object3D
  heel: Object3D
  toe: Object3D
  contact: FootContact
  prevToe: Vector3
  votes: boolean[]
  debug: Mesh | null
}

const _ray = new Raycaster()
const _v = new Vector3()
const _toe = new Vector3()
const _heel = new Vector3()
const _target = new Vector3()
const _fwd = new Vector3()
const _move = new Vector3()

// compare mode: the driver runs locomotion + clips, the follower mirrors them so only IK differs
const sync = { pos: new Vector3(), yaw: 0, speed: 0, idleTime: 0, runTime: 0, camOwner: 'driver', camPos: new Vector3(), camTarget: new Vector3() }

type Props = { ground: React.RefObject<Group | null>; forceIK?: boolean; yaw?: number; role?: 'driver' | 'follower' }

export function Character({ ground, forceIK, yaw = 0, role }: Props) {
  const group = useRef<Group>(null!)
  const { scene: source } = useGLTF(MODEL)
  const { scene: animSource, animations: sourceClips } = useGLTF(ANIMS)
  const scene = useMemo(() => cloneSkeleton(source), [source]) // one instance per canvas
  // clips come from another mixamorig model: rotations transfer as-is, hips translation needs its unit scale
  const animations = useMemo(() => {
    const k = source.getObjectByName('mixamorigHips')!.position.length() / animSource.getObjectByName('mixamorigHips')!.position.length()
    return sourceClips.map((clip) => {
      const tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name.endsWith('Hips.position')).map((t) => t.clone())
      for (const t of tracks) if (t.name.endsWith('Hips.position')) for (let i = 0; i < t.values.length; i++) t.values[i] *= k
      return new AnimationClip(clip.name, clip.duration, tracks)
    })
  }, [source, animSource, sourceClips])
  const { actions, mixer } = useAnimations(animations, group)
  const controls = useThree((s) => s.controls) as ({ target: Vector3; update: () => void } & EventDispatcher<{ start: object }>) | null
  const camera = useThree((s) => s.camera)
  const keys = useMemo(() => new Set<string>(), [])
  const speed = useRef(0)

  const ik = useControls('IK', {
    enabled: true,
    velThreshold: { value: 1.0, min: 0, max: 3, step: 0.05 },
    heightThreshold: { value: 0.08, min: 0, max: 0.3, step: 0.005 },
    unlockRadius: { value: 0.25, min: 0, max: 1, step: 0.01 },
    halflife: { value: 0.04, min: 0.005, max: 0.3, step: 0.005 },
    debug: true,
  })

  // rig lookup + calibration, once
  const rig = useMemo(() => {
    scene.updateMatrixWorld(true)
    const bone = (n: string) => scene.getObjectByName('mixamorig' + n)!
    const skins: SkinnedMesh[] = []
    scene.traverse((o) => (o as SkinnedMesh).isSkinnedMesh && skins.push(o as SkinnedMesh))
    for (const skin of skins) {
      skin.frustumCulled = false
      skin.castShadow = true
    }

    // toe joint height above the sole, measured in the rest (= bind) pose before any clip plays
    scene.updateMatrixWorld(true)
    const bbox = new Box3()
    for (const skin of skins) bbox.union(new Box3().setFromBufferAttribute(skin.geometry.attributes.position as never).applyMatrix4(skin.matrixWorld))
    const toeOffset = bone('LeftToeBase').getWorldPosition(new Vector3()).y - bbox.min.y

    const legs: Leg[] = (['Left', 'Right'] as const).map((side) => ({
      hip: bone(side + 'UpLeg'),
      knee: bone(side + 'Leg'),
      heel: bone(side + 'Foot'),
      toe: bone(side + 'ToeBase'),
      contact: createContact(bone(side + 'ToeBase').getWorldPosition(new Vector3())),
      prevToe: bone(side + 'ToeBase').getWorldPosition(new Vector3()),
      votes: [],
      debug: null,
    }))
    ;((window as unknown as { __rigs: Record<string, Leg[]> }).__rigs ??= {})[role ?? 'single'] = legs // ponytail: dev probe
    return { legs, toeOffset }
  }, [scene, role])

  // how fast the ground moves under the planted foot in the in-place Running clip
  const clipSpeed = useMemo(() => {
    const clip = AnimationClip.findByName(animations, 'Running')!
    const action = mixer.clipAction(clip, scene)
    action.play()
    const toe = rig.legs[0].toe
    const samples: { y: number; v: number }[] = []
    let prev: Vector3 | null = null
    const step = 1 / 60
    for (let t = 0; t <= clip.duration; t += step) {
      mixer.setTime(t)
      scene.updateMatrixWorld(true)
      const p = toe.getWorldPosition(new Vector3())
      if (prev) samples.push({ y: p.y, v: Math.hypot(p.x - prev.x, p.z - prev.z) / step })
      prev = p
    }
    action.stop()
    mixer.uncacheAction(clip, scene)
    const ys = samples.map((s) => s.y)
    const lo = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.15
    const stance = samples.filter((s) => s.y < lo).map((s) => s.v).sort((a, b) => a - b)
    const v = stance[Math.floor(stance.length / 2)] ?? RUN_SPEED
    console.log('Running clip ground speed (m/s):', v.toFixed(2), 'toe offset (m):', rig.toeOffset.toFixed(3))
    return v
  }, [animations, mixer, scene, rig])

  useEffect(() => {
    group.current.rotation.y = yaw
    actions.Idle!.play()
    actions.Running!.setEffectiveWeight(0).play()
    const down = (e: KeyboardEvent) => keys.add(e.code)
    const up = (e: KeyboardEvent) => keys.delete(e.code)
    const own = () => void (sync.camOwner = role ?? 'driver')
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    controls?.addEventListener('start', own)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      controls?.removeEventListener('start', own)
    }
  }, [actions, keys, yaw, controls, role])

  const groundY = (p: Vector3) => {
    if (!ground.current) return 0
    _ray.set(_v.set(p.x, p.y + 2, p.z), DOWN)
    const hit = _ray.intersectObjects(ground.current.children, false)[0]
    return hit ? hit.point.y : 0
  }

  useFrame((_, dt) => {
    dt = Math.min(dt, 1 / 20)
    const g = group.current

    if (role === 'follower') {
      // mirror the driver's transform and clip times (mixer already advanced; re-evaluate at the synced times)
      g.position.copy(sync.pos)
      g.rotation.y = sync.yaw
      speed.current = sync.speed
      actions.Idle!.time = sync.idleTime
      actions.Running!.time = sync.runTime
    } else {
      // --- locomotion: camera-relative WASD ---
      camera.getWorldDirection(_fwd).setY(0).normalize()
      _move.set(0, 0, 0)
      if (keys.has('KeyW')) _move.add(_fwd)
      if (keys.has('KeyS')) _move.sub(_fwd)
      if (keys.has('KeyD')) _move.addScaledVector(_v.crossVectors(_fwd, UP), 1)
      if (keys.has('KeyA')) _move.addScaledVector(_v.crossVectors(_fwd, UP), -1)
      const wants = _move.lengthSq() > 0
      if (wants) {
        _move.normalize()
        const yaw = Math.atan2(_move.x, _move.z)
        g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 10)
      }
      speed.current += ((wants ? RUN_SPEED : 0) - speed.current) * Math.min(1, dt * 6)
      g.getWorldDirection(_fwd)
      g.position.addScaledVector(_fwd, speed.current * dt)
      g.position.y += (groundY(g.position) - g.position.y) * Math.min(1, dt * 10)
    }

    const blend = speed.current / RUN_SPEED
    actions.Idle!.setEffectiveWeight(1 - blend)
    actions.Running!.setEffectiveWeight(blend)
    actions.Running!.setEffectiveTimeScale(Math.max(0.5, speed.current / clipSpeed))
    if (role === 'follower') mixer.update(0)
    if (role === 'driver') {
      sync.pos.copy(g.position)
      sync.yaw = g.rotation.y
      sync.speed = speed.current
      sync.idleTime = actions.Idle!.time
      sync.runTime = actions.Running!.time
    }

    if (controls) {
      _v.copy(g.position).setY(g.position.y + 1).sub(controls.target)
      controls.target.add(_v)
      camera.position.add(_v)
      if (role) {
        // whoever was orbited last owns the camera; the other view copies it
        if (sync.camOwner === role) {
          sync.camPos.copy(camera.position)
          sync.camTarget.copy(controls.target)
        } else {
          camera.position.copy(sync.camPos)
          controls.target.copy(sync.camTarget)
          controls.update()
        }
      }
    }

    // --- foot IK (mixer already ran this frame) ---
    g.updateMatrixWorld(true)
    if (!(forceIK ?? ik.enabled)) {
      for (const leg of rig.legs) if (leg.debug) leg.debug.visible = false
      return
    }

    // lower the whole model if a planted foot's ground is below the root's ground (swinging feet don't count)
    let drop = 0
    for (const leg of rig.legs) {
      if (!leg.contact.lock) continue
      drop = Math.max(drop, g.position.y - groundY(leg.contact.point))
    }
    scene.position.y += (-drop - scene.position.y) * Math.min(1, dt * 8)
    g.updateMatrixWorld(true)

    for (const leg of rig.legs) {
      leg.toe.getWorldPosition(_toe)
      leg.heel.getWorldPosition(_heel)
      const gy = groundY(_toe) + rig.toeOffset

      // contact detection: slow and low, with a majority vote to kill flicker
      const vel = _v.subVectors(_toe, leg.prevToe).divideScalar(dt).length()
      leg.prevToe.copy(_toe)
      leg.votes.push(vel < ik.velThreshold && _toe.y - gy < ik.heightThreshold)
      if (leg.votes.length > 5) leg.votes.shift()
      // unanimous to start a lock, majority to keep it (hysteresis against toe-off flicker)
      const yes = leg.votes.filter(Boolean).length
      const inContact = leg.contact.lock ? yes > leg.votes.length / 2 : yes === leg.votes.length

      updateContact(leg.contact, _toe, inContact, gy, ik.unlockRadius, ik.halflife, dt)
      _target.copy(leg.contact.position)
      _target.y = Math.max(_target.y, groundY(_target) + rig.toeOffset)

      // heel target keeps the animated heel-to-toe offset, then IK, then aim the foot at the toe target
      _heel.sub(_toe).add(_target)
      twoBoneIK(leg.hip, leg.knee, leg.heel, _heel, _fwd)
      lookAtTip(leg.heel, leg.toe, _target)

      if (leg.debug) {
        leg.debug.visible = ik.debug
        leg.debug.position.copy(_target)
        ;(leg.debug.material as MeshBasicMaterial).color.set(leg.contact.lock ? '#3f3' : '#f33')
      }
    }
  })

  return (
    <>
      <group ref={group}>
        <primitive object={scene} />
      </group>
      {rig.legs.map((leg, i) => (
        <mesh key={i} ref={(m) => void (leg.debug = m)}>
          <sphereGeometry args={[0.03]} />
          <meshBasicMaterial color="#f33" depthTest={false} transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  )
}

useGLTF.preload(MODEL)
useGLTF.preload(ANIMS)
