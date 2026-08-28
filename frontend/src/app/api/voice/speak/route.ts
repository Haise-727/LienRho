// Text to speech (#29, #3).
//
// The key stays server-side. An ElevenLabs key in the browser is a key anyone
// can lift from the network tab and spend, so the browser posts text here and
// gets audio back — it never sees a credential.
//
// Returns audio/mpeg on success. When no key is configured it returns 503 with
// a machine-readable reason rather than silence, so the UI can say "voice is
// not configured" instead of appearing broken.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { forSpeech } from "@/lib/voice/script";

export const dynamic = "force-dynamic";
// Node runtime, not edge: the SDK streams and needs Buffer.
export const runtime = "nodejs";

/**
 * Matilda — professional register, and importantly a *premade* voice.
 *
 * Not Rachel (21m00Tcm4TlvDq8ikWAM), which is the obvious default and fails on
 * a free account with 402 `paid_plan_required`: "free users cannot use library
 * voices via the API". Premade voices attached to the account work; library
 * voices need a paid plan. Verified against this project's key.
 */
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "XrExE9yKIg1WjnnlVkGX";

/**
 * Flash rather than multilingual: this is short, English, and read aloud while
 * someone waits. Latency is the quality that matters here, not expressiveness.
 */
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

/** A spoken paragraph, not an essay. Also a spend guard — text is billed by character. */
const MAX_CHARS = 1200;

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "voice_not_configured",
        message:
          "ELEVENLABS_API_KEY is not set. Add it to frontend/.env — see .env.example.",
      },
      { status: 503 },
    );
  }

  let text: string;
  let voiceId: string;
  try {
    const body = await request.json();
    text = String(body?.text ?? "").trim();
    voiceId = String(body?.voiceId ?? DEFAULT_VOICE_ID);
  } catch {
    return Response.json({ error: "bad_request", message: "Body must be JSON." }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: "bad_request", message: "`text` is required." }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return Response.json(
      { error: "too_long", message: `text exceeds ${MAX_CHARS} characters.` },
      { status: 413 },
    );
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const stream = await client.textToSpeech.convert(voiceId, {
      // Normalise here rather than at each caller, so text written elsewhere
      // — gate reasons from the clearing engine, for instance — is also safe.
      text: forSpeech(text),
      modelId: MODEL_ID,
      outputFormat: "mp3_44100_128",
    });

    // Buffer rather than pass the stream straight through: these clips are a
    // few seconds, and a complete body lets the browser seek and replay
    // without a second request.
    //
    // Read via getReader() rather than `for await`: the SDK hands back a web
    // ReadableStream, which is not async-iterable under TypeScript's DOM lib
    // even though Node's runtime supports it.
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const audio = Buffer.concat(chunks);

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        // Same text, same audio — and it is billed per character, so do not
        // re-synthesise on a replay.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    // Surface ElevenLabs' own message: "quota exceeded" and "voice not found"
    // need different fixes, and collapsing them into "failed" hides which.
    const message = e instanceof Error ? e.message : "Speech synthesis failed";
    return Response.json({ error: "tts_failed", message }, { status: 502 });
  }
}
