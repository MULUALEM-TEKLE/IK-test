# Handoff

Updated: 2026-11-19 10:20, commit ac0fec1, session 50a7afe2 (Reddit explainer video)

## Goal

Small, readable foot locking + two-bone IK on a Mixamo rig in React Three Fiber, after Daniel Holden's article. Public repo: https://github.com/MULUALEM-TEKLE/IK-test

## In flight

- main, session 50a7afe2: explainer posted to r/GraphicsProgramming (https://www.reddit.com/r/GraphicsProgramming/comments/1y02o3o/). r/threejs, r/IndieDev, r/creativecoding, r/gameenginedevs reached "clicked Post" but no URL came back. Next: the user checks those tabs; if not live, retry one at a time ~10 min apart with `upload/explainer-16x9-light.mp4` (15 MB).

## Blocked / waiting

- none

## Decisions (last 2 weeks)

- 2026-11-19: `zen_ben.glb` (from the private Berlin Runner project) replaced by `public/clips.glb` (skeleton + Idle + Running, no mesh). The old file stays in git history (user chose no rewrite).
- 2026-11-19: one course for both modes (straddle step, stairs up/down, ramp); Leva `trails` and `chain` debug toggles; `window.__drive` dev hook drives the character for scripted captures.
- 2026-11-19: measured toe travel per stance on flat ground: IK off left 0.7 cm, right 18 cm; IK on left 1.6 cm, right under 4 cm.

## Next

- Possible fix: the unlock test uses 3D distance, so a toe locked on a 22 cm step can flicker unlocked when the animated toe is below the step (pin shows red while standing).

## Do not touch

- none
