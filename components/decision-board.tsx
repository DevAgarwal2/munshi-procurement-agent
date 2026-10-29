"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  FileText,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkle,
  TriangleAlert,
} from "lucide-react";
import { evidenceFor, formatINR, formatPerUnit, pct } from "@/lib/engine";
import type { Levers, Offer, Priority, Recommendation, Scenario } from "@/lib/types";
import { Stamp, StatusDot, SupplierMark } from "./ui";
import { DecisionWorkings } from "./decision-workings";

const PRIORITIES: { id: Priority; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Price, speed, reliability" },
  { id: "cost", label: "Lowest cost", hint: "Landed cost first" },
  { id: "speed", label: "Fastest", hint: "Delivery first" },
  { id: "risk", label: "Lowest risk", hint: "Reliability + verification" },
];

const CONSTRAINT_ORDER = ["budget", "delivery", "moq", "spec"] as const;

function money(value: number) {
  return value >= 1000 ? formatINR(value) : formatPerUnit(value);
}

function ConstraintDots({ offer }: { offer: Offer }) {
  return (
    <span className="constraint-dots" aria-label={`${offer.hardFails} hard constraints failed`}>
      {CONSTRAINT_ORDER.map((key) => {
        const c = offer.constraints.find((x) => x.key === key);
        return (
          <span
            key={key}
            className={`constraint-dot ${c?.pass ? "is-pass" : "is-fail"}`}
            title={`${c?.label}: ${c?.pass ? "pass" : "fail"} — ${c?.detail}`}
          />
        );
      })}
    </span>
  );
}

function LeverToggle({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <button
      className={`lever-toggle ${checked ? "is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="lever-switch" aria-hidden>
        <span />
      </span>
      <span className="lever-copy">
        <span>{label}</span>
        <em>{detail}</em>
      </span>
    </button>
  );
}

function Breakdown({
  offer,
  scenario,
  onSupplier,
}: {
  offer: Offer;
  scenario: Scenario;
  onSupplier: (id: string) => void;
}) {
  const evidence = evidenceFor(scenario, offer.supplier.id);
  const plateLabel = offer.quote.oneTimeLabel ?? "One-time charge";
  const freightLabel =
    offer.supplier.city.toLowerCase() === scenario.buyer.city.toLowerCase()
      ? "Local delivery"
      : `${offer.supplier.city} → ${scenario.buyer.city}`;

  return (
    <div className="breakdown">
      <div className="breakdown-grid">
        <div className="breakdown-block">
          <span className="block-label">Landed cost, line by line</span>
          <dl className="cost-list">
            <div>
              <dt>
                Goods · {offer.quote.quantity.toLocaleString("en-IN")} × {money(offer.quote.base)}
              </dt>
              <dd>{formatINR(offer.goodsCost)}</dd>
            </div>
            {offer.quote.print > 0 ? (
              <div>
                <dt>
                  Printing · {offer.quote.quantity.toLocaleString("en-IN")} × {money(offer.quote.print)}
                </dt>
                <dd>{formatINR(offer.printCost)}</dd>
              </div>
            ) : null}
            {offer.oneTimeCost > 0 ? (
              <div>
                <dt>{plateLabel} · one-time</dt>
                <dd>{formatINR(offer.oneTimeCost)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Freight · {freightLabel}</dt>
              <dd>{formatINR(offer.freightCost)}</dd>
            </div>
            <div className="cost-rule">
              <dt>Subtotal</dt>
              <dd>{formatINR(offer.subtotal)}</dd>
            </div>
            <div>
              <dt>GST · {pct(offer.quote.gstRate)}</dt>
              <dd>{formatINR(offer.gst)}</dd>
            </div>
            <div className="cost-total">
              <dt>Total landed</dt>
              <dd>{formatINR(offer.total)}</dd>
            </div>
            <div className="cost-unit">
              <dt>Per {scenario.unitShort}</dt>
              <dd>{money(offer.landed)}</dd>
            </div>
          </dl>
        </div>

        <div className="breakdown-block">
          <span className="block-label">What the supplier actually said</span>
          <div className="evidence-list">
            {evidence.map((item) => (
              <blockquote key={item.id} className="evidence-quote">
                <p>“{item.quote}”</p>
                <footer>
                  <span>
                    {offer.supplier.shortName} · {item.at}
                  </span>
                  <span className="tag">{item.field}</span>
                </footer>
              </blockquote>
            ))}
          </div>
          <button className="text-btn evidence-open" onClick={() => onSupplier(offer.supplier.id)}>
            <Phone size={13} /> Open the full call file
          </button>
        </div>
      </div>

      <div className="verify-strip">
        <div>
          <ShieldCheck size={16} />
          <span>
            <strong>GSTIN</strong> {offer.supplier.gstStatus === "active" ? "active · name matched" : "inactive"}
          </span>
        </div>
        <div>
          <BadgeCheck size={16} />
          <span>
            <strong>{scenario.requiresFoodGrade ? "Food-grade" : "Certification"}</strong>{" "}
            {scenario.requiresFoodGrade
              ? offer.supplier.foodGrade
                ? "certificate on file"
                : "not provided"
              : offer.supplier.certifications.slice(0, 1).join("") || "on file"}
          </span>
        </div>
        <div>
          <FileText size={16} />
          <span>
            <strong>Quote</strong> valid {offer.quote.validityDays} days
          </span>
        </div>
        <div>
          <StatusDot tone={offer.feasible ? "done" : "warn"} />
          <span>
            <strong>
              {offer.feasible ? "All hard constraints clear" : `${offer.hardFails} hard constraint${offer.hardFails === 1 ? "" : "s"} failed`}
            </strong>
          </span>
        </div>
      </div>

      {offer.quote.negotiation ? (
        <div className="negotiation-note">
          <Sparkle size={15} />
          <p>
            <strong>Munshi negotiated this quote.</strong> {offer.quote.negotiation.note}
          </p>
          <span className="negotiation-saved">−{formatINR(offer.quote.negotiation.saved)} after tax</span>
        </div>
      ) : null}
    </div>
  );
}

export function DecisionBoard({
  scenario,
  offers,
  recommendation,
  levers,
  approved,
  onLevers,
  onResetLevers,
  onSupplier,
  onApprove,
  onChat,
}: {
  scenario: Scenario;
  offers: Offer[];
  recommendation: Recommendation;
  levers: Levers;
  approved: boolean;
  onLevers: (patch: Partial<Levers>) => void;
  onResetLevers: () => void;
  onSupplier: (id: string) => void;
  onApprove: () => void;
  onChat: (question?: string) => void;
}) {
  const recommended = recommendation.recommended;
  const [selectedId, setSelectedId] = useState(recommended?.supplier.id ?? scenario.callOrder[0]);
  const selected = offers.find((o) => o.supplier.id === selectedId) ?? recommended ?? offers[0];

  useEffect(() => {
    if (recommended) setSelectedId(recommended.supplier.id);
  }, [recommended?.supplier.id]);

  const tradeoffs = useMemo(() => {
    const cheapest = [...offers].sort((a, b) => a.landed - b.landed)[0];
    const fastest = [...offers].sort((a, b) => a.quote.leadDays - b.quote.leadDays)[0];
    return { cheapest, fastest };
  }, [offers]);

  if (!recommended || !selected) return null;

  const baselineId = scenario.callOrder[0];
  const isChanged = recommended.supplier.id !== baselineId;
  const baseline = offers.find((o) => o.supplier.id === baselineId);

  const reorderLanded = recommended.oneTimeCost > 0
    ? ((recommended.subtotal - recommended.oneTimeCost) * (1 + recommended.quote.gstRate)) / recommended.quote.quantity
    : null;

  const lateSwitch =
    !levers.delivery
      ? offers.find(
          (o) =>
            o.supplier.id !== recommended.supplier.id &&
            o.feasible &&
            o.quote.leadDays > levers.deadlineBase &&
            o.landed <= recommended.landed
        )
      : undefined;
  const budgetSwitch =
    !levers.budget
      ? offers.find(
          (o) =>
            o.supplier.id !== recommended.supplier.id &&
            o.feasible &&
            o.landed > levers.budgetBase &&
            o.quote.leadDays < recommended.quote.leadDays
        )
      : undefined;

  let leverNote: string | null = null;
  if (lateSwitch) {
    leverNote = `${lateSwitch.supplier.name} now clears the relaxed window and is ${formatINR(
      recommended.total - lateSwitch.total
    )} ${lateSwitch.total <= recommended.total ? "cheaper" : "more expensive"}. Switch priority to Lowest cost to make it the lead.`;
  } else if (budgetSwitch) {
    leverNote = `${budgetSwitch.supplier.name} now clears the relaxed ceiling and is ${
      recommended.quote.leadDays - budgetSwitch.quote.leadDays
    } days faster. Switch to Fastest to make it the lead.`;
  } else if (!levers.certification) {
    leverNote = "Certification is no longer a gate. The verification evidence stays visible on every offer.";
  }

  return (
    <div className={`decision-shell ${approved ? "is-approved" : ""}`}>
      <div className="decision-file">
        <div className="file-head">
          <div className="file-head-left">
            <span className="file-id">DECISION / {scenario.buyer.indentId}</span>
            <span className="file-date">
              Completed {scenario.buyer.date} · 3 calls · 3 quotes
            </span>
          </div>
          <div className="decision-stamps">
            <Stamp tone="green" rotate={2}>
              {approved ? "Approved" : "Recommended"}
            </Stamp>
            <Stamp tone="ink" rotate={-4}>
              3 of {scenario.suppliers.length} called
            </Stamp>
          </div>
        </div>

        <div className="decision-hero">
          <div className="verdict-band">
            <div className="verdict-copy">
              <h1>Buy from {recommended.supplier.name}{recommended.supplier.name.endsWith(".") ? "" : "."}</h1>
              <p className="decision-sub">{recommendation.rationale}</p>
              <div className="decision-chips">
                <span className="vchip">
                  <Check size={11} /> All hard constraints clear
                </span>
                <span className="vchip">{recommended.supplier.onTime}% on-time</span>
                <span className="vchip">
                  GSTIN + {scenario.requiresFoodGrade ? "food-grade" : "certification"} verified
                </span>
                {recommended.quote.negotiation ? (
                  <span className="vchip vchip-gold">{recommended.quote.negotiation.label} negotiated</span>
                ) : null}
              </div>
              <div className="decision-hero-actions">
                <button className="btn btn-verdict-primary" onClick={onApprove}>
                  {approved ? "View approved PO" : "Approve & draft PO"}
                  <ArrowRight size={16} />
                </button>
                <button className="btn btn-verdict-quiet" onClick={() => onChat("What's the risk?")}>
                  <MessageSquare size={15} />
                  Ask Munshi
                </button>
              </div>
            </div>
            <div className="verdict-stats">
              <div>
                <span>Landed / {scenario.unitShort}</span>
                <strong>{money(recommended.landed)}</strong>
                <em>incl. GST + freight</em>
              </div>
              <div>
                <span>Total order</span>
                <strong>{formatINR(recommended.total)}</strong>
                <em>{recommended.quote.payment}</em>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{recommended.quote.leadDays} days</strong>
                <em>quote valid {recommended.quote.validityDays} days</em>
              </div>
              <div>
                <span>Confidence</span>
                <strong>{recommendation.confidence}</strong>
                <em>
                  {recommendation.feasible.length} feasible offer{recommendation.feasible.length === 1 ? "" : "s"}
                </em>
                <span className="verdict-track">
                  <span style={{ width: `${recommendation.confidence}%` }} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {recommendation.changed ? (
          <div className="changed-banner">
            <CircleAlert size={16} />
            <div>
              <strong>Recommendation changed.</strong> {recommendation.changed}
            </div>
            <button className="text-btn" onClick={onResetLevers}>
              Reset levers
            </button>
          </div>
        ) : null}
      </div>

      <div className="decision-grid">
        <section className="comparison">
          <div className="section-head">
            <div>
              <h2>Comparison statement</h2>
              <p>
                Every offer normalised to the same {scenario.quantity.toLocaleString("en-IN")} {scenario.unit},
                delivered, GST-inclusive basis. 3 of {scenario.suppliers.length} suppliers were called — the rest were
                screened out on product, MOQ, or verification.
              </p>
            </div>
            <span className="file-count">
              3 quotes · {recommendation.feasible.length} feasible
            </span>
          </div>

          <div className="compare-desktop">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="th-rank">#</th>
                  <th>Supplier</th>
                  <th className="num th-landed">Landed / {scenario.unitShort}</th>
                  <th className="num">Lead</th>
                  <th className="num">Fit</th>
                  <th className="th-check">Checks</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const isBest = offer.supplier.id === recommended.supplier.id;
                  const isSelected = offer.supplier.id === selectedId;
                  return (
                    <tr
                      key={offer.supplier.id}
                      className={`${isSelected ? "is-selected" : ""} ${isBest ? "is-best" : ""}`}
                      onClick={() => setSelectedId(offer.supplier.id)}
                    >
                      <td className="td-rank">{String(offer.rank).padStart(2, "0")}</td>
                      <td>
                        <div className="table-supplier">
                          <SupplierMark supplier={offer.supplier} size={32} />
                          <div>
                            <strong>{offer.supplier.name}</strong>
                            <span>
                              {offer.supplier.area} · {offer.supplier.onTime}% on time
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={`num td-landed ${isBest ? "is-best" : ""}`}>
                        {money(offer.landed)}
                        {isBest ? <span className="best-mark">best fit</span> : null}
                        {!offer.feasible ? <span className="fail-mark">{offer.hardFails} fail</span> : null}
                      </td>
                      <td className="num">{offer.quote.leadDays}d</td>
                      <td className="num">{Math.round(offer.score)}</td>
                      <td>
                        <ConstraintDots offer={offer} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="compare-mobile">
            {offers.map((offer) => {
              const isBest = offer.supplier.id === recommended.supplier.id;
              const isSelected = offer.supplier.id === selectedId;
              return (
                <button
                  key={offer.supplier.id}
                  className={`mobile-offer ${isSelected ? "is-selected" : ""} ${isBest ? "is-best" : ""}`}
                  onClick={() => setSelectedId(offer.supplier.id)}
                >
                  <div className="mobile-offer-top">
                    <span className="mobile-rank">{String(offer.rank).padStart(2, "0")}</span>
                    <SupplierMark supplier={offer.supplier} size={34} />
                    <span className="mobile-offer-name">
                      <strong>{offer.supplier.name}</strong>
                      <span>
                        {offer.supplier.city} · {offer.quote.leadDays} days
                      </span>
                    </span>
                    <span className="mobile-landed">{money(offer.landed)}</span>
                  </div>
                  <div className="mobile-offer-bottom">
                    <span className="mobile-base">
                      Base {money(offer.quote.base)} · landed includes freight + GST
                    </span>
                    <span className={`mini-state ${offer.feasible ? "is-pass" : "is-fail"}`}>
                      {offer.feasible ? "Feasible" : `${offer.hardFails} fail`}
                    </span>
                  </div>
                  <ConstraintDots offer={offer} />
                </button>
              );
            })}
          </div>

          <div className="table-note">
            <span>
              Landed = goods + {scenario.unit === "cups" ? "print + plate + " : ""}freight + GST. Select a row for the
              build-up and the supplier&apos;s own words.
            </span>
          </div>

          <DecisionWorkings offers={offers} recommendation={recommendation} levers={levers} scenario={scenario} />

          <div className="breakdown-wrap">
            <div className="breakdown-title">
              <div>
                <span className="block-label">Selected offer</span>
                <strong>{selected.supplier.name}</strong>
              </div>
              <button className="text-btn" onClick={() => onSupplier(selected.supplier.id)}>
                Supplier file <ArrowRight size={13} />
              </button>
            </div>
            <Breakdown offer={selected} scenario={scenario} onSupplier={onSupplier} />
          </div>
        </section>

        <aside className="memo-col">
          <div className="memo">
            <div className="memo-head">
              <h2>Why this one</h2>
              <Stamp tone="red" rotate={-3}>
                {isChanged ? "Revised" : "Recommended"}
              </Stamp>
            </div>
            <p>{recommendation.rationale}</p>

            <div className="memo-tradeoffs">
              <div className="tradeoff-row">
                <span className="tradeoff-label">Cheapest</span>
                <strong>
                  {tradeoffs.cheapest.supplier.shortName} · {money(tradeoffs.cheapest.landed)}
                </strong>
                <span className={tradeoffs.cheapest.feasible ? "state-pass" : "state-fail"}>
                  {tradeoffs.cheapest.feasible ? "within levers" : `${tradeoffs.cheapest.quote.leadDays}-day lead`}
                </span>
              </div>
              <div className="tradeoff-row">
                <span className="tradeoff-label">Fastest</span>
                <strong>
                  {tradeoffs.fastest.supplier.shortName} · {tradeoffs.fastest.quote.leadDays} days
                </strong>
                <span className={tradeoffs.fastest.feasible ? "state-pass" : "state-fail"}>
                  {tradeoffs.fastest.feasible ? "within levers" : `${money(tradeoffs.fastest.landed)} landed`}
                </span>
              </div>
              <div className="tradeoff-row is-chosen">
                <span className="tradeoff-label">Chosen</span>
                <strong>
                  {recommended.supplier.shortName} · {money(recommended.landed)}
                </strong>
                <span className="state-pass">all constraints</span>
              </div>
            </div>

            <div className="memo-block">
              <span className="block-label">Open risks</span>
              <ul className="risk-list">
                {recommended.oneTimeCost > 0 ? (
                  <li>
                    <TriangleAlert size={14} />
                    <span>
                      {formatINR(recommended.oneTimeCost)}{" "}
                      {(recommended.quote.oneTimeLabel ?? "one-time charge").toLowerCase()}:{" "}
                      {recommended.quote.oneTimeNote ??
                        (reorderLanded ? `one-time; a repeat order lands at ${money(reorderLanded)}.` : "one-time.")}
                    </span>
                  </li>
                ) : null}
                <li>
                  <TriangleAlert size={14} />
                  <span>{recommended.quote.payment}.</span>
                </li>
                <li>
                  <TriangleAlert size={14} />
                  <span>
                    Quote valid for {recommended.quote.validityDays} days. Capacity beyond{" "}
                    {scenario.quantity.toLocaleString("en-IN")} {scenario.unit} was not audited.
                  </span>
                </li>
              </ul>
            </div>

            <div className="memo-block">
              <span className="block-label">Verified</span>
              <ul className="verify-list">
                <li>
                  <Check size={14} /> GSTIN active and name matched
                </li>
                <li>
                  <Check size={14} />{" "}
                  {recommended.supplier.certifications
                    .filter((cert) => !/GSTIN/i.test(cert))
                    .slice(0, 2)
                    .join(" + ")}{" "}
                  on file
                </li>
                <li>
                  <Check size={14} /> {recommended.supplier.orders} orders · {recommended.supplier.onTime}% on-time ·{" "}
                  {recommended.supplier.responseMins} min average response
                </li>
                <li>
                  <Check size={14} /> {scenario.specCheck}
                </li>
              </ul>
            </div>

            <div className="memo-ask">
              <span className="block-label">Ask Munshi</span>
              <div className="ask-chips">
                <button onClick={() => onChat(`Why not ${tradeoffs.cheapest.supplier.shortName}?`)}>
                  Why not {tradeoffs.cheapest.supplier.shortName}?
                </button>
                <button onClick={() => onChat("What's the risk?")}>What&apos;s the risk?</button>
                <button onClick={() => onChat("Draft the PO.")}>Draft the PO</button>
              </div>
              <button className="memo-ask-btn" onClick={() => onChat()}>
                <MessageSquare size={15} />
                Ask about this decision
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="levers">
            <div className="levers-head">
              <div>
                <h3>Buyer levers</h3>
                <p>Change the brief, not the facts. The supplier data stays put.</p>
              </div>
              <button className="text-btn" onClick={onResetLevers}>
                Reset
              </button>
            </div>

            <div className="priority">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  className={`priority-btn ${levers.priority === p.id ? "is-active" : ""}`}
                  onClick={() => onLevers({ priority: p.id })}
                  aria-pressed={levers.priority === p.id}
                  title={p.hint}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="levers-list">
              <LeverToggle
                checked={levers.budget}
                onChange={(v) => onLevers({ budget: v })}
                label={`${formatINR(levers.budgetBase)}/${scenario.unitShort} budget ceiling`}
                detail={levers.budget ? "Hard constraint" : `Relaxed to ${formatINR(levers.budgetBase * 1.18)} for what-if`}
              />
              <LeverToggle
                checked={levers.delivery}
                onChange={(v) => onLevers({ delivery: v })}
                label={`${levers.deadlineBase}-day delivery window`}
                detail={levers.delivery ? "Hard constraint" : `Relaxed to ${levers.deadlineBase + 3} days for what-if`}
              />
              <LeverToggle
                checked={levers.certification}
                onChange={(v) => onLevers({ certification: v })}
                label={scenario.requiresFoodGrade ? "Food-grade certificate" : "Certification check"}
                detail={levers.certification ? "Required before approval" : "Risk accepted for what-if"}
              />
            </div>

            <p className="lever-foot">
              {isChanged
                ? "The recommendation above is live. Reset to return to the original brief."
                : `Relax the ${levers.deadlineBase}-day window or the ${formatINR(levers.budgetBase)} ceiling to see the ranking change.`}
            </p>
            {leverNote ? (
              <p className="lever-hint">
                <CircleAlert size={13} /> {leverNote}
              </p>
            ) : null}
          </div>

          <div className="buyer-control">
            <ShieldCheck size={18} />
            <div>
              <strong>You keep the pen.</strong>
              <p>Munshi recommends the supplier and prepares the PO. No spend moves until you approve.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="decision-footer">
        <div className="footer-total">
          <span>Recommended total</span>
          <strong>{formatINR(recommended.total)}</strong>
          <span>
            {money(recommended.landed)}/{scenario.unitShort} · {recommended.quote.leadDays}-day delivery
          </span>
        </div>
        <div className="footer-actions">
          <button className="btn btn-quiet" onClick={() => onChat("Draft the PO.")}>
            Ask about the PO
          </button>
          <button className="btn btn-primary" onClick={onApprove}>
            {approved ? "View approved PO" : "Approve & draft PO"}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
