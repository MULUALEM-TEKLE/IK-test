// Run: node src/ik.test.ts
import assert from 'node:assert/strict'
import { Object3D, Vector3 } from 'three'
import { createContact, twoBoneIK, updateContact } from './ik.ts'

// chain: root at origin, mid 1 unit down, end 1 more unit down, slight bend
const parent = new Object3D()
const root = new Object3D()
const mid = new Object3D()
const end = new Object3D()
parent.add(root)
root.add(mid)
mid.add(end)
mid.position.set(0, -1, 0)
end.position.set(0, -1, 0)
root.rotation.x = 0.1
mid.rotation.x = -0.2
parent.updateMatrixWorld(true)

const fwd = new Vector3(0, 0, 1)
const target = new Vector3(0.2, -1.5, 0.3)
twoBoneIK(root, mid, end, target, fwd)
const got = end.getWorldPosition(new Vector3())
assert.ok(got.distanceTo(target) < 1e-3, `end ${got.toArray()} != target ${target.toArray()}`)
assert.ok(Math.abs(mid.getWorldPosition(new Vector3()).distanceTo(root.getWorldPosition(new Vector3())) - 1) < 1e-6, 'bone length changed')

// straight leg: bend direction comes from the pole
root.rotation.set(0, 0, 0); mid.rotation.set(0, 0, 0); parent.updateMatrixWorld(true)
twoBoneIK(root, mid, end, new Vector3(0, -1.6, 0), fwd)
assert.ok(end.getWorldPosition(new Vector3()).distanceTo(new Vector3(0, -1.6, 0)) < 1e-3, 'straight leg')
assert.ok(mid.getWorldPosition(new Vector3()).z > 0, 'knee should bend toward pole')

// unreachable target is clamped, no NaN
twoBoneIK(root, mid, end, new Vector3(0, -5, 0), fwd)
assert.ok(!Number.isNaN(end.getWorldPosition(new Vector3()).y))

// contact: lock holds the point, unlock is continuous
const c = createContact(new Vector3(0, 0.05, 0))
const dt = 1 / 60
updateContact(c, new Vector3(0, 0.05, 0), true, 0, 0.3, 0.05, dt)
assert.ok(c.lock && c.point.y === 0, 'should lock on ground')
for (let i = 0; i < 60; i++) updateContact(c, new Vector3(0.05, 0.05, 0), true, 0, 0.3, 0.05, dt)
assert.ok(c.position.length() < 1e-3, 'locked foot must settle on the point, not slide')
const lift = new Vector3(0.052, 0.06, 0)
updateContact(c, lift, false, 0, 0.3, 0.05, dt)
assert.ok(!c.lock && c.position.length() < 0.01, `unlock should be continuous, got ${c.position.toArray()}`)
for (let i = 0; i < 120; i++) updateContact(c, lift, false, 0, 0.3, 0.05, dt)
assert.ok(c.position.distanceTo(lift) < 1e-3, 'offset should decay to input')

console.log('ik.test ok')
