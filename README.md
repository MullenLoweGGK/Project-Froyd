# Project Froyd — Simulated Patient

Browser-based interactive AI avatar simulating a model clinical profile for educational training. The avatar speaks in Slovak.

> **Disclaimer:** Educational simulation only. Not a medical device, diagnostic tool, or mental health assessment. The avatar is a fictional character used for training purposes.

---

## What this is

- A Next.js app connected to the **HeyGen LiveAvatar** platform (`@heygen/liveavatar-web-sdk`)
- Live voice conversation with a simulated patient avatar in Slovak
- FULL mode — HeyGen handles LLM, STT, and TTS entirely server-side
- Fullscreen presentation mode with live subtitles
- Mobile-optimised responsive UI
- Backend API layer that never exposes secrets to the client

---

## Prerequisites

- Node.js 18+
- A HeyGen account with API access — [app.heygen.com/settings?nav=API](https://app.heygen.com/settings?nav=API)
- An Interactive Avatar UUID from [labs.heygen.com](https://labs.heygen.com/interactive-avatar)
- A Knowledge Base UUID with the patient persona prompt

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create or edit `.env.local` in the project root:

```bash
# Required — HeyGen API key (server-side only, never sent to the browser)
LIVEAVATAR_API_KEY=your_api_key_here

# Required — Avatar UUID (must be UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
NEXT_PUBLIC_DEFAULT_AVATAR_ID=

# Recommended — Knowledge Base UUID (patient persona prompt lives here)
NEXT_PUBLIC_DEFAULT_CONTEXT_ID=

# Optional — Voice UUID
NEXT_PUBLIC_DEFAULT_VOICE_ID=

# false = production mode, true = sandbox/trial
NEXT_PUBLIC_USE_SANDBOX=false
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to get your IDs

> **Important:** The LiveAvatar API requires **UUID format** for all IDs:
> `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
> Old-style names like `Anna_public_3_20240108` will not work.

### API Key

[app.heygen.com/settings?nav=API](https://app.heygen.com/settings?nav=API) → copy your API key.

### Avatar UUID

[labs.heygen.com/interactive-avatar](https://labs.heygen.com/interactive-avatar) → select avatar → copy the UUID from the details panel or URL.

### Knowledge Base UUID

1. Open [labs.heygen.com](https://labs.heygen.com) → **Knowledge Base**
2. Create or open a persona
3. Write the patient persona system prompt (see guidelines below)
4. Copy the UUID → paste into `NEXT_PUBLIC_DEFAULT_CONTEXT_ID`

---

## Patient persona guidelines

When writing the Knowledge Base prompt:

- Speak as a person describing lived experience — not a textbook
- Remain calm but slightly uncertain
- Be occasionally indirect; more fragmented under pressure
- Do not name your own diagnosis
- Do not provide medical advice
- Do not evaluate the person speaking to you
- Keep answers medium-short by default
- Speak in Slovak throughout the session

---

## Using the app

### Starting a session

1. Open the app — avatar video panel is at the top
2. Expand **Session config** (collapsed by default) to verify or change IDs
3. Click **Start session**
4. Wait for the stream — the avatar appears when LiveKit connects
5. Speak in Slovak — transcripts appear in real time

### Fullscreen presentation mode

- Once the avatar stream is active, a **⛶ button** appears on the video
- Click it to go fullscreen — avatar fills the entire screen
- Live subtitles appear at the bottom as the avatar speaks
- Exit with the **Zatvoriť** button or **ESC**

### Stopping a session

1. Click **Stop session**
2. The transcript is automatically saved server-side
3. Click **Fetch transcript** to retrieve and display it

---

## How to fetch a transcript manually

```bash
curl https://your-vercel-url.vercel.app/api/liveavatar/transcript/SESSION_ID
```

Or locally:

```bash
curl http://localhost:3000/api/liveavatar/transcript/SESSION_ID
```

---

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/liveavatar/session` | Create LiveAvatar session token (FULL mode) |
| GET | `/api/liveavatar/transcript/[sessionId]` | Retrieve saved transcript |
| POST | `/api/session/save` | Save transcript after session ends |

### POST `/api/liveavatar/session`

Request body:
```json
{
  "avatarId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "contextId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "voiceId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "language": "sk",
  "isSandbox": false
}
```

Response:
```json
{
  "sessionToken": "...",
  "sessionId": "..."
}
```

---

## Project structure

```
app/
  page.tsx                              Main UI — LiveAvatarSession integration
  layout.tsx
  api/
    liveavatar/
      session/route.ts                  POST — creates session token via LiveAvatar API
      transcript/[sessionId]/route.ts   GET — retrieves transcript
    session/
      save/route.ts                     POST — saves transcript server-side

components/
  AvatarPanel.tsx       Video element + fullscreen mode + subtitle overlay
  TranscriptPanel.tsx   Scrollable transcript with live chunk display
  ControlBar.tsx        Start / Stop / Fetch buttons (mobile-optimised)
  StatusBadge.tsx       App status indicator

lib/
  types.ts              Shared TypeScript types
  validators.ts         Zod schemas for API validation
  liveavatar.ts         HeyGen REST client + in-memory transcript store
```

---

## SDK event reference

### Session events (`SessionEvent`)

| Event | When |
|-------|------|
| `session.state_changed` | INACTIVE → CONNECTING → CONNECTED → DISCONNECTED |
| `session.stream_ready` | Video + audio ready — `session.attach(element)` called here |
| `session.disconnected` | Session ended (includes reason) |

### Agent events (`AgentEventsEnum`)

| Event | Payload |
|-------|---------|
| `user.speak_started` | User started speaking |
| `user.speak_ended` | User stopped speaking |
| `user.transcription.chunk` | Partial STT (live display) |
| `user.transcription` | Final STT result |
| `avatar.speak_started` | Avatar started speaking |
| `avatar.speak_ended` | Avatar stopped speaking |
| `avatar.transcription.chunk` | Partial avatar speech (subtitle display) |
| `avatar.transcription` | Final avatar speech |
| `session.stopped` | Server closed the session |

---

## Sandbox / trial mode

Trial tokens allow max 3 concurrent sessions. Set `NEXT_PUBLIC_USE_SANDBOX=false` for production.

List active sessions:

```bash
curl https://api.liveavatar.com/v1/sessions/list \
  -H "x-api-key: YOUR_API_KEY"
```

---

## Upgrading to a custom AI brain (v2)

To replace HeyGen's built-in LLM with your own:

1. Switch from FULL mode to LITE mode in `lib/liveavatar.ts`
2. Subscribe to `user.transcription` for user speech
3. Send text to your own LLM (OpenAI, Anthropic, etc.)
4. Call `session.repeat(text)` or `session.message(text)` with the response
5. Keep the same session transport and UI layer
