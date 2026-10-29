import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { enqueueGnani } from "@/lib/gnani-queue";

export const runtime = "nodejs";

const GNANI_URL = "https://api.vachana.ai/api/v1/tts/inference";
const cache = new Map<string, Buffer>();

function key() {
  return process.env.gnani_api_key || process.env.GNANI_API_KEY || "";
}

async function synthesize(text: string, voice: string, language: string) {
  const hash = createHash("sha256").update(`${text}|${voice}|${language}`).digest("hex");
  const cached = cache.get(hash);
  if (cached) return cached;

  const res = await enqueueGnani(async () => {
    let last: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      last = await fetch(GNANI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key-ID": key(),
        },
        body: JSON.stringify({
          text,
          voice,
          model: "timbre-v3.0",
          language,
          speed: 1.0,
          audio_config: {
            sample_rate: 24000,
            num_channels: 1,
            sample_width: 2,
            encoding: "linear_pcm",
            container: "mp3",
            bitrate: "96k",
          },
        }),
      });
      if (last.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
    if (!last || !last.ok) {
      const body = last ? await last.text() : "No response";
      throw new Error(`Gnani TTS ${last?.status ?? 500}: ${body.slice(0, 300)}`);
    }
    return Buffer.from(await last.arrayBuffer());
  });

  cache.set(hash, res);
  if (cache.size > 40) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return res;
}

export async function POST(req: NextRequest) {
  if (!key()) {
    return NextResponse.json({ error: "Gnani API key is not configured." }, { status: 500 });
  }

  let body: { text?: string; voice?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400 });
  if (text.length > 900) {
    return NextResponse.json({ error: "Keep the spoken answer under 900 characters." }, { status: 400 });
  }

  const voice = body.voice || "Riyaa";
  const language = body.language || "en-IN";

  try {
    const audio = await synthesize(text, voice, language);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
