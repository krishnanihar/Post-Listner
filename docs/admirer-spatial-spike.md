# Spike: Routing Admirer Audio Through Web Audio HRTF Room

**Date:** 2026-05-20
**Branch:** musicking
**Status:** RESOLVED — Option 2 for WebRTC (primary path), Option 3 as WebSocket fallback

---

## Goal

Determine how the `@elevenlabs/react` / `@elevenlabs/client` SDK exposes its audio output so that the Admirer's voice can be routed through the same Web Audio HRTF spatial graph used by the Orchestra stems.

---

## 1. What the SDK Exposes

### 1.1 Output `AudioContext` — not directly accessible

`MediaDeviceOutput` (the WebSocket-path output controller, `utils/output.js:4`) owns a private `context: AudioContext` field. It is never exposed on the public `OutputController` interface (`OutputController.d.ts`) and is not returned by `useConversation()` or `useRawConversation()`. The context cannot be obtained without monkey-patching private state.

`WebRTCConnection` (the WebRTC-path, `utils/WebRTCConnection.js:459`) creates a *second* `AudioContext` called `audioCaptureContext` solely for the `onAudio` PCM capture pipeline. This context is also private.

**Verdict: no caller-supplied or externally-accessible AudioContext.**

### 1.2 Caller-injected `AudioContext` at `startSession` time — not supported

`BaseConversation.d.ts:24` defines `Options = SessionConfig & Callbacks & ... & AudioWorkletConfig`. `AudioWorkletConfig` allows custom worklet paths and a `libsampleratePath` but has no `audioContext` field. `startSession` accepts no sink or context override. There is no injection point.

**Verdict: cannot supply our own AudioContext to the SDK.**

### 1.3 Output `AudioNode` getter — analysis data only, no node handle

`OutputController.d.ts:15` documents `getAnalyser(): AnalyserNode | undefined` but marks it **`@deprecated`** with the note: "AnalyserNode is a web-only API and will not work on all platforms." The replacement APIs are `getVolume()` and `getByteFrequencyData()`, both scalar/array reads. `useConversation()` exposes `getOutputByteFrequencyData()` and `getOutputVolume()` — data polling, not a connectable node.

The underlying `MediaDeviceOutput` internal graph is:

```
AudioWorkletNode (audioConcatProcessor)
  → GainNode (gain)
    → AnalyserNode (analyser)
      → MediaStreamDestinationNode (destination)
        → <audio>.srcObject (MediaStream)
          → browser speaker
```

The `AnalyserNode` returned by `getAnalyser()` sits *inside* that closed graph; connecting our room graph onto it would produce a tap (analysis) not a re-route (capture + inject). Even if we connected from it, audio would still play through the SDK's own `<audio>` element in parallel.

**Verdict: no accessible output `AudioNode` to connect into our graph.**

### 1.4 `<audio>` element reference — not exposed publicly

`MediaDeviceOutput` (WebSocket path, `output.js:19–24`) creates an `<audio>` element, appends it to `document.body` with `style.display = "none"`, and stores it as `private readonly audioElement`. The element is not returned anywhere in the public API.

However, since the SDK appends the element to `document.body`, it *is* reachable at runtime via DOM query:

```js
// The SDK appends exactly one hidden <audio> to document.body
// with srcObject set (not src). This selector is reliable.
const sdkAudioEl = [...document.querySelectorAll('audio')]
  .find(el => el.srcObject instanceof MediaStream && el.src === '');
```

This is fragile (breaks if the SDK adds more audio elements or changes the attribute pattern) but is the only path available for WebSocket connections.

**For WebRTC connections this element does not exist.** WebRTC (`WebRTCConnection.js:308–334`) calls `remoteAudioTrack.attach()` which returns an `<audio>` element that is also appended to `document.body` with `display: none`. The `track` object that created it is accessible via the LiveKit `Room` instance, and `WebRTCConnection.getRoom()` is a public method (`WebRTCConnection.d.ts:34`). The LiveKit `Room` is not exposed through the ElevenLabs React hooks — `useRawConversation()` returns a `VoiceConversation` which does not expose `connection` (it is a private field in `BaseConversation`).

### 1.5 `MediaStream` — reachable on both paths

**WebSocket path:** `MediaDeviceOutput` routes audio through a `MediaStreamDestinationNode` and sets the resulting `MediaStream` as `audioElement.srcObject` (see `output.js:28`). That `MediaStream` is on the DOM element and is reachable once the element is found.

**WebRTC path:** each incoming agent audio track is a `RemoteAudioTrack` from LiveKit. `RemoteAudioTrack.attach()` wraps it in an `<audio>` element. The underlying `MediaStreamTrack` is accessible as `track.mediaStreamTrack` inside the `RoomEvent.TrackSubscribed` handler — but that handler runs inside `WebRTCConnection`, not in application code.

Within `setupAudioCapture` (`WebRTCConnection.js:458–500`), the SDK itself does:

```js
const mediaStream = new MediaStream([track.mediaStreamTrack]);
const source = audioContext.createMediaStreamSource(mediaStream);
```

This means the SDK already constructs a `MediaStream` from the WebRTC agent audio track — it's used internally for the `outputAnalyser` and `onAudio` pipeline. This exact pattern is what we would replicate in application code if we could get hold of the `MediaStreamTrack`.

The cleanest access to the `MediaStreamTrack` on the WebRTC path is via the `onConversationCreated` callback, which receives the raw `VoiceConversation` instance. From there, the `output` field is private — but `output.getAnalyser()` returns the `AnalyserNode` from `audioCaptureContext`, and that analyser's source is the agent `MediaStream`. We cannot get back to the stream from the analyser.

**Alternative WebRTC path — DOM query on the `<audio>` element:** the LiveKit `track.attach()` call appends an `<audio>` element with `srcObject` set to a `MediaStream` containing the agent's audio track. We can reach that element the same way as the WebSocket path, and from there get `el.srcObject` which is the live `MediaStream`.

### 1.6 `onAudio` PCM callback

`types.d.ts:51`: `onAudio?: (base64Audio: string) => void` — fires for every compressed audio chunk sent by the agent. On the WebSocket path these are base64-encoded PCM/ulaw frames (the format negotiated at session start, typically `pcm_16000` or `pcm_24000`). On the WebRTC path, `WebRTCConnection.js:495` re-encodes captured output PCM as base64 and fires `onAudio` only when `maxVolume > 0.01` — so it fires on the WebRTC path too, but only for non-silent frames.

Decoding `onAudio` frames into `AudioBufferSourceNode`s is viable but expensive: each callback creates an `AudioBuffer`, schedules a `BufferSourceNode` at `currentTime + epsilon`, and connects it into our graph. The SDK's own `audioConcatProcessor` AudioWorklet already does this scheduling correctly (with gap-free concatenation). Reimplementing that for an HRTF tap would involve: frame queuing, resampling if the SDK sample rate differs from our `AudioContext.sampleRate`, and careful `start()` timing to avoid stuttering. Latency is additive (one extra decode + schedule round-trip per frame). This path works but is the most complex and fragile option.

---

## 2. Chosen Capture Method

**Option 2 (MediaElement → MediaElementAudioSourceNode)**, using DOM discovery to find the SDK-appended `<audio>` element and wrapping its `srcObject` stream.

This works identically on both the WebSocket and WebRTC paths because both append an `<audio>` element with `srcObject = MediaStream` to `document.body`. The element is stable for the lifetime of the session.

### Why not Option 1 (expose internal AudioContext / AudioNode)?

The SDK does not expose either. The internal `context` in `MediaDeviceOutput` and `audioCaptureContext` in `WebRTCConnection` are private fields with no getter. Accessing them would require `Object.getOwnPropertyDescriptor` on the internal instance, which breaks on minification and is unmaintainable.

### Why not Option 3 (MediaStream)?

`MediaElementAudioSourceNode` wrapping the `<audio>` element is strictly simpler and equally low-latency — it uses the same underlying `MediaStream`. Constructing a raw `MediaStreamAudioSourceNode` from `el.srcObject` would also work and is slightly more explicit, but the element wrapper is already available and avoids needing to cast `srcObject`.

### Why not Option 4 (fallback)?

We can reach the audio output without touching SDK internals or PCM decoding. Option 4 is unnecessary.

### Why not `onAudio` PCM?

It works but adds: per-frame object allocation, scheduling complexity (gap-free concatenation), potential resampling, and ~10–30 ms additional latency per frame. The `<audio>` element path delivers audio at the same latency the browser already plays it, with zero additional buffering.

---

## 3. The Exact Wiring Call

### 3a. Discovery (run once after session connects)

```js
/**
 * Find the hidden <audio> element the ElevenLabs SDK appends to document.body.
 * The SDK sets srcObject = MediaStream (not src = URL), which is the reliable
 * distinguishing attribute. Call this inside onConnect or a short RAF loop
 * after startSession resolves — the element exists by the time onConnect fires.
 *
 * @param {AudioContext} ourCtx  — the AudioContext for our HRTF room graph
 * @returns {MediaElementAudioSourceNode}
 */
function captureAdmirerOutput(ourCtx) {
  const sdkAudioEl = [...document.querySelectorAll('audio')]
    .find(el => el.srcObject instanceof MediaStream && el.src === '');

  if (!sdkAudioEl) {
    throw new Error('[admirer-spatial] SDK audio element not found — call after onConnect');
  }

  // Prevent the SDK from directly playing the audio; we will route it through
  // our graph to a destination node and then to the context destination.
  // Note: muting (not pausing) keeps srcObject alive on the element.
  sdkAudioEl.muted = true;

  return new MediaElementAudioSourceNode(ourCtx, { mediaElement: sdkAudioEl });
}
```

### 3b. Routing into the HRTF room graph

```js
// Inside OrchestraEngine or a new AdmirerSpatialEngine, after the room graph
// is constructed and after the Admirer session connects:

const admirerSource = captureAdmirerOutput(this.ctx);  // our AudioContext

// Connect into the same per-stem chain shape used for stems, or a dedicated
// admirer panner node at a fixed frontal azimuth (0°, elevation 10°):
const admirerPanner = new PannerNode(this.ctx, {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  positionX: 0,      // front centre
  positionY: 0.17,   // slight elevation (≈10°)
  positionZ: -1,     // in front of listener
  refDistance: 1,
  maxDistance: 10,
  rolloffFactor: 1,
});

admirerSource.connect(admirerPanner);
admirerPanner.connect(this.directBus);  // or masterGain, same as stems
```

### 3c. Where the variables come from

| Variable | Source |
|---|---|
| `ourCtx` | `OrchestraEngine`'s existing `this.ctx` (the same `AudioContext` already in use for stems, HRTF panners, hall reverb, binaural beats) |
| `sdkAudioEl` | DOM query on `document.body` after `onConnect` fires |
| `this.directBus` / `this.masterGain` | existing `OrchestraEngine` internal nodes |

### 3d. Timing

Call `captureAdmirerOutput(ourCtx)` inside the Admirer session's `onConnect` callback (which fires after the SDK has appended the `<audio>` element and set `srcObject`). The `MediaElementAudioSourceNode` constructor call is synchronous and safe on the main thread.

---

## 4. Known Constraints and Limitations

**Single-context constraint.** `MediaElementAudioSourceNode` can only be created once per `<audio>` element per `AudioContext`. If the Admirer session reconnects mid-Orchestra (e.g. agent disconnects and the user re-starts), the old `<audio>` element is removed from the DOM and a new one is appended. The capture function must be called again on the new element; the old `MediaElementAudioSourceNode` is already inert (its source element was removed). Handle this in `onDisconnect` + `onConnect` by storing and disconnecting the old source node before creating a new one.

**`el.muted = true` stops direct speaker output.** Once we set `sdkAudioEl.muted = true` and route through our graph, the SDK's volume control (`setVolume`) still adjusts the internal `GainNode` gain — that gain is upstream of our tap and so still works. Interruption (which fades the gain to near-zero) also propagates correctly.

**WebRTC `<audio>` vs WebSocket `<audio>`.** Both paths produce a hidden `<audio>` with `srcObject instanceof MediaStream && el.src === ''`. However: on the WebRTC path the `<audio>` is created by LiveKit's `RemoteAudioTrack.attach()`, which may produce more than one element if the agent sends multiple audio tracks. In practice ElevenLabs agents publish exactly one audio track per session. The `find()` query returns the first match — if the order is unexpected, add a second filter: `el.volume > 0` (LiveKit sets `autoplay = true` and leaves `volume = 1`).

**Cross-context resampling.** The SDK creates its own `AudioContext` at the sample rate the server negotiates (typically 16 000 Hz or 24 000 Hz for WebSocket, 48 000 Hz for WebRTC/LiveKit). Our `OrchestraEngine` context runs at the browser default (usually 48 000 Hz). `MediaElementAudioSourceNode` resamples automatically at the browser level — no manual resampling needed.

**`onAudio` as an audit path.** The `onAudio: (base64Audio: string) => void` callback remains available if the `<audio>` element approach ever breaks (e.g. SDK internals change). It can serve as a fallback capture path with the decode-and-schedule pattern described in §1.6.

---

## 5. Files Referenced

| File | Key finding |
|---|---|
| `node_modules/@elevenlabs/client/dist/utils/output.js` | `MediaDeviceOutput` internal graph; `<audio>` element appended to `document.body` with `srcObject = MediaStream` (WebSocket path) |
| `node_modules/@elevenlabs/client/dist/utils/WebRTCConnection.js` | `track.attach()` appends `<audio>` to `document.body`; `setupAudioCapture` shows MediaStream construction from agent track |
| `node_modules/@elevenlabs/client/dist/OutputController.d.ts` | Public interface — no node, no context, no stream; only `getAnalyser()` (deprecated) and scalar data getters |
| `node_modules/@elevenlabs/client/dist/types.d.ts:51` | `onAudio?: (base64Audio: string) => void` — PCM callback (viable fallback, not primary path) |
| `node_modules/@elevenlabs/client/dist/utils/ConnectionFactory.js` | Default connection type is WebRTC for voice sessions without a `signedUrl` |
| `node_modules/@elevenlabs/client/dist/utils/BaseConnection.d.ts` | `Options` type — no `audioContext` injection field |
| `node_modules/@elevenlabs/react/dist/conversation/ConversationContext.d.ts` | `useRawConversation()` returns `Conversation | null` — no output node or stream getter |
