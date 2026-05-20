# Admirer Tap-to-Agent Spike

**Date:** 2026-05-20  
**Task:** Determine how to deliver a tapped Yes/No button press to the ElevenLabs Conversational AI agent as a user turn.

---

## What `useConversation` exposes for sending input

`useConversation()` (from `@elevenlabs/react`) returns these relevant send methods:

| Method | Signature | Wire message type |
|---|---|---|
| `sendUserMessage` | `(text: string) => void` | `{ type: "user_message", text }` |
| `sendContextualUpdate` | `(text: string, options?: { contextId?: string }) => void` | `{ type: "contextual_update", text, context_id? }` |
| `sendUserActivity` | `() => void` | `{ type: "user_activity" }` |
| `sendMultimodalMessage` | `(options: { text?: string; fileId?: string }) => void` | `{ type: "multimodal_message", ... }` |

Source: `node_modules/@elevenlabs/client/dist/BaseConversation.js` lines 402–437 (implementation) and `node_modules/@elevenlabs/react/dist/conversation/useConversation.d.ts` (React hook surface).

---

## The two candidate methods and what they actually do

### `sendUserMessage(text: string)`

Sends `{ type: "user_message", text }` over the WebSocket connection. The wire type is `"user_message"` — the same channel used for user speech transcripts (which arrive from the server as `{ type: "user_transcript", ... }`). This is a **client-originated user turn**: it injects text into the conversation as if the user had said it, and the agent is expected to respond to it.

This is the correct method for button-tap injection.

### `sendContextualUpdate(text: string, options?)`

Sends `{ type: "contextual_update", text }`. This is a **silent background injection** — it adds context to the agent's awareness without creating a conversational user turn the agent must respond to. Appropriate for injecting background state (e.g., "user is on phase 5"), not for delivering a direct answer like "yes" or "no".

---

## Recommendation

**Use `sendUserMessage`.**

When the user taps the Yes or No button:

```js
// from useConversation() already available via useAdmirerAgent → conv
conv.sendUserMessage("yes")   // Yes tap
conv.sendUserMessage("no")    // No tap
```

In `useAdmirerAgent.js`, expose it on the returned object so callers can call it directly:

```js
return {
  connect,
  disconnect,
  status: conv.status,
  isSpeaking: !!conv.isSpeaking,
  isListening: !!conv.isListening,
  isMuted: !!conv.isMuted,
  setMuted: conv.setMuted,
  sendUserMessage: conv.sendUserMessage,   // add this line
}
```

Then in the phase component:

```js
const admirer = useAdmirerAgent({ sessionStage: 'opening', callbacks })
// ...
<button onClick={() => admirer.sendUserMessage("yes")}>Yes</button>
<button onClick={() => admirer.sendUserMessage("no")}>No</button>
```

### Push-to-talk + button-tap coexistence

The session is currently started muted (`setMuted(true)` on connect). `sendUserMessage` sends directly over the WebSocket — it does **not** go through the microphone or VAD pipeline, so it works correctly regardless of mute state. No need to unmute the mic for a button tap.

---

## Interaction behaviour (what needs a runtime test to confirm)

The type signature confirms `sendUserMessage` sends the wire message. What cannot be verified from types alone:

1. **Does the agent treat `user_message` as an interruptible turn?** If the agent is currently speaking (mode = `"speaking"`), does `sendUserMessage` interrupt the agent or queue behind its current utterance? The SDK does not appear to apply the interruption logic before sending — it goes straight to `connection.sendMessage`. Behavior is server-side and needs a runtime test.

2. **Does the agent's LLM context show the tapped text?** The message appears in the same `onMessage` callback with `role: "user"` (confirmed via `handleUserTranscript` path — though that is a transcript event from speech; `user_message` will likely surface differently). Worth logging `onMessage` during a test to confirm the agent sees it in context.

3. **Does the agent respond to a bare `"yes"` or `"no"` correctly?** This depends on the agent's system prompt having enough context to understand a one-word answer. If the agent asks "Did you find that interesting?" and the user taps "yes", the agent needs to know what "yes" refers to. The system prompt or a preceding `sendContextualUpdate` may need to frame the question before the button appears.

---

## If `sendUserMessage` does not create a user turn (fallback)

If runtime tests show `user_message` is ignored or does not trigger an agent response, the fallback is:

- Yes/No buttons become **voice-only visual mirrors**: tapping highlights the button as a visual hint but does nothing to the agent. The user must speak aloud. This is a known limitation, documented here, and acceptable for v1 of the fragment-rating step.

---

## Summary

There is a clear programmatic path. The exact call is:

```js
conversation.sendUserMessage("yes")
```

Two behaviors need a 5-minute runtime test to confirm: agent interrupt/queue behavior while speaking, and whether one-word answers parse correctly given the current system prompt context.
