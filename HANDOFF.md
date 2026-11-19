# Handoff

Updated: 2026-11-19 09:30, commit ac0fec1, session 50a7afe2 (Reddit explainer video)

## Goal

Small, readable foot locking + two-bone IK on a Mixamo rig in React Three Fiber, after Daniel Holden's article. Public repo: https://github.com/MULUALEM-TEKLE/IK-test

## In flight

- main, session 50a7afe2: explainer video done (`_/social/2026-11-19-ik-explainer/upload/explainer-16x9.mp4`, 68 s). Five Reddit payloads in `upload/reddit-*.json`. Next: post on the user's "go" (section 5 Reddit of the social-post skill), then log URLs in accounts.json.

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
