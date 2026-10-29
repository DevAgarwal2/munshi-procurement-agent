"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileText,
  LoaderCircle,
  Mic,
  Shuffle,
  Square,
  TriangleAlert,
} from "lucide-react";
import type { ParsedBrief } from "@/lib/engine";
import { formatINR } from "@/lib/engine";
import { SCENARIOS, SCENARIO_ORDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/types";
import { Stamp } from "./ui";


function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

async function blobToWav(blob: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return blob;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), rate);
  } catch {
    return blob;
  } finally {
    void ctx.close();
  }
}

function Field({
  label,
  value,
  state = "ok",
}: {
  label: string;
  value: string;
  state?: "ok" | "missing" | "soft";
}) {
  return (
    <div className={`brief-field ${state === "missing" ? "is-missing" : ""}`}>
      <span className="brief-field-label">{label}</span>
      <span className="brief-field-value">
        {state === "ok" ? <Check size={13} strokeWidth={2.4} className="field-check" /> : null}
        {state === "missing" ? <TriangleAlert size={13} className="field-warn" /> : null}
        {value}
      </span>
    </div>
  );
}

export function BriefScreen({
  scenario,
  brief,
  parsed,
  matching,
  onBrief,
  onStart,
  onScenario,
  onExamples,
}: {
  scenario: Scenario;
  brief: string;
  parsed: ParsedBrief;
  matching: boolean;
  onBrief: (value: string) => void;
  onStart: () => void;
  onScenario: (id: string) => void;
  onExamples: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing" | "error">("idle");
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const canStart = useMemo(
    () => Boolean(parsed.quantity && parsed.product && parsed.budget && parsed.days && parsed.city),
    [parsed]
  );

  const specText = useMemo(() => {
    if (scenario.id !== "cafe") return scenario.specLabel;
    const bits = [
      parsed.sizeMl ? `${parsed.sizeMl} ml` : null,
      parsed.print ? "2-colour" : null,
      parsed.foodGrade ? "food-grade" : null,
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : scenario.specLabel;
  }, [parsed, scenario]);

  const budgetDecimals = scenario.budgetDefault < 10 ? 2 : 0;
  const promptIndex = scenario.prompts.findIndex((p) => p.text === brief);
  const activePrompt = promptIndex >= 0 ? scenario.prompts[promptIndex] : null;
  const nextPrompt = scenario.prompts[(promptIndex + 1) % scenario.prompts.length];

  useEffect(() => {
    if (!recording) return;
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= 30) void stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, recording]);

  useEffect(() => {
    return () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function stopRecording() {
    const active = recorder.current;
    if (!active) return;
    active.stop();
    setRecording(false);
    setVoiceState("transcribing");
    setVoiceNote("Sending the recording to Gnani Prisma v3.0…");
  }

  async function startRecording() {
    setVoiceNote(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceState("error");
      setVoiceNote("This browser does not expose a microphone. Type the brief instead.");
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        const raw = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const blob = await blobToWav(raw);
        const form = new FormData();
        form.append("audio", blob, blob.type === "audio/wav" ? "brief.wav" : "brief.webm");
        try {
          const res = await fetch("/api/stt", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Transcription failed.");
          if (!data.transcript) throw new Error("I could not hear a brief. Try again a little closer to the mic.");
          onBrief(data.transcript);
          setVoiceState("idle");
          setVoiceNote(
            `Transcribed with ${data.model}${data.language ? ` · ${data.language}` : ""}${
              data.duration ? ` · ${data.duration}s` : ""
            }`
          );
        } catch (error) {
          setVoiceState("error");
          setVoiceNote(error instanceof Error ? error.message : "Transcription failed.");
        }
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
      setVoiceState("recording");
    } catch {
      setVoiceState("error");
      setVoiceNote("Microphone permission was declined. Type the brief instead, or allow the mic and try again.");
    }
  }

  function toggleRecording() {
    if (recording) void stopRecording();
    else void startRecording();
  }

  return (
    <div className="brief-shell">
      <div className="industry-bar" role="tablist" aria-label="Demo industry">
        <span className="industry-bar-label">Industries</span>
        {SCENARIO_ORDER.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={scenario.id === id}
            className={`industry-tab ${scenario.id === id ? "is-active" : ""}`}
            onClick={() => onScenario(id)}
            title={SCENARIOS[id].industry}
          >
            {SCENARIOS[id].shortIndustry}
          </button>
        ))}
        <span className="industry-bar-note">4 buyers · 32 suppliers · 12 calls</span>
      </div>

      <div className="brief-grid">
        <section className="indent-file">
          <div className="file-head">
            <div className="file-head-left">
              <span className="file-id">INDENT / {scenario.buyer.indentId}</span>
              <span className="file-date">{scenario.buyer.date}</span>
            </div>
            <Stamp tone="red" rotate={-4} className="stamp-draft">
              Draft
            </Stamp>
          </div>

          <h1 className="brief-title">What do you need to buy?</h1>
          <p className="brief-lede">
            Finding a supplier is easy — finding the right one means ten calls, chased rates, and MOQ maths. Describe
            the purchase instead. Munshi screens the directory, calls the suppliers, and brings back one decision, with
            the evidence attached.
          </p>

          <div className="prompt-examples">
            <div className="prompt-examples-head">
              <span className="prompt-examples-label">Example briefs</span>
              <button className="text-btn" onClick={onExamples}>
                All examples <ArrowRight size={12} />
              </button>
            </div>
            <div className="prompt-chips">
              {scenario.prompts.map((prompt) => (
                <button
                  key={prompt.label}
                  className={`prompt-chip ${brief === prompt.text ? "is-active" : ""}`}
                  onClick={() => onBrief(prompt.text)}
                  title={prompt.text}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="composer">
            <div className="composer-top">
              <span className="composer-label">
                <FileText size={15} />
                Purchase brief
              </span>
              <button className="text-btn" onClick={() => onBrief(nextPrompt.text)} type="button">
                <Shuffle size={13} />
                Try another example
              </button>
            </div>
            <textarea
              className="composer-input"
              value={brief}
              onChange={(event) => onBrief(event.target.value)}
              rows={4}
              spellCheck
              placeholder={scenario.prompts[0].text}
              aria-label="Purchase brief"
            />
            <div className="composer-bottom">
              <button
                type="button"
                className={`mic-btn ${recording ? "is-recording" : ""}`}
                onClick={toggleRecording}
                disabled={voiceState === "transcribing"}
              >
                {recording ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}
                {recording
                  ? `Stop · 0:${String(seconds).padStart(2, "0")}`
                  : voiceState === "transcribing"
                    ? "Transcribing…"
                    : "Speak it"}
              </button>
              <span className="composer-hint">
                {voiceState === "recording"
                  ? "Speak in English, Hindi, or Gujarati. Prisma will detect the language."
                  : voiceState === "transcribing"
                    ? "Prisma v3.0 is listening back."
                    : "English · हिंदी · ગુજરાતી"}
              </span>
              <span className="composer-count">{brief.trim().length}</span>
            </div>
          </div>

          {voiceNote ? (
            <p className={`voice-note ${voiceState === "error" ? "is-error" : ""}`} role="status">
              {voiceState === "error" ? <TriangleAlert size={14} /> : <BadgeCheck size={14} />}
              {voiceNote}
            </p>
          ) : null}

          <div className="parsed-wrap">
            <div className="parsed-head">
              <span className="parsed-title">What Munshi heard</span>
              <span className="parsed-confidence">
                {activePrompt ? `${activePrompt.label} example` : "Custom brief"} ·{" "}
                {parsed.missing.length === 0 ? "5 of 5 fields" : `${5 - parsed.missing.length} of 5 fields`}
              </span>
            </div>
            <div className="parsed-grid" key={brief}>
              <Field label="Product" value={parsed.product ?? "Not yet"} state={parsed.product ? "ok" : "missing"} />
              <Field
                label="Quantity"
                value={parsed.quantity ? `${parsed.quantity.toLocaleString("en-IN")} ${scenario.unit}` : "Not yet"}
                state={parsed.quantity ? "ok" : "missing"}
              />
              <Field
                label="Target"
                value={`${formatINR(parsed.budget ?? scenario.budgetDefault, { decimals: budgetDecimals })} / ${scenario.unitShort}`}
                state={parsed.budget ? "ok" : "missing"}
              />
              <Field label="Delivery" value={parsed.days ? `${parsed.days} days` : "Not yet"} state={parsed.days ? "ok" : "missing"} />
              <Field label="City" value={parsed.city ?? scenario.buyer.city} state={parsed.city ? "ok" : "missing"} />
              <Field label="Spec" value={specText} state={parsed.product ? "ok" : "soft"} />
            </div>
          </div>

          <div className="brief-actions">
            <div className="brief-actions-note">
              <span className="dot dot-live" />
              <span>
                Munshi will screen <strong>{scenario.suppliers.length} suppliers</strong>, then call <strong>3</strong>.
              </span>
            </div>
            <button className="btn btn-primary btn-start" onClick={onStart} disabled={!canStart || matching}>
              {matching ? <LoaderCircle size={16} className="spin" /> : null}
              {matching ? "Matching suppliers…" : "Start sourcing"}
              {!matching ? <ArrowRight size={17} /> : null}
            </button>
          </div>
          {!canStart ? (
            <p className="brief-missing">Add {parsed.missing.join(", ")} so Munshi can run a comparable quote.</p>
          ) : null}
        </section>

        <aside className="brief-aside">
          <div className="how-it-works">
            <span className="how-label">How Munshi works</span>
            <ol>
              <li>
                <span>Match</span>
                <em>Munshi reads the brief and ranks the {scenario.suppliers.length}-supplier directory against it.</em>
              </li>
              <li>
                <span>Call</span>
                <em>Munshi phones the top 3 and asks for price, freight, GST, lead time, and terms.</em>
              </li>
              <li>
                <span>Normalise</span>
                <em>Every quote becomes a landed cost — not a sticker price.</em>
              </li>
              <li>
                <span>Decide</span>
                <em>Hard constraints filter; your priority ranks; one evidence-backed memo.</em>
              </li>
            </ol>
          </div>

          <div className="buyer-note">
            <Stamp tone="green" rotate={2}>
              Buyer control
            </Stamp>
            <p>
              Munshi recommends, negotiates, and prepares the order. <strong>You approve the supplier and the spend.</strong>
            </p>
            <span className="buyer-note-foot">No supplier is contacted after this run without your say.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
