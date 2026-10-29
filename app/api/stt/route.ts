import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { enqueueGnani } from "@/lib/gnani-queue";

export const runtime = "nodejs";

const run = promisify(execFile);
const GNANI_STT = "https://api.vachana.ai/stt/v3";

function key() {
  return process.env.gnani_api_key || process.env.GNANI_API_KEY || "";
}

export async function POST(req: NextRequest) {
  if (!key()) {
    return NextResponse.json({ error: "Gnani API key is not configured." }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No audio file received." }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Recording is too large. Keep it under 30 seconds." }, { status: 413 });
  }

  const dir = await mkdtemp(path.join(tmpdir(), "munshi-stt-"));
  const input = path.join(dir, "input");
  const output = path.join(dir, "output.wav");

  try {
    await writeFile(input, Buffer.from(await file.arrayBuffer()));
    await run("ffmpeg", [
      "-y",
      "-i", input,
      "-ar", "16000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      output,
    ]);

    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      output,
    ]);
    const duration = Number(stdout.trim());
    if (!Number.isFinite(duration) || duration > 30.5) {
      return NextResponse.json(
        { error: "That recording is longer than 30 seconds. Please speak the brief again." },
        { status: 413 }
      );
    }

    const audio = await readFile(output);
    const { res, body } = await enqueueGnani(async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const upstream = new FormData();
        upstream.append("audio_file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "brief.wav");
        upstream.append("model", "prisma-v3.0");
        upstream.append("language_code", "indic-auto");
        upstream.append("format", "transcribe");

        const response = await fetch(GNANI_STT, {
          method: "POST",
          headers: { "X-API-Key-ID": key() },
          body: upstream,
        });
        const payload = await response.json().catch(() => null);
        if (response.status !== 429) return { res: response, body: payload };
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      }
      throw new Error("Gnani Prisma is busy. Try again in a moment.");
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: body?.detail?.message || body?.message || "Gnani Prisma could not transcribe that." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      transcript: body?.transcript ?? "",
      language: body?.detected_language_code ?? null,
      model: body?.model ?? "prisma-v3.0",
      duration: Number(duration.toFixed(2)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json(
      { error: `Could not process the recording. ${message.slice(0, 160)}` },
      { status: 500 }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
