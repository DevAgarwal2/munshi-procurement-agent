"use client";

import { ArrowRight, Building2, MapPin, PackageCheck, Sparkles } from "lucide-react";
import { formatINR } from "@/lib/engine";
import { SCENARIOS, SCENARIO_ORDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/types";
import { Stamp, SupplierMark } from "./ui";

export function ExamplesView({
  onLoad,
  onDirectory,
}: {
  onLoad: (scenarioId: string, prompt: string) => void;
  onDirectory: (scenarioId: string) => void;
}) {
  return (
    <div className="examples-shell">
      <div className="examples-head">
        <div>
          <h1>Example briefs</h1>
          <p>
            Four buyers. Four industries. Each example has its own supplier roster, quotes, and negotiated outcome.
            Load a brief to run the full sourcing flow — matching, calls, landed-cost comparison, and decision.
          </p>
        </div>
        <Stamp tone="ink" rotate={2}>
          4 industries · 32 suppliers
        </Stamp>
      </div>

      <div className="examples-grid">
        {SCENARIO_ORDER.map((id, index) => {
          const scenario = SCENARIOS[id] as Scenario;
          const callable = scenario.callOrder.map((sid) => scenario.suppliers.find((s) => s.id === sid)!);
          return (
            <article className="example-card" key={id}>
              <div className="example-card-head">
                <span className="example-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="tag">{scenario.industry}</span>
              </div>

              <div className="example-buyer">
                <span className="example-avatar">{scenario.buyer.initials}</span>
                <div>
                  <strong>{scenario.buyer.workspace}</strong>
                  <span>
                    <MapPin size={11} /> {scenario.buyer.city} · {scenario.buyer.owner}
                  </span>
                </div>
              </div>

              <div className="example-order">
                <PackageCheck size={15} />
                <span>
                  {scenario.quantity.toLocaleString("en-IN")} {scenario.unit} · {formatINR(scenario.budgetDefault)}/
                  {scenario.unitShort} ceiling · {scenario.daysDefault} days
                </span>
              </div>

              <div className="example-prompts">
                <span className="example-prompts-label">Prompts</span>
                {scenario.prompts.map((prompt) => (
                  <button key={prompt.label} className="example-prompt" onClick={() => onLoad(id, prompt.text)}>
                    <span>{prompt.label}</span>
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>

              <div className="example-suppliers">
                <span className="example-suppliers-label">Called roster</span>
                <div className="example-roster">
                  {callable.map((supplier) => (
                    <span key={supplier.id} className="example-supplier" title={supplier.name}>
                      <SupplierMark supplier={supplier} size={26} />
                    </span>
                  ))}
                  <span className="example-supplier-more">+{scenario.suppliers.length - callable.length} screened</span>
                </div>
              </div>

              <div className="example-card-foot">
                <span>
                  <Building2 size={12} /> {scenario.suppliers.length} suppliers · 3 calls · 3 quotes
                </span>
                <button className="text-btn" onClick={() => onDirectory(id)}>
                  Directory <ArrowRight size={12} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="examples-note">
        <Sparkles size={15} />
        <p>
          Each scenario is a self-contained demo: switching industry changes the buyer, the supplier list, the quotes,
          and the recommendation. Nothing is shared except the decision logic.
        </p>
      </div>
    </div>
  );
}
