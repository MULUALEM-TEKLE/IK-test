# IK foot locking for Mixamo rigs (three.js / R3F)

A small, readable implementation of Daniel Holden's
[Inverse Kinematics and Foot Locking](https://theorangeduck.com/page/inverse-kinematics-foot-locking)
on a standard Mixamo skeleton, running in React Three Fiber.

Feet stop sliding, land on uneven ground, and straddle steps, while the original run and idle
clips stay untouched. IK only nudges the pose; it never replaces it.

```sh
pnpm install
pnpm dev             # http://localhost:5173        WASD to run, drag to orbit, Leva panel to tune
                     # http://localhost:5173/?compare   IK off vs IK on, same input, mirrored cameras
node src/ik.test.ts  # self-check for the solver and the contact state machine
```

## How it works

Every frame, after the animation mixer has posed the skeleton:

1. **Contact detection.** Read the animated toe joint. It is in contact when it is slow
   (world velocity under `velThreshold`) and low (under `heightThreshold` above the ground
   below it). A five-frame vote removes flicker: unanimous to start a lock, majority to keep it.
2. **Locking.** On contact start the toe's current position is frozen on the ground. It unlocks
   when contact ends or the animated toe drifts more than `unlockRadius` away. Each switch is
   inertialized (spring-damper offset with `halflife`), so the output position never pops.
3. **Two-bone IK.** Hip and knee are rotated so the heel reaches its target, keeping the knee in
   the plane it already bends in, with a soft clamp on full extension. The foot bone is then
   aimed so the toe hits the locked point, and the toe is clamped above the ground.
4. **Body height.** If a planted foot's ground is lower than the root's ground the whole model is
   lowered by that amount, so a leg can reach down a step without hyperextending.

Running clips are played in place. Playback speed is scaled so the clip's ground speed matches
the character's actual speed (measured once at load from the toe's stance velocity). Locking then
only has to remove the residual slide, which is what the article recommends.

## Files

| File | What it is |
|------|-----------|
| `src/ik.ts` | Pure math, no React: `twoBoneIK`, `lookAtTip`, `updateContact`, `decaySpringDamper`. Copy this file into any three.js project. |
| `src/Character.tsx` | Loads the rig, blends Idle/Running, WASD locomotion, ground raycasts, runs the IK pass in `useFrame`. |
| `src/App.tsx` | Scene and the course (straddle step, stairs up and down, ramp), and the `?compare` layout. |
| `src/ik.test.ts` | Runnable assertions for the solver and lock transitions. |
| `public/ybot.glb` | Mixamo Y Bot mesh and skeleton (converted from FBX with Blender, no animations). |
| `public/clips.glb` | Idle and Running clips on a mixamorig skeleton (no mesh). |

## Taking it into your game

**Use your own character.** Any mixamorig skeleton works: change `MODEL` in `Character.tsx`.
Joint names are matched by name (`mixamorigLeftUpLeg`, `mixamorigLeftLeg`, `mixamorigLeftFoot`,
`mixamorigLeftToeBase` and the right side). For a non-Mixamo rig, rename the lookups in the `rig`
memo to your hip, knee, ankle and toe joints. The chain must be hip → knee → ankle → toe.

**Use your own clips.** Point `ANIMS` at a GLB that shares the skeleton, or put the clips in the
model itself and drop the second loader. When clips come from a different model, keep only
rotation tracks plus the hips translation and scale that translation by the ratio of hip heights.
`Character.tsx` already does this. Clips with real root motion also work: the contact
detector reads world-space toe velocity, so it does not care whether the root moves via clip or
via your controller.

**Plug in your locomotion.** Replace the WASD block with your controller. The IK pass only needs
the group's world transform to be current and `speed.current` to drive the Idle/Running blend.
If you have more than two clips, keep the blend weights summing to one so the mixer fully
overwrites bone rotations every frame; the IK reads the pre-IK pose from the bones, so stale
rotations would poison contact detection.

**Plug in your ground.** `groundY(point)` is a downward raycast against `ground.current.children`.
Swap it for your physics engine's query or a heightfield lookup. It is called a handful of times
per foot per frame, so keep it cheap.

**See it.** In the Leva panel, `debug` shows each toe target (green when locked), `trails` draws a dot wherever a toe touches the ground (a sliding foot leaves a smear), and `chain` draws the hip, knee, ankle and toe chain.

**Tune it.** The Leva panel exposes the four numbers that matter. Reasonable starting points for a
human at 1 unit = 1 m:

| Knob | Default | Raise it when |
|------|---------|---------------|
| `velThreshold` | 1.0 m/s | contacts are missed on fast clips (in-place clips slide 0.3 to 0.5 m/s during stance) |
| `heightThreshold` | 0.08 m | the toe joint sits high above the sole on your mesh |
| `unlockRadius` | 0.25 m | feet stay glued during turns or quick direction changes |
| `halflife` | 0.04 s | lock/unlock transitions look snappy; lower it if they feel mushy |

**What is deliberately not here.** Heel locking (the article argues toes matter more), the
offline position-based-dynamics pass for baked clips, pole targets (the current bend plane is
used instead), and a fully procedural gait. Each is a bounded addition on top of `ik.ts` if you
need it.

## Article to code map

| Article | Here |
|---------|------|
| Two-bone IK with soft extension | `twoBoneIK` in `ik.ts` |
| Contact detection from velocity and height | vote loop in `Character.tsx` `useFrame` |
| Lock / unlock with hysteresis | `updateContact` in `ik.ts` |
| Inertialization (no pops) | `decaySpringDamper` in `ik.ts` |
| Toe orientation | `lookAtTip` in `ik.ts` |
| Avoid over-correction | body drop only counts planted feet |
