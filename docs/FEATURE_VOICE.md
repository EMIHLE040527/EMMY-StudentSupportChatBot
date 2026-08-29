# FEATURE_VOICE.md — Read-Aloud (Text-to-Speech) for emmy Replies

> Feature spec for the voice/read-aloud feature. **Not started** as of 2026-07-23.
> When implementation begins, add the feature to the status matrix in CURRENT_STATE.md and log progress in DEVLOG.md.

---

## Goal

A student can tap a speaker button on any of emmy's replies and hear it read aloud. Framed as an **accessibility and study-support feature**: helps students who prefer listening, are visually impaired, or want to review answers while doing something else.

---

## Approach: two phases

Build Phase 1 first. Only build Phase 2 if the browser voice quality is not good enough for the demo.

| | Phase 1 — Browser speech | Phase 2 — OpenAI TTS (optional upgrade) |
|---|---|---|
| Technology | Built-in `window.speechSynthesis` API | `gpt-4o-mini-tts` via OpenAI API |
| Cost | **R0** | ~R0.25/min of audio; **R82 minimum top-up ($5)** covers all testing + demo |
| API key | None | `OPENAI_API_KEY` in `backend/.env` (server-side only, same pattern as `DEEPSEEK_API_KEY`) |
| Backend change | None | New `POST /api/tts` route (~30 lines) |
| Works offline | Yes (demo-safe) | No (needs internet at playback time) |
| Voice quality | Robotic on some machines; varies by OS/browser | Natural; ~13 voices; accepts a style instruction (e.g. warm, friendly advisor tone) |

**Budget line for the proposal: R100** (only spent if Phase 2 is needed). At ~R16.40/USD (July 2026): one read-aloud reply ≈ 16–25 cents, 100 test replies ≈ R25, the demo itself ≈ R5.

---

## UX spec (shared by both phases)

- A small **speaker icon button** on each emmy message bubble (emmy messages only, not the student's).
- Click → reads that message aloud. Icon switches to a **stop** state while speaking; click again to stop.
- Only **one message plays at a time**: starting a new playback stops the current one.
- A **new incoming emmy reply stops any current playback** (avoids overlapping speech).
- **Read on click only** for v1. No auto-read; an auto-read toggle can be a later enhancement.
- Strip Markdown/KaTeX markup before speaking so emmy doesn't read out asterisks or LaTeX source.
- Button styling follows FRONTEND_DESIGN.md (sleek-white emmy design). Any tooltip/label copy follows §4: no em-dashes. Suggested labels: "Read aloud" / "Stop reading".

---

## Phase 1 — Browser `speechSynthesis` (build this first)

Frontend only. Core of the click handler:

```js
window.speechSynthesis.cancel();            // stop anything already playing
const u = new SpeechSynthesisUtterance(plainText);
u.onend = () => setSpeakingId(null);        // reset button state
window.speechSynthesis.speak(u);
```

Implementation notes:

- Track `speakingId` (message id currently playing) in React state to drive the play/stop icon.
- `speechSynthesis.getVoices()` loads async in Chrome; pick a default English voice when available, else use the system default.
- Call `speechSynthesis.cancel()` on component unmount and when a new reply arrives.
- Feature-detect: hide the button if `!('speechSynthesis' in window)`.

Acceptance criteria:

1. Speaker button appears on every emmy message; clicking reads that message aloud.
2. Clicking while playing stops playback; starting another message stops the first.
3. A new emmy reply arriving stops playback.
4. Spoken text contains no Markdown symbols or LaTeX source.
5. Works with the backend/network completely off (chat history loaded, airplane mode).

---

## Phase 2 — OpenAI TTS upgrade (only if Phase 1 voice quality disappoints)

The frontend button and all UX logic carry over. Only the handler changes: instead of `speechSynthesis.speak`, fetch audio from the backend and play it.

Backend (`app.py`), mirroring the DeepSeek client setup:

```python
# POST /api/tts   body: { "text": "..." }
# -> calls OpenAI audio.speech (model="gpt-4o-mini-tts", voice e.g. "nova",
#    instructions="Speak warmly, like a friendly student advisor.")
# -> returns audio/mpeg bytes
```

Frontend:

```js
const res = await fetch(`${API}/api/tts`, { method: "POST", ... });
const url = URL.createObjectURL(await res.blob());
audioRef.current = new Audio(url);
audioRef.current.play();
```

Implementation notes:

- `OPENAI_API_KEY` lives in `backend/.env` and is **never sent to the frontend**.
- Cap request text length (e.g. 4 000 chars) to bound cost per call.
- Cache generated audio per message id in memory on the frontend so replaying a message is free.
- Return a clear JSON error if the key is missing (same pattern as the DeepSeek key check in `/chat`).

Additional acceptance criteria:

6. `/api/tts` returns playable MP3 for a typical emmy reply in under ~3 s.
7. Replaying an already-generated message makes no second API call.
8. Missing/invalid key produces a friendly error, not a crash.

---

## Demo-day risk plan

- **Phase 1 is the fallback.** Even if Phase 2 ships, keep the browser path behind a config flag so a dead network cannot kill the feature during the presentation.
- If demoing Phase 2, pre-generate audio for the scripted demo questions ahead of time as a backup.
- OpenAI bills in USD; card conversion adds ~2–3%, so the R82 top-up may land closer to R85–R90.

---

## Out of scope (for now)

- Auto-read of every reply (needs a settings toggle first).
- Voice **input** (speech-to-text). Separate feature; different API and cost.
- Per-user voice preference stored in the database.
