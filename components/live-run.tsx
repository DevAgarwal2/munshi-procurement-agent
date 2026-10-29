"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Sparkle,
  Check,
  ChevronRight,
  CircleStop,
  FastForward,
  LoaderCircle,
  Pause,
  Phone,
  Volume2,
  VolumeX,
} from "lucide-react";
import manifest from "@/lib/audio-manifest.json";
import { CALLS } from "@/lib/scenarios";
import { formatINR, formatPerUnit, pct, supplierById } from "@/lib/engine";
import type { CallLine, CaptureKey, Lang, Levers, MatchResult, Offer, Recommendation, Scenario } from "@/lib/types";
import { SupplierMark, StatusDot } from "./ui";

const audioMeta = manifest as Record<string, { path: string; duration: number }>;
const SPEEDS = [1, 1.25, 1.5] as const;

const CAPTURE_LABELS: Record<CaptureKey, string> = {
  base: "Base price",
  print: "Printing",
  plate: "One-time charge",
  freight: "Freight",
  gst: "GST",
  moq: "MOQ",
  lead: "Lead time",
  payment: "Payment",
  validity: "Quote validity",
  docs: "Documents",
  certs: "Certifications",
};

function priceLabel(value: number) {
  return value >= 100 ? formatINR(value) : formatPerUnit(value);
}

function languageName(lang: Lang) {
  return lang === "hi-IN"
    ? "Hindi"
    : lang === "gu-IN"
      ? "Gujarati"
      : lang === "mr-IN"
        ? "Marathi"
        : lang === "pa-IN"
          ? "Punjabi"
          : "English";
}

function originalLabel(lang: Lang) {
  return lang === "hi-IN"
    ? "हिंदी"
    : lang === "gu-IN"
      ? "ગુજરાતી"
      : lang === "mr-IN"
        ? "मराठी"
        : lang === "pa-IN"
          ? "ਪੰਜਾਬੀ"
          : "English";
}

function scriptClass(lang: Lang) {
  return lang === "gu-IN" ? "script-gu" : lang === "pa-IN" ? "script-pa" : lang === "en-IN" ? "" : "script-hi";
}

function estimateDuration(line: CallLine) {
  return audioMeta[line.id]?.duration ?? Math.max(2.2, line.display.split(" ").length / 2.5);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function Waveform({ active }: { active: boolean }) {
  const bars = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => {
        const base = 7 + Math.abs(Math.sin(i * 0.62)) * 19 + Math.abs(Math.cos(i * 0.23)) * 8;
        return Math.round(base);
      }),
    []
  );
  return (
    <div className={`waveform ${active ? "is-active" : ""}`} aria-hidden>
      {bars.map((height, i) => (
        <span key={i} className="wave-bar" style={{ height: `${height}px`, animationDelay: `${(i % 8) * 55}ms` }} />
      ))}
    </div>
  );
}

function captureValue(key: CaptureKey, offer: Offer | undefined, visibleCount: number, scenario: Scenario): string {
  if (!offer) return "—";
  const quote = offer.quote;
  switch (key) {
    case "base":
      return `${priceLabel(quote.base)} / ${scenario.unitShort}`;
    case "print":
      if (!quote.print && !quote.printIncluded) return "Not applicable";
      return quote.printIncluded ? "Claimed included" : `${priceLabel(quote.print)} / ${scenario.unitShort}`;
    case "plate":
      if (!quote.plate) return "None";
      return quote.negotiation
        ? visibleCount >= 4
          ? `${priceLabel(quote.negotiation.from)} → ${priceLabel(quote.negotiation.to)}`
          : `${priceLabel(quote.negotiation.from)}`
        : formatINR(quote.plate);
    case "freight":
      return formatINR(quote.freight);
    case "gst":
      return pct(quote.gstRate);
    case "moq":
      return quote.moqNote
        ? `${quote.effectiveMoq.toLocaleString("en-IN")} ${scenario.unit} (accepted)`
        : `${quote.moq.toLocaleString("en-IN")} ${scenario.unit}`;
    case "lead":
      return `${quote.leadDays} days`;
    case "payment":
      return quote.payment;
    case "validity":
      return `${quote.validityDays} days`;
    case "docs":
      return offer.supplier.certifications.slice(0, 2).join(" + ") || "Shared on call";
    case "certs":
      return quote.specDetail ?? scenario.specLabel;
  }
}

export function LiveRun({
  scenario,
  offers,
  recommendation,
  levers,
  match,
  onDone,
  onSupplier,
}: {
  scenario: Scenario;
  offers: Offer[];
  recommendation: Recommendation;
  levers: Levers;
  match: MatchResult | null;
  onDone: () => void;
  onSupplier: (id: string) => void;
}) {
  const [callIndex, setCallIndex] = useState(0);
  const [status, setStatus] = useState<"dialing" | "live" | "between" | "complete">("dialing");
  const [visibleByCall, setVisibleByCall] = useState<Record<string, number>>({});
  const [capturedByCall, setCapturedByCall] = useState<Record<string, CaptureKey[]>>({});
  const [revealed, setRevealed] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [showOriginal, setShowOriginal] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1.25);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const audioOnRef = useRef(audioOn);
  const speedRef = useRef<number>(speed);
  const onDoneRef = useRef(onDone);
  const cleanupRef = useRef<(() => void) | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const transcriptEl = useRef<HTMLDivElement | null>(null);

  const callOrder = scenario.callOrder;

  useEffect(() => {
    audioOnRef.current = audioOn;
  }, [audioOn]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const call = CALLS[callOrder[Math.min(callIndex, callOrder.length - 1)]];
  const callSupplier = supplierById(scenario, call.supplierId);
  const supplierOffer = offers.find((o) => o.supplier.id === call.supplierId);
  const visible = visibleByCall[call.id] ?? 0;
  const captured = capturedByCall[call.id] ?? [];
  const lines = call.lines.slice(0, visible);
  const captureKeys = (Object.keys(CAPTURE_LABELS) as CaptureKey[]).filter((key) => {
    if (key === "print") return Boolean(supplierOffer?.quote.print || supplierOffer?.quote.printIncluded);
    if (key === "plate") return Boolean(supplierOffer?.quote.plate);
    return true;
  });
  const capturedCount = captured.filter((key) => captureKeys.includes(key)).length;

  const capture = (keys: CaptureKey[]) => {
    if (!keys.length) return;
    setCapturedByCall((prev) => {
      const current = prev[call.id] ?? [];
      const next = Array.from(new Set([...current, ...keys]));
      return { ...prev, [call.id]: next };
    });
  };

  useEffect(() => {
    if (status === "complete") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [callIndex, status]);

  useEffect(() => {
    let cancelled = false;
    const currentCall = CALLS[callOrder[callIndex]];
    if (!currentCall) return;

    setStatus("dialing");
    setVisibleByCall((prev) => ({ ...prev, [currentCall.id]: 0 }));
    setCapturedByCall((prev) => ({ ...prev, [currentCall.id]: [] }));

    const start = setTimeout(async () => {
      if (cancelled) return;
      setStatus("live");

      for (let i = 0; i < currentCall.lines.length; i++) {
        if (cancelled) return;
        const line = currentCall.lines[i];
        setVisibleByCall((prev) => ({ ...prev, [currentCall.id]: i + 1 }));

        const duration = estimateDuration(line) / speedRef.current;
        const capTimer = window.setTimeout(() => capture(line.captures), Math.max(450, duration * 550));
        await new Promise<void>((resolve) => {
          if (!audioOnRef.current) {
            const timer = setTimeout(resolve, duration * 1000);
            cleanupRef.current = () => {
              clearTimeout(timer);
              resolve();
            };
            return;
          }
          const audio = new Audio(audioMeta[line.id]?.path ?? `/audio/${line.id}.mp3`);
          audio.playbackRate = speedRef.current;
          audio.preservesPitch = true;
          audioEl.current = audio;
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          audio.onended = finish;
          audio.onerror = () => {
            setAudioBlocked(true);
            setTimeout(finish, duration * 1000);
          };
          const fallback = setTimeout(finish, duration * 1000 + 2500);
          audio
            .play()
            .then(() => setAudioBlocked(false))
            .catch(() => {
              setAudioBlocked(true);
              setTimeout(finish, duration * 1000);
            });
          cleanupRef.current = () => {
            clearTimeout(fallback);
            audio.pause();
            audio.src = "";
            finish();
          };
        });

        window.clearTimeout(capTimer);
        if (cancelled) return;
        capture(line.captures);
        await wait(380 / speedRef.current);
      }

      if (cancelled) return;
      setStatus("between");
      setRevealed((prev) => (prev.includes(currentCall.supplierId) ? prev : [...prev, currentCall.supplierId]));

      if (callIndex >= callOrder.length - 1) {
        await wait(900 / speedRef.current);
        if (cancelled) return;
        setStatus("complete");
        onDoneRef.current();
        return;
      }

      await wait(1200 / speedRef.current);
      if (cancelled) return;
      setCallIndex((index) => index + 1);
    }, 1300);

    return () => {
      cancelled = true;
      clearTimeout(start);
      cleanupRef.current?.();
      cleanupRef.current = null;
      audioEl.current?.pause();
      audioEl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callIndex]);

  useEffect(() => {
    const el = transcriptEl.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible]);

  const skipCall = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (callIndex >= callOrder.length - 1) {
      setStatus("complete");
      onDone();
    } else {
      setRevealed((prev) => (prev.includes(call.supplierId) ? prev : [...prev, call.supplierId]));
      setCallIndex((index) => index + 1);
    }
  };

  const skipToDecision = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    audioEl.current?.pause();
    setStatus("complete");
    onDone();
  };

  const phoneLabel = `Call ${Math.min(callIndex + 1, callOrder.length)} of ${callOrder.length}`;
  const activeSpeaker = visible > 0 ? call.lines[visible - 1].speaker : null;

  const revealedOffers = offers.filter((o) => revealed.includes(o.supplier.id));
  const provisional = [...revealedOffers].sort((a, b) => b.score - a.score);

  const budgetShown = levers.budget ? levers.budgetCap : levers.budgetBase * 1.18;
  const deadlineShown = levers.delivery ? levers.deadline : levers.deadlineBase + 3;

  return (
    <div className="run-shell">
      <div className="run-band">
        <div className="run-band-left">
          <span className="run-band-kicker">
            <StatusDot tone={status === "complete" ? "done" : "live"} />
            {status === "complete" ? "Run complete" : status === "between" ? "Quote captured" : "Munshi is on the call"}
          </span>
          <strong>
            {status === "complete"
              ? "Decision ready"
              : status === "between"
                ? `${callSupplier.shortName} quote is in. Next call in a moment.`
                : `${callSupplier.name} · ${phoneLabel}`}
          </strong>
        </div>
        <div className="run-band-right">
          <span className="sim-pill">Gnani Timbre v3.0 voices</span>
          <button className="text-btn" onClick={skipToDecision}>
            <FastForward size={14} />
            Skip to decision
          </button>
        </div>
      </div>

      <div className="run-strip" aria-label="Run progress">
        <div className="strip-step is-done" style={{ ["--fill" as string]: 1 }}>
          <span className="strip-node" />
          <span className="strip-title">Brief</span>
          <span className="strip-detail">5 fields parsed</span>
        </div>
        <div className="strip-step is-done" style={{ ["--fill" as string]: 1 }}>
          <span className="strip-node" />
          <span className="strip-title">Match</span>
          <span className="strip-detail">
            {match ? `Matched ${scenario.suppliers.length} → 3` : `Matching ${scenario.suppliers.length} → 3`}
          </span>
        </div>
        <div
          className={`strip-step ${status === "complete" ? "is-done" : "is-active"}`}
          style={{
            ["--fill" as string]:
              status === "complete" ? 1 : Math.min(1, (callIndex + visible / call.lines.length) / callOrder.length),
          }}
        >
          <span className="strip-node" />
          <span className="strip-title">Calls</span>
          <span className="strip-detail">{revealed.length} of 3 quotes in</span>
        </div>
        <div className={`strip-step ${status === "complete" ? "is-done" : ""}`} style={{ ["--fill" as string]: 0 }}>
          <span className="strip-node" />
          <span className="strip-title">Decision</span>
          <span className="strip-detail">Evidence-backed memo</span>
        </div>
      </div>

      <div className="run-grid">
        <section className="call-stage">
          <div className="call-card">
            <div className="call-head">
              <div className="call-who">
                <SupplierMark supplier={callSupplier} size={42} />
                <div>
                  <div className="call-name-line">
                    <strong>{callSupplier.name}</strong>
                  </div>
                  <span className="call-meta">
                    {callSupplier.area}, {callSupplier.city} · {callSupplier.category} · {callSupplier.orders} orders
                  </span>
                </div>
              </div>
              <div className="call-controls">
                <span className="call-timer">
                  <Phone size={13} />
                  00:{String(elapsed).padStart(2, "0")}
                </span>
                <button
                  className="icon-btn call-icon"
                  onClick={() => setAudioOn((on) => !on)}
                  aria-label={audioOn ? "Mute call audio" : "Unmute call audio"}
                  title={audioOn ? "Mute call audio" : "Unmute call audio"}
                >
                  {audioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  className="speed-btn"
                  onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
                  aria-label="Change playback speed"
                >
                  {speed}×
                </button>
                <button className="icon-btn call-icon" onClick={skipCall} aria-label="Skip this call" title="Skip this call">
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className={`call-wave ${activeSpeaker === "supplier" ? "is-supplier" : "is-agent"}`}>
              <Waveform active={status === "live" && Boolean(activeSpeaker)} />
              <div className="call-wave-meta">
                <span>
                  {status === "dialing"
                    ? "Dialling…"
                    : status === "between"
                      ? "Call ended"
                      : activeSpeaker === "supplier"
                        ? "Supplier speaking"
                        : "Munshi speaking"}
                </span>
                <span>{languageName(call.language)} · Timbre v3.0</span>
              </div>
            </div>

            {audioBlocked ? (
              <button className="audio-blocked" onClick={() => setAudioOn(true)}>
                <VolumeX size={14} /> Browser blocked autoplay. Tap to allow the Gnani voice.
              </button>
            ) : null}

            <div className="transcript-head">
              <span className="transcript-title">Call transcript</span>
              <button className="text-btn" onClick={() => setShowOriginal((v) => !v)}>
                {showOriginal ? "Show English" : `Show original · ${originalLabel(call.language)}`}
              </button>
            </div>

            <div className="transcript" ref={transcriptEl}>
              {visible === 0 ? (
                <div className="transcript-wait">
                  <LoaderCircle size={17} className="spin" />
                  <span>{status === "dialing" ? `Dialling ${callSupplier.shortName}…` : "Connecting…"}</span>
                </div>
              ) : null}
              {lines.map((line) => {
                const isAgent = line.speaker === "agent";
                return (
                  <div className={`tline ${isAgent ? "is-agent" : "is-supplier"}`} key={line.id}>
                    <div className="tline-side">
                      <span className="tline-speaker">{isAgent ? "MUNSHI" : callSupplier.shortName.toUpperCase()}</span>
                      <span className="tline-time">{line.at}</span>
                    </div>
                    <div className="tline-body">
                      <p className={`tline-text ${showOriginal ? scriptClass(line.lang) : ""}`}>
                        {showOriginal ? line.original : line.display}
                      </p>
                      {line.negotiation ? (
                        <div className="tline-negotiation">
                          <Sparkle size={11} /> Negotiation
                        </div>
                      ) : null}
                      {line.captures.length > 0 ? (
                        <div className="tline-captured">
                          <Check size={12} />
                          {line.captures
                            .map((c) => (c === "plate" ? supplierOffer?.quote.oneTimeLabel ?? "one-time charge" : CAPTURE_LABELS[c]))
                            .join(" · ")}{" "}
                          captured
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {status === "live" && visible > 0 && visible < call.lines.length ? (
                <div className="typing">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </div>

            <div className="call-foot">
              <span>
                <Pause size={13} /> Voice is real Gnani Timbre v3.0 output.
              </span>
              <span className="call-foot-right">
                <button className="text-btn" onClick={skipCall}>
                  <CircleStop size={13} /> End call
                </button>
              </span>
            </div>
          </div>

          {status === "between" || status === "complete" ? (
            <div className="call-summary reveal">
              <div className="call-summary-top">
                <div>
                  <span className="summary-kicker">{status === "complete" ? "Quote captured" : "Call summary"}</span>
                  <strong>{callSupplier.name}</strong>
                </div>
                <div className="summary-price">
                  <span>Landed</span>
                  <strong>{supplierOffer ? priceLabel(supplierOffer.landed) : "—"}</strong>
                  <em>/{scenario.unitShort}</em>
                </div>
              </div>
              <div className="summary-checks">
                {supplierOffer?.constraints.filter((c) => c.hard).map((c) => (
                  <span key={c.key} className={`check-chip ${c.pass ? "is-pass" : "is-fail"}`}>
                    {c.pass ? <Check size={12} /> : <CircleStop size={12} />}
                    {c.label}
                  </span>
                ))}
              </div>
              {supplierOffer?.quote.negotiation ? (
                <p className="summary-note">
                  Negotiated: {supplierOffer.quote.negotiation.label}{" "}
                  {priceLabel(supplierOffer.quote.negotiation.from)} →{" "}
                  {priceLabel(supplierOffer.quote.negotiation.to)}. Saved{" "}
                  {formatINR(supplierOffer.quote.negotiation.saved)} after tax.
                </p>
              ) : null}
              <button className="btn btn-quiet btn-small summary-btn" onClick={() => onSupplier(call.supplierId)}>
                Open supplier file <ArrowRight size={14} />
              </button>
            </div>
          ) : null}

          <div className="holding-brief">
            <span className="holding-label">Holding the brief</span>
            <div className="holding-items">
              <span><Check size={12} /> Budget ≤ {priceLabel(budgetShown)}/{scenario.unitShort}</span>
              <span><Check size={12} /> Delivery ≤ {deadlineShown} days</span>
              <span><Check size={12} /> MOQ ≤ {scenario.quantity.toLocaleString("en-IN")} {scenario.unit}</span>
              <span><Check size={12} /> {scenario.specLabel}</span>
            </div>
          </div>
        </section>

        <aside className="capture-col">
          <div className="capture-panel">
            <div className="capture-head">
              <span>Live capture</span>
              <span className="file-count">{capturedCount} / {captureKeys.length}</span>
            </div>
            <div className="capture-list">
              {captureKeys.map((key) => {
                const isCaptured = captured.includes(key);
                return (
                  <div key={key} className={`capture-row ${isCaptured ? "is-captured" : ""}`}>
                    <span className="capture-label">
                      {key === "plate" ? supplierOffer?.quote.oneTimeLabel ?? "One-time charge" : CAPTURE_LABELS[key]}
                    </span>
                    <span className="capture-value">
                      {isCaptured ? captureValue(key, supplierOffer, visible, scenario) : "Awaiting"}
                    </span>
                    <span className="capture-tick">{isCaptured ? <Check size={12} /> : null}</span>
                  </div>
                );
              })}
            </div>
            {call.language !== "en-IN" ? (
              <p className="capture-note">
                Spoken in {languageName(call.language)}; normalised to English for comparison.
              </p>
            ) : null}
          </div>

          <div className="provisional">
            <div className="provisional-head">
              <span>Provisional shortlist</span>
              <span className="file-count">{provisional.length} / 3</span>
            </div>
            {provisional.length === 0 ? (
              <div className="provisional-empty">
                <LoaderCircle size={16} className="spin" />
                <span>Waiting for the first quote.</span>
              </div>
            ) : (
              provisional.map((offer) => (
                <button
                  key={offer.supplier.id}
                  className={`provisional-row ${
                    offer.supplier.id === recommendation.recommended?.supplier.id && status === "complete" ? "is-lead" : ""
                  }`}
                  onClick={() => onSupplier(offer.supplier.id)}
                >
                  <span className="provisional-rank">{String(provisional.indexOf(offer) + 1).padStart(2, "0")}</span>
                  <span className="provisional-copy">
                    <strong>{offer.supplier.shortName}</strong>
                    <span>
                      {priceLabel(offer.landed)} · {offer.quote.leadDays} days
                    </span>
                  </span>
                  <span className={`mini-state ${offer.feasible ? "is-pass" : "is-fail"}`}>
                    {offer.feasible ? "Feasible" : `${offer.hardFails} fail`}
                  </span>
                </button>
              ))
            )}
            {status === "complete" ? (
              <button className="btn btn-primary provisional-cta" onClick={onDone}>
                Open decision <ArrowRight size={15} />
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
