# Conductor / `/conduct` Page — Handoff

**Status as of 2026-05-11:** The pipeline technically works — phone gestures arrive, math is correct, figure responds. But the *design is wrong*: it's a phone-mirroring puppeteer, not a conductor. **The user is frustrated and rightfully so.** Read this entire doc before touching the code, especially the "What's actually wrong" section.

---

## What this page is supposed to be

Users pair their phone (QR code → mobile web page) and conduct an orchestra. The `/conduct` page is the **desktop / projector view**: a 3D conductor figure that visibly conducts in response to the phone-as-baton. The phone-side IMU streams orientation + acceleration over WebSocket; the desktop renders the figure responding.

Core spec is in `CLAUDE.md`. Design philosophy is in `Research/gesture-felt-agency-phone-as-baton.md` — **read this before designing anything**, the user's research base names every design pitfall this implementation fell into.

---

## What's currently built (the pipeline)

### Architecture

```
Phone (mobile web)                    Sidecar relay (Node)              Desktop /conduct (Vite)
─────────────────                     ──────────────────                ────────────────────────
DeviceOrientationEvent  ──60Hz──→     ws://…:8443                ─→     usePhoneOrientation hook
  alpha/beta/gamma                    role=phone → role=desktop          1€ filter on quaternion
  quatFromEulerZXY                    fan-out                            slerp-smoothed targetQuat
  qRel = conj(zeroQuat) * q                                              applyGesturePose() in useFrame
  send {type:'orientation', q, raw}                                      → mutates bones each frame
```

### Files & responsibilities

| Path | What |
|---|---|
| `conduct-relay/server.cjs` | HTTPS+WebSocket relay. Auto-generates self-signed cert in `conduct-relay/certs/`. Routes: `/phone` serves phone HTML, `/?role=desktop` for desktop WS, `/?role=phone` for phone WS. **Run with `npm run relay`** — port 8443. |
| `conduct-relay/public/phone.{html,js}` | Mobile page: Start + Calibrate buttons, DeviceOrientationEvent → quaternion (ZXY Euler order) → WebSocket. Calibration: `qRel = conj(zeroQuat) * absQuat`. Sends `{type:'orientation', q:[x,y,z,w], raw:{alpha,beta,gamma}, calibrated, t}` at 60Hz. |
| `src/main.jsx` | Routes `/conduct` to `ConductorView`; everything else falls through to the existing phase flow. |
| `src/conductor/ConductorView.jsx` | R3F Canvas; `PhoneProvider` runs the WS hook once and supplies via Context. Loads glTF, bakes the 1-frame conducting pose via one-shot AnimationMixer, captures base bone rotations, calls `applyGesturePose` each frame. |
| `src/conductor/usePhoneOrientation.js` | WS client hook. Connects to `wss://<host>:8443/?role=desktop`, reconnects on close, runs each incoming quaternion through `OneEuroQuaternion`, exposes `targetQuat`/`currentQuat` refs and `connected`/`calibrated` state. |
| `src/conductor/oneEuroFilter.js` | `OneEuroFilter` (scalar) + `OneEuroQuaternion` (4-component, hemisphere continuity, renormalize). Casiez et al. CHI 2012. minCutoff=1.0Hz, beta=0.007. |
| `src/conductor/gesturePose.js` | **The orchestrator.** `findDrivenBones`, `captureBaseRotations`, `applyGesturePose`. Decomposes phone quaternion via ZXY Euler (matching phone.js construction order) → dAlpha/dBeta/dGamma signals → bone deltas. |
| `src/conductor/conductorAnatomy.js` | `ANATOMICAL` constants (gain factors, max angles, arm damping). |
| `src/conductor/swingTwist.js` | `swingTwistDecompose(q, axis)`. **No longer used in the runtime path** — kept for tests. Dead code candidate. |
| `src/conductor/boneLocal.js` | `worldQuatToBoneLocal(bone, worldQuat)`. **Also no longer used in runtime** — kept for tests. Dead code candidate. |
| `src/conductor/engravingShader.js` | NPR ink material with Fresnel rim. Onbeforecompile hook on `MeshToonMaterial`. |
| `public/conductor/conductor.glb` | 1.62 MB rigged glTF. CC3 character + Rigify rig (725 skin bones). Conducting pose is baked into a 1-frame animation clip. Verified bones: `DEF-spine.006` (head), `DEF-spine.004` (chest), `DEF-spine.001` (lower spine), `DEF-upper_arm.R` (right upper arm). After three.js's `PropertyBinding.sanitizeNodeName` strips dots, runtime names are `DEF-spine006`, `DEF-spine004`, `DEF-spine001`, `DEF-upper_armR`. |

### Tests

Located in `src/conductor/__tests__/`:

| File | Purpose | Status |
|---|---|---|
| `oneEuroFilter.test.js` | Unit tests for the 1€ filter | 6/6 pass |
| `swingTwist.test.js` | Unit tests for swing-twist decomposition | 5/5 pass (utility no longer used in runtime) |
| `boneLocal.test.js` | Unit tests for world-to-bone-local conversion | 3/3 pass (utility no longer used in runtime) |
| `conductor-glb.test.js` | Asserts GLB has the expected skin-joint bones, including post-sanitization names | 5/5 pass |
| `conductorMotion.test.js` | Integration test: load GLB, apply canonical world-axis quaternions, assert bone deltas within anatomical limits | 4/4 pass. Note world-axis-to-bone mapping under ZXY Euler: world-X→head pitch, world-Y→chest roll, world-Z→head yaw |
| `conductorMotionRealistic.test.js` | **Diagnostic** that synthesizes realistic phone quaternions across calibration scenarios (portrait-N/E/S/W, flat, landscape) × gesture vocabulary (tilt-forward/back, tilt-right/left, yaw-right/left), prints per-bone deltas. **Use this to verify the math behaves correctly under real phone inputs.** |

Run all conductor tests: `npx vitest run src/conductor/__tests__/`. Currently 24/24 pass.

### Visual test (Playwright)

`scripts/visual-conductor-test.mjs` opens `localhost:5174/conduct` in headless chromium, intercepts the WebSocket via `page.routeWebSocket(/^wss:\/\//, …)`, injects synthetic phone quaternions across a gesture matrix (rest, tilt-forward, tilt-back, tilt-right, tilt-left, yaw-right, yaw-left), saves screenshots to `tmp/conductor-screens/`. Run: `node scripts/visual-conductor-test.mjs` (Vite must be running on `:5174`).

### How to actually run end-to-end

```bash
# Terminal 1
npm run dev      # Vite on :5174 — hosts /conduct

# Terminal 2
npm run relay    # WS+HTTPS on :8443 — hosts /phone, relays gestures
```

Desktop: `http://localhost:5174/conduct`. **One-time:** also visit `https://localhost:8443/desktop` and click through the cert warning, otherwise `wss://localhost:8443` will silently fail.

Phone (must be on the same WiFi as the Mac): `https://<lan-ip>:8443/phone` (e.g. `https://192.168.1.6:8443/phone`). Accept the cert warning, tap **Start**, grant motion permission (iOS), tap **Calibrate**.

Status overlay (top-right of `/conduct`):
- 🔴 `relay offline · npm run relay` — relay isn't running
- 🟡 `phone connected · waiting for calibration` — phone hasn't tapped Calibrate yet
- 🟢 `conducting · live` — pipeline alive

---

## What's actually wrong (read this carefully)

The math is now correct. The architecture is wrong. Specifically:

### 1. The pipeline is "phone-as-puppet," not "phone-as-baton"

`applyGesturePose` decomposes the phone's calibrated quaternion into three signals (dAlpha=yaw, dBeta=pitch, dGamma=roll) and routes them to head/chest/upper-arm with linear gains and clamps. That's *direct orientation mirroring*. The user's research doc explicitly names this failure mode:

> Hunt, Wanderley, Paradis (J. New Music Research, 2003): subjects using one-to-one mappings figured out the instrument within seconds and lost interest within two minutes... *Many-to-many mappings* produce more sustained engagement.

What we have is the worst case — three independent 1:1 mappings to three bones. The user can't help but read this as "wave the phone, see the figure twitch."

### 2. The right arm flops mirror-style instead of swinging like a baton

Current arm code: `bone.upperArmR.quaternion = base * slerp(identity, phoneQuat, 0.85)`. A 30° phone tilt produces a ~25° rotation of the **upper arm bone in its local frame**. From the conducting rest pose, this swings the upper arm itself by 25° — the screenshots in `tmp/conductor-screens/03-tilt-back.png` show the arm flying up to the head. **That's not how a baton arm moves.** The shoulder is a fixed pivot; the *forearm and wrist* do the work; the upper arm barely moves except for large gestures. We have no IK and no forearm/wrist drivers, so big rotations get applied where they look most unnatural.

### 3. The figure is dead between gestures

No idle motion. No breathing. No subtle baton arc. Real conductors are physically present at rest — micro-movements, weight shifts, baton hold. Mine is a frozen mannequin between phone events.

### 4. Downbeats are not detected or used

The phone has accelerometer data via `DeviceMotionEvent` and the project already has a downbeat detector at `src/orchestra/ConductingEngine.js:95-117` (negative-Y zero-crossing, 4 m/s² threshold, 250ms refractory). **None of this flows into `/conduct`.** The phone-side `phone.js` only sends DeviceOrientationEvent, not DeviceMotionEvent. So beats — the *most musical* signal a conductor produces — are completely unrepresented.

### 5. Camera angle hides the motion that does happen

The Canvas is configured with `camera.position = [0, 1.55, 2.6]` — pure back view. From behind, head pitch is hard to see (small bone, top of head not very visible) and chest roll is hard to see (silhouette is symmetric). The arm response is the only thing that reads. A ¾ view (rotate camera ~30° around Y) would show much more.

### 6. Gain bumping was a Band-Aid

I bumped gains 0.4 → 0.8 in the last commit (`8125009`) so motion is "visibly responsive." That makes the figure twitch more, but doesn't fix the fundamental design — it just makes the puppet behavior more obvious. Consider reverting once the real architecture lands.

---

## Recommended path forward

This is a *redesign*, not a tweak. Plan it carefully.

### Phase A — Add downbeat protocol

1. Update `conduct-relay/public/phone.js` to also subscribe to `DeviceMotionEvent` and run the downbeat detector from `src/orchestra/ConductingEngine.js:73-117` (negative-Y zero-crossing, peak magnitude, refractory). Send `{type:'gesture', q, downbeat:{fired, intensity}, gestureGain, articulation, calibrated, t}` at 60Hz. Keep `qRel` in there.
2. Update `src/conductor/usePhoneOrientation.js` to expose `downbeat` (last fired event with timestamp), `gestureGain` (RMS-derived 0..1), `articulation` (jerk-derived 0..1) alongside the existing quaternion refs.

### Phase B — Idle conducting animation

1. In Blender, animate a subtle 4-second loop: baton arm performs a gentle 4-beat pattern (down-left-right-up), shoulders rise/fall with breath, head subtly tracks the baton tip. Bake to glTF as a separate animation clip.
2. In `ConductorView.jsx`, drive this with `useAnimations` continuously (mixer running every frame, action looped). Replace the current "bake-then-stop" mixer pattern.
3. The idle is the *baseline*. Phone orientation now layers as deltas on top, not as the primary motion source.

### Phase C — Beat-driven impulses

When `phone.downbeat.fired` becomes true on a frame:
1. Snap the right arm forward in an *ictus* (~50ms) — small forward rotation of the forearm bone, then automatic rebound (~200ms back toward base).
2. Pulse the figure scale (subtle, 1% bump) for the visual "tick."
3. Optionally: scale the impulse magnitude by `phone.downbeat.intensity` so harder downbeats look more emphatic.
4. The goal: each beat is a discrete *event* the user can see and feel as their gesture, distinct from the continuous orientation modulation.

### Phase D — Reduce orientation gains, add IK

1. Drop `HEAD_PITCH_GAIN`, `HEAD_YAW_GAIN`, `CHEST_ROLL_GAIN` back to ~0.2-0.3. Orientation should produce *subtle* response, not be the primary visible thing.
2. Add IK for the right arm: install `three-ik` or write a simple 2-bone IK solver. Drive the IK target (a virtual point in front of the figure) with phone orientation, scaled. The arm now bends naturally at the elbow instead of the upper arm spinning.
3. Optionally: separate forearm/hand bones to follow the phone more directly while the upper arm holds steady.

### Phase E — Camera + composition

1. Camera at ¾ view: `camera.position = [1.5, 1.55, 2.2]` (rotate ~30° around Y), `target = [0, 1.45, 0]`. Now we see torso lean, head turn, *and* arm swing.
2. Consider dropping `OrbitControls` for the production view (lock the camera to a hero angle).
3. Consider a subtle dolly-in on calibration so the figure feels welcoming.

### What to remove

- `src/conductor/swingTwist.js` and its test — no longer used in runtime
- `src/conductor/boneLocal.js` and its test — no longer used in runtime
- `src/conductor/__tests__/conductorMotionRealistic.test.js` if you're not extending it (it served its diagnostic purpose to find the bug; the integration test in `conductorMotion.test.js` has lower-level assertions on the same math)
- `scripts/visual-conductor-test.mjs` — keep if you want screenshot-based verification; otherwise it's a one-time tool

### What NOT to do (these failed already)

- **Don't iterate on different Euler decomposition orders or swing-twist axis choices.** That whole approach was the wrong abstraction. We tried 'ZXY' and 'XYZ' decompositions, swing-twist around scene-Y. The *math* is fine now. The architecture is the issue.
- **Don't bump gains higher.** They're already too high (0.8). Conductor figures should be subtle, beat-driven impulses provide the visible gesture.
- **Don't try to make `applyGesturePose` smarter.** That function should become much simpler once beats and idle take over.
- **Don't try to one-shot rewrite without phase boundaries.** Phases A and B are independent (you can ship A without B); C depends on A; D and E are independent and can be done last.

---

## Important details that bit me, save you time

### glTF bone name sanitization

Three.js's `GLTFLoader` runs `PropertyBinding.sanitizeNodeName` on every node name during load, **stripping dots, brackets, colons, slashes**. The GLB JSON contains `DEF-spine.006`; at runtime, `bone.name === 'DEF-spine006'`. If you look up bones by name, sanitize the lookup name first, OR use `SkinnedMesh.skeleton.bones[]` directly which is the GPU-authoritative list. See `src/conductor/__tests__/conductor-glb.test.js` for the contract.

### Mixer overrides bone manipulation by default

`THREE.AnimationMixer` re-applies its action's keyframed values to bones every `update(dt)` call. If you keep `useAnimations` running and try to mutate bone quaternions in `useFrame`, the mixer's update will overwrite your changes (whichever runs second wins, and useAnimations' priority is unspecified relative to your useFrame). Two workable approaches:

1. **One-shot bake then stop the mixer**: what `bakeClipToScene` in `ConductorView.jsx` does. `mixer.update(0)` then `mixer.update(clip.duration)` to advance to the final pose, then never tick the mixer again. Bones stay where the last update put them.
2. **Mixer running every frame, layered**: needed for idle. Run `useAnimations` for the idle clip, then in your useFrame *after* the mixer, multiply additional deltas onto bones. R3F runs useFrame callbacks in registration order at the same priority — make sure your component's useFrame runs after `useAnimations`'s. Easiest: register your useFrame with priority `1` (positive priority puts it after the default `0`, but it also takes over rendering, so use `gl.render()` manually in that callback).

### Self-signed cert pain

WebSocket to `wss://localhost:8443` will fail silently (browser refuses cert) until the user navigates to `https://localhost:8443/desktop` once and clicks through the cert warning. Same for the LAN IP on the phone. The relay's `desktop.html` placeholder page exists *only* to provide a URL for accepting that cert. Don't delete it.

### Phone WebSocket reconnect spam

`usePhoneOrientation.js` reconnects every 1 second when the WS closes. If the relay is offline, the console fills with `WebSocket connection failed`. Harmless but noisy. Consider exponential backoff.

### Camera at the wrong angle hides everything

I cannot stress this enough — the current camera is `[0, 1.55, 2.6]`, dead-center back view. Chest lean and head pitch are *invisible* from this angle. When you debug visually, switch the camera to ¾ view first; otherwise you'll think nothing is moving and start chasing math bugs that don't exist.

### Anatomical clamps live in one place

`src/conductor/conductorAnatomy.js` is the single source of truth for gain factors and max angles. Don't duplicate these constants.

---

## Recent commit history (in case you want to git-diff backwards)

```
8125009 fix(conductor): bump gain factors so motion is visibly responsive  ← may want to revert
a879d90 fix(conductor): use ZXY Euler decomposition matching phone construction
bd384b5 refactor(conductor): rewrite gesture-driven motion pipeline
174239b test(conductor): add failing integration test for gesture-driven pose
8a7baa6 feat(conductor): centralize anatomical motion limits
f080567 feat(conductor): add world-quat-to-bone-local helper                ← code unused at runtime now
8815ef3 feat(conductor): add swing-twist quaternion decomposition           ← code unused at runtime now
12d8801 feat(conductor): apply 1€ filter to phone quaternion stream
ba7e08d feat(conductor): add 1€ filter for IMU smoothing
79c0e2d  ← pre-conductor baseline (refactor: drop voice, song joins at mirror beat)
```

Earlier session work (also on `main`, before this plan): the relay sidecar in `conduct-relay/`, the conductor glTF in `public/conductor/conductor.glb`, the engraving shader at `src/conductor/engravingShader.js`, the route at `src/main.jsx`. **None of that pre-plan work was committed in scoped commits — it's all sitting in the working tree as a single mass.** The plan execution committed scoped subsets only. If you want clean history, you'll need to rebase or amend.

---

## Reference docs in this repo

- `Research/gesture-felt-agency-phone-as-baton.md` — **MUST READ.** The user's own research base on what makes phone-as-baton work. Names every failure mode this implementation hit. Section 5 has a complete mapping spec the implementation should follow.
- `docs/superpowers/plans/2026-05-11-conductor-gesture-motion.md` — the 6-task plan that delivered the current implementation. Tasks 1-5 are individually fine; Task 6 is where the architecture mistake landed (the architecture wasn't questioned, just implemented).
- `CLAUDE.md` — top-level project doc. Mentions `/conduct` as planned scope but doesn't describe it in detail.
- `conduct-relay/conducting-app-research.md` — wait this isn't here; the original research is in the sister project `/Users/krishnaniharsunkara/Projects/yoooou/conducting-app-research.md` if you need it.
- `src/orchestra/ConductingEngine.js` — existing downbeat detector implementation, ready to adapt for the phone-side relay.

---

## Final note from the previous session

The user asked "Is this the best you can do?" and the honest answer is no. What's shipped works as a proof-of-life of the data pipeline (phone→relay→3D figure responds), but the *conducting* part is missing. Don't try to incrementally improve `applyGesturePose`. Rewrite it as a thin layer that runs *on top of* an idle animation and beat-driven impulses, with orientation contributing only secondary subtle motion.

Read `Research/gesture-felt-agency-phone-as-baton.md`. Plan Phase A and B before writing code. Then iterate visually with `scripts/visual-conductor-test.mjs` after each change so you catch regressions before the user does.
