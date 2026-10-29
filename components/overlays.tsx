"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  MessageSquare,
  Phone,
  Send,
  Volume2,
  X,
} from "lucide-react";
import { formatINR, formatPerUnit } from "@/lib/engine";
import type { ChatAnswer, Levers, Offer, Scenario } from "@/lib/types";
import { BrandMark, Stamp } from "./ui";

const BASE_DATE = new Date("2026-10-29T09:00:00+05:30");

function deliveryDate(days: number) {
  const date = new Date(BASE_DATE);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function money(value: number) {
  return value >= 1000 ? formatINR(value) : formatPerUnit(value);
}

export function PoDrawer({
  open,
  scenario,
  offer,
  approved,
  onClose,
  onApprove,
  onViewOrder,
}: {
  open: boolean;
  scenario: Scenario;
  offer: Offer | null;
  approved: boolean;
  onClose: () => void;
  onApprove: () => void;
  onViewOrder: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setSending(false);
      setSent(approved);
    }
  }, [open, approved]);

  if (!open || !offer) return null;

  const advancePct = Number(offer.quote.payment.match(/(\d+)%/)?.[1] ?? 30) / 100;
  const advance = offer.total * advancePct;
  const balance = offer.total - advance;
  const plateLabel = offer.quote.oneTimeLabel ?? "One-time charge";
  const reorderLanded =
    offer.oneTimeCost > 0
      ? ((offer.subtotal - offer.oneTimeCost) * (1 + offer.quote.gstRate)) / offer.quote.quantity
      : null;

  async function approve() {
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    onApprove();
    setSending(false);
    setSent(true);
  }

  return (
    <div className="drawer-layer">
      <button className="drawer-scrim" onClick={onClose} aria-label="Close purchase order" />
      <aside className="drawer po-drawer" role="dialog" aria-modal="true" aria-labelledby="po-title">
        <header className="drawer-head">
          <div>
            <span className="block-label">{sent ? "Purchase order issued" : "Purchase order draft"}</span>
            <h2 id="po-title">{scenario.buyer.indentId} / PO</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close purchase order">
            <X size={18} />
          </button>
        </header>

        <div className="po-paper">
          <div className="po-top">
            <div className="po-brand">
              <BrandMark size={26} />
              <div>
                <strong>{scenario.buyer.workspace}</strong>
                <span>
                  {scenario.buyer.city} · Buyer workspace
                </span>
              </div>
            </div>
            <Stamp tone={sent ? "green" : "red"} rotate={sent ? 2 : -3}>
              {sent ? "Approved" : "Draft"}
            </Stamp>
          </div>

          <div className="po-meta">
            <div>
              <span>Supplier</span>
              <strong>{offer.supplier.name}</strong>
              <span>
                {offer.supplier.area}, {offer.supplier.city}
              </span>
              <span>GSTIN {offer.supplier.gstin}</span>
            </div>
            <div>
              <span>Deliver to</span>
              <strong>{scenario.buyer.workspace}</strong>
              <span>{scenario.buyer.city}</span>
              <span>Attn: {scenario.buyer.owner}</span>
            </div>
            <div>
              <span>Terms</span>
              <strong>{offer.quote.payment}</strong>
              <span>Quote valid {offer.quote.validityDays} days</span>
              <span>Delivery by {deliveryDate(offer.quote.leadDays)}</span>
            </div>
          </div>

          <table className="po-table">
            <thead>
              <tr>
                <th>Line</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{scenario.po.item}</strong>
                  <span>{scenario.po.spec} · HSN {scenario.po.hsn}</span>
                </td>
                <td className="num">{scenario.quantity.toLocaleString("en-IN")}</td>
                <td className="num">{money(offer.quote.base)}</td>
                <td className="num">{formatINR(offer.goodsCost)}</td>
              </tr>
              {offer.quote.print > 0 ? (
                <tr>
                  <td>
                    <strong>Printing</strong>
                    <span>{offer.quote.specDetail ?? "Per unit"}</span>
                  </td>
                  <td className="num">{scenario.quantity.toLocaleString("en-IN")}</td>
                  <td className="num">{money(offer.quote.print)}</td>
                  <td className="num">{formatINR(offer.printCost)}</td>
                </tr>
              ) : null}
              {offer.oneTimeCost > 0 ? (
                <tr>
                  <td>
                    <strong>{plateLabel}</strong>
                    <span>{offer.quote.oneTimeNote ?? "One-time"}</span>
                  </td>
                  <td className="num">1</td>
                  <td className="num">{formatINR(offer.oneTimeCost)}</td>
                  <td className="num">{formatINR(offer.oneTimeCost)}</td>
                </tr>
              ) : null}
              <tr>
                <td>
                  <strong>Freight</strong>
                  <span>
                    {offer.supplier.city} → {scenario.buyer.city}
                  </span>
                </td>
                <td className="num">1</td>
                <td className="num">{formatINR(offer.freightCost)}</td>
                <td className="num">{formatINR(offer.freightCost)}</td>
              </tr>
            </tbody>
          </table>

          <div className="po-totals">
            <div>
              <span>Subtotal</span>
              <strong>{formatINR(offer.subtotal)}</strong>
            </div>
            <div>
              <span>GST · {Math.round(offer.quote.gstRate * 100)}%</span>
              <strong>{formatINR(offer.gst)}</strong>
            </div>
            <div className="po-grand">
              <span>Total payable</span>
              <strong>{formatINR(offer.total)}</strong>
            </div>
            <div>
              <span>Advance · {Math.round(advancePct * 100)}%</span>
              <strong>{formatINR(advance)}</strong>
            </div>
            <div>
              <span>Balance on delivery</span>
              <strong>{formatINR(balance)}</strong>
            </div>
          </div>

          <div className="po-foot">
            <FileText size={14} />
            <span>
              Landed cost {money(offer.landed)} per {scenario.unitShort} · all taxes and freight included.
              {reorderLanded ? ` A repeat order without the ${plateLabel.toLowerCase()} lands at ${money(reorderLanded)}.` : ""}
            </span>
          </div>

          <div className="po-terms">
            <div>
              <span className="block-label">Terms</span>
              <p>
                Delivery by {deliveryDate(offer.quote.leadDays)}. {offer.quote.payment}. Goods must match the approved
                specification ({scenario.po.spec}) and carry the certificates verified in the call. Quote valid for{" "}
                {offer.quote.validityDays} days.
              </p>
            </div>
            <div className="po-sign">
              <div>
                <span>For {scenario.buyer.workspace}</span>
                <i />
                <em>Authorised signatory</em>
              </div>
              <div>
                <span>For {offer.supplier.name}</span>
                <i />
                <em>Authorised signatory</em>
              </div>
            </div>
            <span className="po-prepared">
              Prepared by Munshi · {scenario.buyer.date} · {scenario.buyer.indentId}
            </span>
          </div>

          {sent ? (
            <div className="po-sent">
              <Check size={16} />
              <div>
                <strong>PO {scenario.buyer.indentId}-01 approved.</strong>
                <span>
                  Demo send to {offer.supplier.shortName}. No payment was taken and no real order was placed.
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="drawer-foot">
          <p>
            This is a demo purchase order. No supplier is contacted and no money moves. The buyer&apos;s approval
            is recorded only in this demo workspace.
          </p>
          <div className="drawer-actions">
            <button className="btn btn-quiet" onClick={onClose}>
              {sent ? "Stay on decision" : "Cancel"}
            </button>
            {sent ? (
              <button className="btn btn-primary" onClick={onViewOrder}>
                View order status <ArrowRight size={15} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={approve} disabled={sending}>
                {sending ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
                {sending ? "Approving…" : "Approve & send PO"}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

type ChatMessage = {
  role: "user" | "agent";
  text: string;
  citations?: { label: string; lineId?: string }[];
  action?: "po" | "levers";
};

export function ChatDrawer({
  open,
  seed,
  scenario,
  levers,
  suggestions,
  onClose,
  onOpenPo,
  onSupplier,
}: {
  open: boolean;
  seed: string | null;
  scenario: Scenario;
  levers: Levers;
  suggestions: string[];
  onClose: () => void;
  onOpenPo: () => void;
  onSupplier: (id: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const lastSeed = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    setVoiceError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, levers, scenarioId: scenario.id }),
      });
      const data = (await res.json()) as ChatAnswer & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not answer that.");
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: data.text, citations: data.citations, action: data.action },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text:
            error instanceof Error
              ? `I hit a snag reading the sourcing file: ${error.message}`
              : "I hit a snag reading the sourcing file. Try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (seed && seed !== lastSeed.current) {
      lastSeed.current = seed;
      void ask(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  async function play(message: ChatMessage, index: number) {
    if (playing !== null) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    setVoiceError(null);
    setPlaying(index);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.text, voice: "Riyaa", language: "en-IN" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Voice playback failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Voice playback failed.");
      setPlaying(null);
    }
  }

  const showSuggestions = useMemo(() => messages.length === 0 && !loading, [messages.length, loading]);

  useEffect(() => {
    setMessages([]);
    setInput("");
    lastSeed.current = null;
  }, [scenario.id]);

  if (!open) return null;

  return (
    <div className="drawer-layer">
      <button className="drawer-scrim" onClick={onClose} aria-label="Close chat" />
      <aside className="drawer chat-drawer" role="dialog" aria-modal="true" aria-labelledby="chat-title">
        <header className="drawer-head chat-head">
          <div className="chat-agent">
            <span className="agent-seal">
              <BrandMark size={22} />
            </span>
            <div>
              <h2 id="chat-title">Ask Munshi</h2>
              <span>Grounded in this sourcing file · answers computed from the quotes</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close chat">
            <X size={18} />
          </button>
        </header>

        <div className="chat-context">
          <span className="tag">{scenario.buyer.indentId}</span>
          <span className="tag">
            {scenario.quantity.toLocaleString("en-IN")} {scenario.unit}
          </span>
          <span className="tag">3 quotes</span>
          <span className="chat-context-live">
            <span className="dot dot-live" /> live levers
          </span>
        </div>

        <div className="chat-body" ref={scrollRef} aria-live="polite">
          {messages.length === 0 && !loading ? (
            <div className="chat-intro">
              <Stamp tone="green" rotate={2}>
                Buyer side
              </Stamp>
              <h3>I&apos;ve read the calls. Ask me anything.</h3>
              <p>
                I can explain a trade-off, quote the supplier&apos;s own words, or draft the PO. I will not contact a
                supplier or move money without your approval.
              </p>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`chat-message ${message.role === "user" ? "is-user" : "is-agent"}`}
            >
              {message.role === "agent" ? (
                <span className="chat-avatar">
                  <BrandMark size={18} />
                </span>
              ) : null}
              <div className="chat-bubble">
                <p>{message.text}</p>
                {message.citations?.length ? (
                  <div className="citations">
                    {message.citations.map((citation) => (
                      <button
                        key={citation.label}
                        className="citation"
                        onClick={() => {
                          const id = citation.lineId?.split("-")[0];
                          if (id) onSupplier(id);
                        }}
                      >
                        <span className="citation-mark" />
                        {citation.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.action === "po" ? (
                  <button className="chat-action" onClick={onOpenPo}>
                    <FileText size={14} /> Open PO draft <ArrowRight size={13} />
                  </button>
                ) : null}
                {message.role === "agent" ? (
                  <div className="chat-message-foot">
                    <button
                      className="text-btn"
                      onClick={() => play(message, index)}
                      aria-label={playing === index ? "Stop voice answer" : "Play voice answer"}
                    >
                      {playing === index ? <LoaderCircle size={13} className="spin" /> : <Volume2 size={13} />}
                      {playing === index ? "Playing" : "Voice"}
                    </button>
                    <span>Gnani Timbre v3.0</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="chat-message is-agent">
              <span className="chat-avatar">
                <BrandMark size={18} />
              </span>
              <div className="chat-bubble typing-bubble">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}

          {voiceError ? <p className="chat-error">{voiceError}</p> : null}
        </div>

        {showSuggestions ? (
          <div className="chat-suggestions">
            {suggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => void ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="chat-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(input);
          }}
        >
          <MessageSquare size={16} className="chat-input-icon" />
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about the trade-off, risk, or PO…"
            aria-label="Ask Munshi a question"
          />
          <button className="chat-send" type="submit" disabled={!input.trim() || loading} aria-label="Send question">
            <Send size={15} />
          </button>
        </form>
        <p className="chat-foot">
          <Phone size={12} /> Answers are generated from the demo sourcing file.
        </p>
      </aside>
    </div>
  );
}
