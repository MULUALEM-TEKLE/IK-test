# Handoff

Updated: 2026-11-19 12:30, commit b006d51, session 50a7afe2 (Reddit explainer video)

## Goal

Small, readable foot locking + two-bone IK on a Mixamo rig in React Three Fiber, after Daniel Holden's article. Public repo: https://github.com/MULUALEM-TEKLE/IK-test

## In flight

- main, session 50a7afe2: explainer live on r/GraphicsProgramming (https://www.reddit.com/r/GraphicsProgramming/comments/1y02o3o/); r/threejs, r/IndieDev, r/creativecoding, r/gameenginedevs got "clicked Post" but no URL (user to check). Real-stairs reply clip done: `_/social/2026-11-19-ik-real-stairs/upload/stairs-16x9.mp4` (+ `stairs.gif`), reply text in the session. Next: the user posts the reply.

## Blocked / waiting

- none

## Decisions (last 2 weeks)

- 2026-11-19: `zen_ben.glb` (from the private Berlin Runner project) replaced by `public/clips.glb` (skeleton + Idle + Running, no mesh). The old file stays in git history (user chose no rewrite).
- 2026-11-19: one course for both modes (straddle step, stairs up/down, ramp); Leva `trails` and `chain` debug toggles; `window.__drive` dev hook drives the character for scripted captures.
- 2026-11-19: measured toe travel per stance on flat ground: IK off left 0.7 cm, right 18 cm; IK on left 1.6 cm, right under 4 cm.
- 2026-11-19: contact detection runs on the animation (toe over the root's floor, root climb removed), unlock radius is horizontal. Real stairs (17.5/28 cm) beside the course. Walking clip = three.js Xbot.glb walk, retargeted in world space (its bones have identity axes); Shift walks.

## Next

- Stride does not adapt to stairs: the walk lands every 3rd stair, the run every 6th. Stride warping or a stairs clip would fix it.

## Do not touch

- none
