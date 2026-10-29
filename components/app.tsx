"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, type View } from "./app-shell";
import { BriefScreen } from "./brief-screen";
import { DecisionBoard } from "./decision-board";
import { ExamplesView } from "./examples-view";
import { HistoryView } from "./history-view";
import { LiveRun } from "./live-run";
import { OrderConfirmation } from "./order-confirmation";
import { ChatDrawer, PoDrawer } from "./overlays";
import { SuppliersView } from "./suppliers-view";
import { defaultLevers, evaluateOffers, parseBrief, recommend } from "@/lib/engine";
import { DEFAULT_SCENARIO, scenarioById } from "@/lib/scenarios";
import type { Levers, MatchResult } from "@/lib/types";

type Phase = "brief" | "running" | "decision" | "confirmed";

export function App() {
  const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIO);
  const scenario = scenarioById(scenarioId);

  const [view, setView] = useState<View>("sourcing");
  const [phase, setPhase] = useState<Phase>("brief");
  const [brief, setBrief] = useState(scenario.prompts[0].text);
  const [levers, setLevers] = useState<Levers>(() => defaultLevers(scenario));
  const [matching, setMatching] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [order, setOrder] = useState<{ offer: import("@/lib/types").Offer; poNumber: string } | null>(null);

  const parsed = useMemo(() => parseBrief(brief), [brief]);
  const offers = useMemo(() => evaluateOffers(scenario, levers), [scenario, levers]);
  const recommendation = useMemo(() => recommend(offers, levers, scenario), [offers, levers, scenario]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [view, phase, scenarioId]);

  function switchScenario(id: string) {
    const next = scenarioById(id);
    setScenarioId(next.id);
    setView("sourcing");
    setPhase("brief");
    setBrief(next.prompts[0].text);
    setLevers(defaultLevers(next));
    setMatch(null);
    setApproved(false);
    setOrder(null);
    setSupplierId(null);
    setChatOpen(false);
  }

  async function startRun() {
    const baseBudget = parsed.budget ?? scenario.budgetDefault;
    const baseDeadline = parsed.days ?? scenario.daysDefault;
    setLevers({
      ...defaultLevers(scenario),
      budgetCap: baseBudget,
      deadline: baseDeadline,
      budgetBase: baseBudget,
      deadlineBase: baseDeadline,
    });
    setMatching(true);
    setMatch(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id, brief }),
      });
      const data = (await res.json()) as MatchResult & { error?: string };
      if (res.ok && data.shortlist) setMatch(data);
    } catch {
      setMatch(null);
    }
    setMatching(false);
    setApproved(false);
    setOrder(null);
    setPhase("running");
  }

  function loadExample(id: string, prompt: string) {
    const next = scenarioById(id);
    setScenarioId(next.id);
    setView("sourcing");
    setPhase("brief");
    setBrief(prompt);
    setLevers(defaultLevers(next));
    setMatch(null);
    setApproved(false);
    setOrder(null);
    setSupplierId(null);
    setChatOpen(false);
  }

  function openDirectory(id: string) {
    const next = scenarioById(id);
    setScenarioId(next.id);
    setView("suppliers");
    setPhase("brief");
    setBrief(next.prompts[0].text);
    setLevers(defaultLevers(next));
    setMatch(null);
    setApproved(false);
    setOrder(null);
    setSupplierId(null);
  }

  function newIndent() {
    setView("sourcing");
    setPhase("brief");
    setBrief(scenario.prompts[0].text);
    setLevers(defaultLevers(scenario));
    setMatch(null);
    setApproved(false);
    setOrder(null);
    setSupplierId(null);
    setChatOpen(false);
  }

  function updateLevers(patch: Partial<Levers>) {
    setLevers((prev) => {
      const next = { ...prev, ...patch };
      if (patch.budget !== undefined) {
        next.budgetCap = patch.budget ? prev.budgetBase : prev.budgetBase * 1.18;
      }
      if (patch.delivery !== undefined) {
        next.deadline = patch.delivery ? prev.deadlineBase : prev.deadlineBase + 3;
      }
      return next;
    });
  }

  function resetLevers() {
    const baseBudget = parsed.budget ?? scenario.budgetDefault;
    const baseDeadline = parsed.days ?? scenario.daysDefault;
    setLevers({
      ...defaultLevers(scenario),
      budgetCap: baseBudget,
      deadline: baseDeadline,
      budgetBase: baseBudget,
      deadlineBase: baseDeadline,
    });
  }

  function ask(question?: string) {
    setChatSeed(question ?? null);
    setChatOpen(true);
  }

  function openSupplier(id: string) {
    setSupplierId(id);
    setView("suppliers");
  }

  const poOffer = approved && order ? order.offer : recommendation.recommended;

  const status =
    view === "suppliers"
      ? "Supplier directory"
      : view === "history"
        ? "Buyer memory"
        : view === "examples"
          ? "Demo library"
        : phase === "running"
          ? "Munshi is on call"
          : phase === "confirmed"
            ? "Order placed"
            : phase === "decision"
              ? approved
                ? "PO approved"
                : "Decision ready"
              : "Munshi is ready";

  return (
    <AppShell
      view={view}
      onView={(next) => {
        setView(next);
        if (next === "suppliers" && !supplierId) setSupplierId(null);
      }}
      onNewIndent={newIndent}
      status={status}
      statusTone={phase === "running" ? "live" : phase === "decision" || phase === "confirmed" || approved ? "done" : "idle"}
      buyer={scenario.buyer}
      scenario={scenario}
      onScenario={switchScenario}
    >
      {view === "examples" ? (
        <ExamplesView onLoad={loadExample} onDirectory={openDirectory} />
      ) : view === "suppliers" ? (
        <SuppliersView
          scenario={scenario}
          match={match}
          selectedId={supplierId}
          onSelect={setSupplierId}
          onBack={() => setView("sourcing")}
        />
      ) : view === "history" ? (
        <HistoryView scenario={scenario} onNewIndent={newIndent} />
      ) : phase === "brief" ? (
        <BriefScreen
          scenario={scenario}
          brief={brief}
          parsed={parsed}
          matching={matching}
          onBrief={setBrief}
          onStart={startRun}
          onScenario={switchScenario}
          onExamples={() => setView("examples")}
        />
      ) : phase === "running" ? (
        <LiveRun
          scenario={scenario}
          offers={offers}
          recommendation={recommendation}
          levers={levers}
          match={match}
          onDone={() => setPhase("decision")}
          onSupplier={openSupplier}
        />
      ) : phase === "confirmed" && (order?.offer ?? recommendation.recommended) ? (
        <OrderConfirmation
          scenario={scenario}
          offer={order?.offer ?? recommendation.recommended!}
          onBack={() => setPhase("decision")}
          onNewIndent={newIndent}
          onViewPo={() => setPoOpen(true)}
        />
      ) : (
        <DecisionBoard
          scenario={scenario}
          offers={offers}
          recommendation={recommendation}
          levers={levers}
          approved={approved}
          onLevers={updateLevers}
          onResetLevers={resetLevers}
          onSupplier={openSupplier}
          onApprove={() => setPoOpen(true)}
          onChat={ask}
        />
      )}

      <PoDrawer
        open={poOpen}
        scenario={scenario}
        offer={poOffer}
        approved={approved}
        onClose={() => setPoOpen(false)}
        onApprove={() => {
          const offer = poOffer;
          if (!offer) return;
          setApproved(true);
          setOrder({ offer, poNumber: `${scenario.buyer.indentId}-01` });
        }}
        onViewOrder={() => {
          setPoOpen(false);
          setPhase("confirmed");
        }}
      />
      <ChatDrawer
        open={chatOpen}
        seed={chatSeed}
        scenario={scenario}
        levers={levers}
        suggestions={[
          `Why not ${[...offers].sort((a, b) => a.landed - b.landed)[0]?.supplier.shortName ?? "the cheapest"}?`,
          "What's the risk?",
          "Can you negotiate more?",
          `What if I can wait ${scenario.daysDefault + 3} days?`,
          "Compare all three.",
        ]}
        onClose={() => setChatOpen(false)}
        onOpenPo={() => {
          setChatOpen(false);
          setPoOpen(true);
        }}
        onSupplier={(id) => {
          setChatOpen(false);
          openSupplier(id);
        }}
      />
    </AppShell>
  );
}
