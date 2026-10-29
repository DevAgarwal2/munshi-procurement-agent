"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { evaluateOffers, formatINR, formatPerUnit, recommend } from "@/lib/engine";
import type { Levers, Offer, Recommendation, Scenario } from "@/lib/types";

const HARD_KEYS = ["budget", "delivery", "moq", "spec"] as const;

function money(value: number) {
  return value >= 1000 ? formatINR(value) : formatPerUnit(value);
}

export function DecisionWorkings({
  offers,
  recommendation,
  levers,
  scenario,
}: {
  offers: Offer[];
  recommendation: Recommendation;
  levers: Levers;
  scenario: Scenario;
}) {
  const deliveryAlt = recommend(
    evaluateOffers(scenario, { ...levers, delivery: false, priority: "cost" }),
    { ...levers, delivery: false, priority: "cost" },
    scenario
  );
  const budgetAlt = recommend(
    evaluateOffers(scenario, { ...levers, budget: false, priority: "speed" }),
    { ...levers, budget: false, priority: "speed" },
    scenario
  );

  const current = recommendation.recommended;
  const deliverySwitch =
    deliveryAlt.recommended && deliveryAlt.recommended.supplier.id !== current?.supplier.id
      ? deliveryAlt.recommended
      : null;
  const budgetSwitch =
    budgetAlt.recommended && budgetAlt.recommended.supplier.id !== current?.supplier.id ? budgetAlt.recommended : null;

  return (
    <details className="workings">
      <summary>
        <span>How Munshi chose this</span>
        <span className="workings-hint">
          Normalise → filter → rank <ChevronDown size={14} />
        </span>
      </summary>

      <div className="workings-body">
        <p className="workings-lede">
          Munshi shortlisted 3 of {scenario.suppliers.length} suppliers for this brief. What follows is the
          economic decision — the part the ranking does not decide.
        </p>
        <div className="workings-step">
          <span className="workings-num">01</span>
          <div>
            <h3>Every quote is normalised to landed cost</h3>
            <p>
              Sticker price is not comparable. Munshi adds {scenario.unit === "cups" ? "printing, the one-time plate, " : "any one-time charges, "}
              freight and GST, then divides by the order quantity.
            </p>
            <code className="workings-formula">
              (qty × unit price{scenario.unit === "cups" ? " + qty × printing" : ""} + one-time + freight) × (1 + GST) ÷ qty
            </code>
            <table className="workings-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="num">Goods</th>
                  <th className="num">One-time</th>
                  <th className="num">Freight</th>
                  <th className="num">GST</th>
                  <th className="num">Landed / {scenario.unitShort}</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.supplier.id}>
                    <td>{offer.supplier.shortName}</td>
                    <td className="num">{formatINR(offer.goodsCost)}</td>
                    <td className="num">{formatINR(offer.oneTimeCost)}</td>
                    <td className="num">{formatINR(offer.freightCost)}</td>
                    <td className="num">{formatINR(offer.gst)}</td>
                    <td className="num">
                      <strong>{money(offer.landed)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="workings-step">
          <span className="workings-num">02</span>
          <div>
            <h3>Hard constraints decide who is eligible — not the score</h3>
            <p>
              Any offer that breaks the budget, deadline, MOQ, or {scenario.specLabel.toLowerCase()} requirement is
              disqualified, however cheap it looks. The score only orders the survivors.
            </p>
            <table className="workings-table workings-checks">
              <thead>
                <tr>
                  <th>Constraint</th>
                  {offers.map((offer) => (
                    <th key={offer.supplier.id} className="center">
                      {offer.supplier.shortName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HARD_KEYS.map((key) => (
                  <tr key={key}>
                    <td>{offers[0]?.constraints.find((c) => c.key === key)?.label}</td>
                    {offers.map((offer) => {
                      const constraint = offer.constraints.find((c) => c.key === key);
                      return (
                        <td key={offer.supplier.id} className="center" title={constraint?.detail}>
                          {constraint?.pass ? (
                            <Check size={14} className="workings-pass" />
                          ) : (
                            <X size={14} className="workings-fail" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="workings-result">
                  <td>Offer</td>
                  {offers.map((offer) => (
                    <td key={offer.supplier.id} className="center">
                      <span className={offer.feasible ? "state-pass" : "state-fail"}>
                        {offer.feasible ? "Feasible" : `${offer.hardFails} fail`}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="workings-step">
          <span className="workings-num">03</span>
          <div>
            <h3>Rank the survivors, then explain the trade-off</h3>
            <p>
              Feasible offers are ordered by a weighted fit score — price, delivery, on-time reliability, and
              verification — with weights set by the buyer&apos;s priority. With {recommendation.feasible.length} feasible
              offer{recommendation.feasible.length === 1 ? "" : "s"}, the recommendation is{" "}
              <strong>{current?.supplier.name}</strong> at {current ? money(current.landed) : "—"}/{scenario.unitShort}.
            </p>
            {deliverySwitch || budgetSwitch ? (
              <div className="workings-alt">
                <strong>What would change it</strong>
                {deliverySwitch ? (
                  <div className="workings-alt-row">
                    Relax the deadline to {levers.deadlineBase + 3} days + Lowest cost → {deliverySwitch.supplier.shortName}{" "}
                    leads at {money(deliverySwitch.landed)}/{scenario.unitShort}.
                  </div>
                ) : null}
                {budgetSwitch ? (
                  <div className="workings-alt-row">
                    Raise the ceiling to {formatINR(levers.budgetBase * 1.18)} + Fastest →{" "}
                    {budgetSwitch.supplier.shortName} leads at {money(budgetSwitch.landed)}/{scenario.unitShort} in{" "}
                    {budgetSwitch.quote.leadDays} days.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
}
