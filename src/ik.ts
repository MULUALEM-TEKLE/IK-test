// Two-bone IK + foot contact locking, after Daniel Holden's
// https://theorangeduck.com/page/inverse-kinematics-foot-locking
import { Object3D, Quaternion, Vector3 } from 'three'

const EPS = 1e-8
const AXES = ['x', 'y', 'z'] as const

/** Exact spring-damper decay of an offset (x, v) toward zero. */
export function decaySpringDamper(x: Vector3, v: Vector3, halflife: number, dt: number) {
  const y = (4 * Math.LN2) / (halflife + EPS) / 2
  const eydt = Math.exp(-y * dt)
  for (const k of AXES) {
    const j1 = v[k] + x[k] * y
    x[k] = eydt * (x[k] + j1 * dt)
    v[k] = eydt * (v[k] - j1 * y * dt)
  }
}

export interface FootContact {
  state: boolean
  lock: boolean
  position: Vector3 // inertialized output
  velocity: Vector3
  point: Vector3 // locked contact point
  target: Vector3 // previous input position (for velocity)
  offsetPos: Vector3
  offsetVel: Vector3
}

export function createContact(p: Vector3): FootContact {
  return {
    state: false,
    lock: false,
    position: p.clone(),
    velocity: new Vector3(),
    point: p.clone(),
    target: p.clone(),
    offsetPos: new Vector3(),
    offsetVel: new Vector3(),
  }
}

const _inVel = new Vector3()
const _tmp = new Vector3()

/**
 * Update a foot's contact state. `inputPos` is the animated toe position,
 * `inputState` whether the animation says the toe is in contact.
 * Output `c.position` tracks the locked `c.point` while in contact and the
 * animated `inputPos` otherwise; each switch is inertialized so it never pops.
 */
export function updateContact(
  c: FootContact,
  inputPos: Vector3,
  inputState: boolean,
  groundY: number,
  unlockRadius: number,
  halflife: number,
  dt: number,
) {
  _inVel.subVectors(inputPos, c.target).divideScalar(dt + EPS)
  c.target.copy(inputPos)

  const unlock = c.lock && _tmp.subVectors(c.point, inputPos).length() > unlockRadius
  if (!c.state && inputState && !c.lock) {
    c.lock = true
    c.point.copy(c.position).setY(groundY)
  } else if ((c.lock && c.state && !inputState) || unlock) {
    c.lock = false
  } else {
    c.state = inputState
    // no switch: keep decaying toward the current source
    decaySpringDamper(c.offsetPos, c.offsetVel, halflife, dt)
    c.position.copy(c.lock ? c.point : inputPos).add(c.offsetPos)
    c.velocity.copy(c.lock ? _tmp.set(0, 0, 0) : _inVel).add(c.offsetVel)
    return
  }
  c.state = inputState

  // source switched: offset = previous output - new source, then decay
  const src = c.lock ? c.point : inputPos
  const srcVel = c.lock ? _tmp.set(0, 0, 0) : _inVel
  c.offsetPos.subVectors(c.position, src)
  c.offsetVel.subVectors(c.velocity, srcVel)
  decaySpringDamper(c.offsetPos, c.offsetVel, halflife, dt)
  c.position.copy(src).add(c.offsetPos)
  c.velocity.copy(srcVel).add(c.offsetVel)
}

const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()
const _t = new Vector3()
const _axisDwn = new Vector3()
const _axisRot = new Vector3()
const _u = new Vector3()
const _v = new Vector3()
const _r0 = new Quaternion()
const _r1 = new Quaternion()
const _r2 = new Quaternion()
const _rootGR = new Quaternion()
const _midGR = new Quaternion()
const _parGR = new Quaternion()

function angleBetween(u: Vector3, v: Vector3) {
  return Math.acos(Math.min(1, Math.max(-1, u.dot(v))))
}

/**
 * Rotate `root` and `mid` so that `end` reaches `target`, rotating in the
 * plane spanned by the chain and `pole` (a "forward" direction for the knee).
 * Bones' matrixWorld must be current; on return root's subtree is updated.
 */
export function twoBoneIK(
  root: Object3D,
  mid: Object3D,
  end: Object3D,
  target: Vector3,
  pole: Vector3,
  maxLengthBuffer = 0.01,
) {
  root.getWorldPosition(_a)
  mid.getWorldPosition(_b)
  end.getWorldPosition(_c)
  root.getWorldQuaternion(_rootGR)
  mid.getWorldQuaternion(_midGR)
  root.parent!.getWorldQuaternion(_parGR)

  const lab = _b.distanceTo(_a)
  const lcb = _b.distanceTo(_c)
  const maxExt = lab + lcb - maxLengthBuffer

  _t.copy(target)
  if (_t.distanceTo(_a) > maxExt) _t.sub(_a).setLength(maxExt).add(_a)
  const lat = Math.min(Math.max(_t.distanceTo(_a), EPS), lab + lcb - EPS)

  // rotate in the plane the knee already bends in; if the leg is straight use the pole
  _axisDwn.subVectors(_c, _a).normalize()
  _axisRot.crossVectors(_axisDwn, _u.subVectors(_b, _a).normalize())
  if (_axisRot.lengthSq() < 1e-4) _axisRot.crossVectors(_axisDwn, pole)
  _axisRot.normalize()

  const acab0 = angleBetween(_u.subVectors(_c, _a).normalize(), _v.subVectors(_b, _a).normalize())
  const babc0 = angleBetween(_u.subVectors(_a, _b).normalize(), _v.subVectors(_c, _b).normalize())
  const acab1 = Math.acos(Math.min(1, Math.max(-1, (lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat))))
  const babc1 = Math.acos(Math.min(1, Math.max(-1, (lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb))))

  _r0.setFromAxisAngle(_axisRot, acab1 - acab0)
  _r1.setFromAxisAngle(_axisRot, babc1 - babc0)

  _u.subVectors(_c, _a).normalize()
  _v.subVectors(_t, _a).normalize()
  _r2.setFromUnitVectors(_u, _v)

  // root local = inv(parent) * r2 * r0 * rootGR ; mid local = inv(rootGR) * r1 * midGR
  root.quaternion.copy(_parGR).invert().multiply(_r2).multiply(_r0).multiply(_rootGR)
  mid.quaternion.copy(_rootGR).invert().multiply(_r1).multiply(_midGR)
  root.updateMatrixWorld(true)
}

const _heel = new Vector3()
const _toe = new Vector3()
const _boneGR = new Quaternion()

/** Rotate `bone` (world-space) so that `tip` points at `target`. */
export function lookAtTip(bone: Object3D, tip: Object3D, target: Vector3) {
  bone.getWorldPosition(_heel)
  tip.getWorldPosition(_toe)
  _u.subVectors(_toe, _heel).normalize()
  _v.subVectors(target, _heel).normalize()
  _r2.setFromUnitVectors(_u, _v)
  bone.getWorldQuaternion(_boneGR)
  bone.parent!.getWorldQuaternion(_parGR)
  bone.quaternion.copy(_parGR).invert().multiply(_r2).multiply(_boneGR)
  bone.updateMatrixWorld(true)
}
