# LDZ Avatars — Simulated Patient MVP

A browser-based interactive AI avatar that simulates a model clinical profile for educational training. The avatar speaks in Slovak.

> **Disclaimer:** This is an educational simulation tool. It does not provide medical advice, clinical assessment, diagnostic information, or mental health evaluation. The avatar is a fictional character used for training purposes only.

---

## What this builds

- A Next.js web app connected to HeyGen's **LiveAvatar** platform
- A live voice conversation with a simulated patient avatar in Slovak
- A debug-first UI: status, live transcripts, session metadata, error panel
- A safe backend layer that never exposes the API key to the browser

---

## Prerequisites

- Node.js 18+
- A HeyGen account with API access ([app.heygen.com/settings?nav=API](https://app.heygen.com/settings?nav=API))
- An Avatar ID from the LiveAvatar platform
- A Knowledge Base (context/persona) configured in HeyGen with your patient profile

---

## Setup

### 1. Install dependencies

```bash
cd ldz-avatars
npm install
```

### 2. Configure environment variables

Edit `.env.local`:

```bash
# Required — your HeyGen API key (NEVER expose this to the client)
LIVEAVATAR_API_KEY=your_api_key_here

# Default avatar to load in the UI (can be overridden in the input field)
NEXT_PUBLIC_DEFAULT_AVATAR_ID=Anna_public_3_20240108

# Knowledge Base ID — this is where the patient persona lives
NEXT_PUBLIC_DEFAULT_CONTEXT_ID=your_knowledge_base_id_here

# Optional voice ID
NEXT_PUBLIC_DEFAULT_VOICE_ID=

# Sandbox/trial mode flag
NEXT_PUBLIC_USE_SANDBOX=true
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to get your IDs

### API Key

Log in → [app.heygen.com/settings?nav=API](https://app.heygen.com/settings?nav=API) → copy your API key or Trial token.

### Avatar ID

Go to [labs.heygen.com/interactive-avatar](https://labs.heygen.com/interactive-avatar) → **Select Avatar** → copy the Avatar ID shown.

Public avatars (examples):
- `Anna_public_3_20240108`
- `Wayne_20240711`
- `Kayla-incasualsuit-20220818`

### Knowledge Base ID

This is the most important piece. The patient's personality, behavioral profile, language rules, and educational scenario live here.

1. Open [labs.heygen.com](https://labs.heygen.com) → **Knowledge Base**
2. Create or select a persona
3. Write the system prompt describing the simulated patient (see behavioral guidelines below)
4. Copy the Knowledge Base ID → paste into `NEXT_PUBLIC_DEFAULT_CONTEXT_ID`

---

## Patient persona guidelines

When writing the Knowledge Base prompt for the avatar, follow these rules:

- Speak as a person describing lived experience, not a textbook
- Remain calm but slightly uncertain
- Be occasionally indirect; become more fragmented under pressure
- Do not name your own diagnosis
- Do not provide medical advice
- Do not evaluate the person you are speaking to
- Keep answers medium-short by default
- Speak in Slovak
- Remain consistent throughout the session

---

## Testing the start/stop flow

1. Fill in Avatar ID and Knowledge Base ID in `.env.local`
2. Run `npm run dev`
3. Open `http://localhost:3000`
4. Click **Start session** — the debug log will show each connection step
5. The avatar video stream will appear when LiveKit tracks are ready
6. Speak in Slovak — you will see live transcript chunks appear
7. Click **Stop session** — the transcript is saved server-side
8. Click **Fetch transcript** — retrieves the saved transcript

---

## How to fetch a transcript manually

After stopping a session, use curl:

```bash
curl http://localhost:3000/api/liveavatar/transcript/YOUR_SESSION_ID
```

Or via the browser:

```
http://localhost:3000/api/liveavatar/transcript/YOUR_SESSION_ID
```

---

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/liveavatar/session` | Creates a LiveAvatar session in FULL mode |
| GET | `/api/liveavatar/transcript/[sessionId]` | Returns saved transcript |
| POST | `/api/session/save` | Saves transcript from client after session ends |

### POST `/api/liveavatar/session`

Request body:
```json
{
  "avatarId": "Anna_public_3_20240108",
  "contextId": "your-knowledge-base-id",
  "voiceId": "optional-voice-id",
  "language": "sk",
  "sandbox": true
}
```

Response:
```json
{
  "sessionToken": "...",
  "sessionId": "..."
}
```

The `sessionToken` is passed to `LiveAvatarSession` on the client. It is a one-time-use token. The `sessionId` is used for transcript retrieval.

---

## Sandbox mode

Trial tokens limit you to 3 concurrent sessions. If you hit the limit, stop unused sessions.

Check your active sessions:

```bash
curl https://api.liveavatar.com/v1/sessions/list \
  -H "x-api-key: YOUR_API_KEY"
```

---

## Project structure

```
app/
  page.tsx                         Main UI — client component, full SDK integration
  layout.tsx
  api/
    liveavatar/
      session/route.ts             POST — calls LiveAvatar API in FULL mode
      transcript/[sessionId]/route.ts  GET — returns saved transcript
    session/
      save/route.ts                POST — saves transcript from client

components/
  AvatarPanel.tsx                  Video element; session.attach() targets this
  TranscriptPanel.tsx              Scrollable transcript with live chunk display
  ControlBar.tsx                   Start / Stop / Fetch buttons
  StatusBadge.tsx                  App status indicator

lib/
  types.ts                         TypeScript types (shared client + server)
  validators.ts                    Zod schemas for API request validation
  liveavatar.ts                    HeyGen REST client + in-memory transcript store
```

---

## SDK event model

The `@heygen/liveavatar-web-sdk` emits two categories of events:

### Session events (`SessionEvent`)

| Event | When |
|-------|------|
| `session.state_changed` | State changes: INACTIVE → CONNECTING → CONNECTED → … |
| `session.stream_ready` | Both video and audio tracks are subscribed — call `session.attach(element)` here |
| `session.disconnected` | Session ended; includes disconnect reason |
| `session.connection_quality_changed` | Network quality indicator update |

### Agent events (`AgentEventsEnum`)

| Event | Payload |
|-------|---------|
| `user.speak_started` | User started speaking |
| `user.speak_ended` | User stopped speaking |
| `user.transcription.chunk` | Partial STT result (live display) |
| `user.transcription` | Final STT result (add to transcript) |
| `avatar.speak_started` | Avatar started speaking |
| `avatar.speak_ended` | Avatar stopped speaking |
| `avatar.transcription.chunk` | Partial avatar TTS transcript |
| `avatar.transcription` | Final avatar TTS transcript |
| `session.stopped` | Server closed the session |

---

## Upgrading to custom AI brain (v2)

To replace HeyGen's built-in LLM with your own:

1. Switch the session config to a non-conversational mode
2. Subscribe to `user.transcription` events for user speech input
3. Send user text to your own LLM (OpenAI, Anthropic, etc.)
4. Call `session.repeat(text)` or `session.message(text)` with the LLM response
5. Keep the same session transport and UI
