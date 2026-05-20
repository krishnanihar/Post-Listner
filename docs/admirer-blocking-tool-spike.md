# Spike: Can `playFragment` Block the Agent Until the User Rates?

**Date:** 2026-05-20  
**Branch:** musicking  
**Status:** DONE — blocking tool is viable. Recommend A1 (tap-to-rate).

---

## The Problem

`playFragment` is currently configured `expects_response: false` / `execution_mode: "immediate"`. The agent fires it and does not wait. It races through all three fragments in ~10 seconds, talking over them, and the on-screen rating UI (FragmentControls) never gets a chance to be seen and tapped. This spike confirms that switching to `expects_response: true` makes the agent block silently until the client resolves the tool call — and determines exactly how to wire it.

---

## Q1 — `expects_response: true`: does the agent wait?

**Yes — explicitly confirmed.**

From the ElevenLabs `Update Agent` API reference (the authoritative schema source):

> **`expects_response`** (boolean, default `false`) — "If true, calling this tool should block the conversation until the client responds with some response which is passed to the llm. If false then we will continue the conversation without waiting for the client to respond, this is useful to show content to a user but not block the conversation."

The `expects_response: true` flag is the primary control. When set, the agent suspends its next LLM generation step and waits for a `client_tool_result` message from the SDK before continuing. It does not generate further speech or advance the conversation while the call is in flight.

**Source:** `https://elevenlabs.io/docs/api-reference/agents/update` (field-level schema for `ClientTool`).

---

## Q2 — `execution_mode`: which value makes the agent wait?

`execution_mode` is a `ToolExecutionMode` enum with three values:

| Value | Behavior |
|---|---|
| `immediate` | Execute the tool right away when the LLM requests it, before any agent speech. |
| `post_tool_speech` | Wait for the agent to finish its current speech turn before executing. |
| `async` | Run the tool in the background without blocking — best for long-running operations. |

**Critical finding:** `execution_mode` does NOT control whether the agent waits for the tool result. It only controls WHEN the tool fires (immediately vs. after current speech). Waiting for the result is controlled solely by `expects_response`.

For `playFragment`, use `execution_mode: "immediate"` (fire as soon as the LLM requests it) + `expects_response: true` (block until the client resolves). The `async` value would explicitly bypass blocking, so do not use it.

**Source:** Same `Update Agent` API reference; confirmed by April 27, 2026 ElevenLabs changelog entry: "Workflow tool dispatch nodes now correctly respect each nested tool's `execution_mode`. If any tool in a dispatch node uses `POST_TOOL_SPEECH`, the workflow waits for the current turn's audio to be fully exposed before executing the dispatch." — showing `execution_mode` governs timing of invocation, not of result waiting.

---

## Q3 — `response_timeout_secs`: maximum and ceiling

For **client tools** (not MCP tools):

| Field | Value |
|---|---|
| Type | integer |
| Default | 20 seconds |
| Minimum | 1 second |
| Maximum | **120 seconds** |

**Source:** `Update Agent` API reference field description: "The maximum time in seconds to wait for the tool call to complete." Range 1–120.

Note: The 120-second maximum referenced above is for client tools. MCP tool configuration (`response_timeout_secs` on MCP servers/overrides) was raised from 120 to 300 seconds in a later update — but that increase applies to MCP, not client tools. For client tools, 120 is the ceiling as of the current API spec.

A 20–30 second timeout easily fits within the 120-second ceiling. A `playFragment` call covering a 14-second clip + user rating UI + a few seconds buffer is well inside limits. Recommended value: **30 seconds** (slightly over the 14 s clip cap + 15 s generous rating window, with 1 s slack before the hard ceiling matters).

**Verified in production example:** The `messageClaudeCode` tool in a publicly filed bug report (github.com/slopus/happy/issues/1032) uses `response_timeout_secs: 120` with `expects_response: true` and `execution_mode: "immediate"` — confirming these values are accepted by the platform.

---

## Q4 — User speech during a pending tool call (THE CRITICAL DESIGN FORK)

This is the most ambiguous point; the documentation does not fully specify it, but the available evidence points clearly to one answer.

**What we know:**

1. The ElevenLabs React SDK docs state plainly: "The tool must be explicitly set to block the conversation in the ElevenLabs UI for the agent to await and react to the response. **Otherwise, the agent assumes success and continues the conversation.**" (elevenlabs.io/docs/eleven-agents/libraries/react)

2. A `disable_interruptions` boolean field (default `false`) exists on client tools. Its description: "If true, the user will not be able to interrupt the agent while this tool is running." This field is specifically for tools — it suppresses VAD from treating user audio as a new turn while the tool is running. Its existence as a separate opt-in implies that **by default, the microphone stays live and VAD continues** during a pending tool call.

3. With push-to-talk (PTT) in effect, the mic is muted via `setMuted(true)` except while the user holds the speak button. PTT is already active in this app.

4. The distinction matters: if `disable_interruptions: false` (default), the agent's VAD continues listening. If the user speaks (or the mic is open via PTT), that audio is treated as a new user turn and sent to the LLM — potentially interrupting the pending tool flow. A changelog fix ("Fixed the agent tool-call sound being interpreted as user speech and interrupting the agent during tool execution") confirms that unintended audio reaching the VAD during tool execution has been a real problem.

**What remains unconfirmed by documentation:**

Whether a voice user-turn received by the server while a `client_tool_result` is still pending is: (a) queued until after the tool result arrives and the agent speaks, or (b) immediately processed, producing a response that could cross with the tool-result response, or (c) dropped. This is not specified.

**Practical conclusion:** Even if voice answers are technically processed, the timing is unreliable. The user says "yes" while the 14-second fragment is playing; the agent has no way to know they meant the rating (they could be speaking for any reason) unless a `client_tool_result` message is sent at the same time to give the LLM context. Relying on the voice path for Yes/No during a pending tool call is fragile.

**Recommendation: A1 — resolve via tap, not voice.**

---

## Q5 — SDK async behavior: does a Promise-returning handler work?

**Yes — confirmed by SDK source code.**

From `node_modules/@elevenlabs/client/dist/BaseConversation.js`, the `handleClientToolCall` method:

```js
async handleClientToolCall(event) {
  if (Object.prototype.hasOwnProperty.call(this.options.clientTools, event.client_tool_call.tool_name)) {
    try {
      const result = (await this.options.clientTools[event.client_tool_call.tool_name](
        event.client_tool_call.parameters
      )) ?? "Client tool execution successful.";
      // ...
      this.connection.sendMessage({
        type: "client_tool_result",
        tool_call_id: event.client_tool_call.tool_call_id,
        result: formattedResult,
        is_error: false,
      });
    } catch (e) { /* sends is_error: true */ }
  }
}
```

The SDK `await`s the tool function. If the function returns a `Promise`, the SDK holds the `client_tool_result` message until that Promise resolves. Only then does it send the result over the WebSocket — and the server, since `expects_response: true`, is waiting for exactly that message before letting the LLM continue.

The TypeScript type confirms this:

```ts
// From BaseConversation.d.ts:
clientTools: Record<string, (parameters: any) => Promise<string | number | void> | string | number | void>;

// From @elevenlabs/react/dist/conversation/types.d.ts:
type ClientTool<...> = (parameters: Parameters) => Promise<Result> | Result;
```

**End-to-end flow for a blocking `playFragment`:**

1. Agent LLM outputs a `playFragment` tool call.
2. Server sends `client_tool_call` event over WS to the SDK.
3. `handleClientToolCall` is called — `await`s the registered handler.
4. The handler starts audio playback, starts a 14 s cap timer, shows the rating UI, and returns a `Promise` that resolves only when the user taps Yes/No (or the timer expires and a default answer is sent).
5. When the Promise resolves with e.g. `"rated: yes"`, the SDK sends `client_tool_result` back over WS.
6. The server-side agent, which has been blocked waiting for that result (`expects_response: true`), receives it and feeds it into the LLM context.
7. The LLM generates its next turn ("You liked that one...") and the agent speaks.

A handler returning a Promise that resolves after 15–25 seconds works exactly as required. The SDK does not timeout independently — the platform-side `response_timeout_secs` enforces the ceiling.

**Source:** `/Users/krishnaniharsunkara/Projects/Post-Listner/node_modules/@elevenlabs/client/dist/BaseConversation.js` (lines covering `handleClientToolCall`); `/Users/krishnaniharsunkara/Projects/Post-Listner/node_modules/@elevenlabs/client/dist/BaseConversation.d.ts` (type signature for `clientTools`).

---

## Q6 — Push-to-talk interaction with a blocking tool

**No bad interaction — PTT is actually protective here.**

With PTT active (`setMuted(true)` on connect), the mic is closed by default. The `setMuted` call operates on the local media track, not the WebSocket connection. While `playFragment` is pending, the mic is muted, so no user audio reaches the VAD.

The only risk would be if the user held the speak button during fragment playback and said "yes" by voice before the rating UI appeared. With PTT:
- Their voice audio IS sent to the server during PTT hold.
- The server VAD would attempt to process it as a user turn.
- Whether that voice turn is queued, raced against the tool result, or dropped depends on platform behavior that isn't documented (see Q4).

The safest approach: for the fragment playback window specifically, do not surface the speak button (or disable it) while the fragment is playing. The rating UI (tap buttons) is sufficient. The speak button only re-enables after the rating is submitted, which is when the tool resolves and the agent responds.

**Source:** `/Users/krishnaniharsunkara/Projects/Post-Listner/src/hooks/useAdmirerAgent.js` (PTT logic via `setMuted`); `/Users/krishnaniharsunkara/Projects/Post-Listner/src/phases/Admirer.jsx` (HoldToSpeak component).

---

## Verdict: Blocking `playFragment` is viable.

The platform supports it cleanly. The SDK handles async Promise handlers natively. The server-side blocks while the tool is pending.

### Exact tool configuration (in ElevenLabs agent dashboard / API)

```json
{
  "type": "client",
  "name": "playFragment",
  "description": "Play a short musical fragment for the user to hear and rate. The agent must wait silently while the fragment plays and the user rates it before proceeding.",
  "execution_mode": "immediate",
  "expects_response": true,
  "response_timeout_secs": 30,
  "disable_interruptions": true,
  "parameters": [
    {
      "id": "fragmentId",
      "name": "fragmentId",
      "type": "string",
      "description": "The ID of the fragment to play from the fragment bank.",
      "required": true
    }
  ]
}
```

`disable_interruptions: true` is strongly recommended: it tells the server not to treat audio received during the tool window as a new user turn, removing the ambiguous race described in Q4.

---

## Design fork — A1 vs A2

**Recommend A1.**

**A1** — Tool resolves on tap (Yes/No) or timeout. Voice rating dropped for the listening run.

**A2** — Tool blocks only for the clip duration (~14 s), then resolves; agent asks "did you like that?" and takes a normal voice/tap turn.

A1 is correct for this app for three reasons:

1. **Timing is owned by the client.** The fragment plays for exactly 14 s (cap timer). The rating UI appears at 14 s. The user taps. The Promise resolves. The agent speaks. Every step is deterministic. No second round-trip needed.

2. **Voice-answer during the tool window is unreliable** (Q4 above). A2 requires the user to speak while the tool is still pending or just after it resolves — creating a narrow timing window where VAD behavior is undocumented and potentially non-deterministic.

3. **PTT is already in place.** The listening run is explicitly non-voice (fragment is playing; the user is listening, not speaking). The tap is the natural gesture. A second "did you like that?" turn (A2) adds latency and conversational overhead for no benefit.

**A1 implementation sketch for `playFragment` in `admirerTools.js`:**

```js
playFragment: ({ fragmentId } = {}) => {
  const f = getFragment(fragmentId)
  if (!f) return Promise.resolve({ ok: false, reason: `unknown fragmentId: ${fragmentId}` })

  // Return a Promise that resolves when the host phase calls resolveFragment().
  // The host sets up this resolver via cb.onPlayFragment.
  return new Promise((resolve) => {
    cb.onPlayFragment?.({ ...f, resolve })
  })
}
```

In `Admirer.jsx`, `onPlayFragment` receives the resolver alongside the fragment. It starts audio, starts the cap timer, shows the rating UI. When the user taps Yes/No (or the timer fires), it calls `resolve({ ok: true, rating: 'yes' | 'no' | 'timeout' })`. The SDK sends the result; the agent hears `"rated: yes"` and continues.

---

## Unresolved unknowns (live test only)

1. **What happens to a PTT voice turn received by the server while a tool is `expects_response: true` and `disable_interruptions: false`?** Documentation is silent. With `disable_interruptions: true` (recommended above) this should be moot — but a live test should verify the server actually honors it for client tools, not just MCP tools.

2. **Does the server enforce `response_timeout_secs` gracefully?** If the timer fires (user never taps, or the resolve never called), does the agent recover and continue, or does the WebSocket session enter an error state? The docs say it's a max wait, not a hard error — but verify in a live test.

3. **Multiple simultaneous tool calls?** The agent system prompt currently allows it to call `playFragment` up to 3 times across the listening run. With `expects_response: true`, each call is sequential by design (agent waits for result before next LLM step). Confirm the system prompt instructs the agent to call one fragment, receive the result, then decide on the next.

---

## Sources

- ElevenLabs API reference — Update Agent (client tool schema): `https://elevenlabs.io/docs/api-reference/agents/update`
- ElevenLabs React SDK docs: `https://elevenlabs.io/docs/eleven-agents/libraries/react`
- ElevenLabs changelog 2026-04-27 (execution_mode dispatch, pre_tool_speech): `https://elevenlabs.io/docs/changelog/2026/4/27`
- ElevenLabs changelog 2025-12-15 (expects_response default value fix): `https://elevenlabs.io/docs/changelog/2025/12/15`
- ElevenLabs MCP tool-configuration API (response_timeout_secs 5–300 for MCP): `https://elevenlabs.io/docs/api-reference/mcp/tool-configuration/create`
- Real-world tool config example (execution_mode: immediate, expects_response: true, response_timeout_secs: 120): `https://github.com/slopus/happy/issues/1032`
- SDK source: `/Users/krishnaniharsunkara/Projects/Post-Listner/node_modules/@elevenlabs/client/dist/BaseConversation.js`
- SDK types: `/Users/krishnaniharsunkara/Projects/Post-Listner/node_modules/@elevenlabs/client/dist/BaseConversation.d.ts`
- SDK types (React): `/Users/krishnaniharsunkara/Projects/Post-Listner/node_modules/@elevenlabs/react/dist/conversation/types.d.ts`
