import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const root = process.cwd();
const env = await readFile(path.join(root, ".env"), "utf8");
const key = env.match(/^\s*(?:gnani_api_key|GNANI_API_KEY)\s*=\s*(.+)\s*$/m)?.[1]?.trim();
if (!key) throw new Error("Missing gnani_api_key in .env");

const calls = JSON.parse(await readFile(path.join(root, "lib/calls.json"), "utf8"));
const outDir = path.join(root, "public/audio");
await mkdir(outDir, { recursive: true });

const manifestPath = path.join(root, "lib/audio-manifest.json");
let manifest = {};
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function duration(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    file,
  ]);
  return Number(stdout.trim());
}

async function synthesize(line, voice, attempt = 1) {
  const res = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key-ID": key,
    },
    body: JSON.stringify({
      text: line.original,
      voice,
      model: "timbre-v3.0",
      language: line.lang,
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

  if (res.status === 429 && attempt <= 8) {
    const wait = 1500 * attempt;
    console.log(`  rate limited, retrying in ${wait}ms`);
    await sleep(wait);
    return synthesize(line, voice, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${line.id}: ${res.status} ${body.slice(0, 240)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error(`${line.id}: suspiciously small audio (${buf.length} bytes)`);
  return buf;
}

for (const call of Object.values(calls)) {
  for (const line of call.lines) {
    const file = path.join(outDir, `${line.id}.mp3`);
    if (await exists(file)) {
      const d = await duration(file);
      manifest[line.id] = { path: `/audio/${line.id}.mp3`, duration: Number(d.toFixed(2)) };
      console.log(`skip ${line.id} (${d.toFixed(2)}s)`);
      continue;
    }
    const voice = line.speaker === "agent" ? call.agentVoice : call.supplierVoice;
    process.stdout.write(`synth ${line.id} [${voice} / ${line.lang}] ... `);
    const audio = await synthesize(line, voice);
    await writeFile(file, audio);
    const d = await duration(file);
    manifest[line.id] = { path: `/audio/${line.id}.mp3`, duration: Number(d.toFixed(2)) };
    console.log(`${d.toFixed(2)}s`);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await sleep(650);
  }
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nDone. ${Object.keys(manifest).length} clips.`);
