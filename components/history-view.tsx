"use client";

import { ArrowRight, BadgeCheck, Clock3, History, IndianRupee, PackageCheck, RefreshCw, TriangleAlert } from "lucide-react";
import { formatINR } from "@/lib/engine";
import type { Scenario } from "@/lib/types";
import { Stamp } from "./ui";

export function HistoryView({ scenario, onNewIndent }: { scenario: Scenario; onNewIndent: () => void }) {
  const spent = scenario.pastPurchases.reduce((sum, p) => sum + p.amount, 0);
  const saved = scenario.pastPurchases.reduce((sum, p) => sum + p.saved, 0);
  const onTime = scenario.pastPurchases.filter((p) => p.delivery === "On time").length;
  const onTimePct = Math.round((onTime / scenario.pastPurchases.length) * 100);
  const suppliersCount = new Set(scenario.pastPurchases.map((p) => p.supplier)).size;

  return (
    <div className="history-shell">
      <div className="history-head">
        <div>
          <h1>Purchase history</h1>
          <p>
            {scenario.buyer.workspace} in {scenario.buyer.city} · {scenario.industry}. Every delivered order becomes
            supplier memory: what they quoted, how fast they replied, and whether they kept the delivery promise.
          </p>
        </div>
        <Stamp tone="red" rotate={-2}>
          Illustrative
        </Stamp>
      </div>

      <div className="history-summary">
        <div className="summary-cell">
          <span className="summary-icon">
            <PackageCheck size={16} />
          </span>
          <span className="summary-label">Orders</span>
          <strong>{scenario.pastPurchases.length}</strong>
          <em>across {suppliersCount} suppliers</em>
        </div>
        <div className="summary-cell">
          <span className="summary-icon">
            <IndianRupee size={16} />
          </span>
          <span className="summary-label">Spent</span>
          <strong>{formatINR(spent)}</strong>
          <em>last 90 days</em>
        </div>
        <div className="summary-cell">
          <span className="summary-icon">
            <BadgeCheck size={16} />
          </span>
          <span className="summary-label">Saved</span>
          <strong>{formatINR(saved)}</strong>
          <em>vs first quote</em>
        </div>
        <div className="summary-cell">
          <span className="summary-icon">
            <Clock3 size={16} />
          </span>
          <span className="summary-label">On time</span>
          <strong>{onTimePct}%</strong>
          <em>
            {onTime} of {scenario.pastPurchases.length} deliveries
          </em>
        </div>
      </div>

      <div className="history-grid">
        <section className="history-table-wrap">
          <div className="section-head">
            <div>
              <h2>The record</h2>
              <p>Delivered orders, with the savings Munshi negotiated and the delivery outcome.</p>
            </div>
            <span className="file-count">2026</span>
          </div>
          <table className="history-table">
            <thead>
              <tr>
                <th>Indent</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Item</th>
                <th className="num">Amount</th>
                <th className="num">Saved</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {scenario.pastPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="mono-id">{purchase.id}</td>
                  <td>{purchase.date}</td>
                  <td>{purchase.supplier}</td>
                  <td>{purchase.item}</td>
                  <td className="num">{formatINR(purchase.amount)}</td>
                  <td className="num">{purchase.saved ? formatINR(purchase.saved) : "—"}</td>
                  <td>
                    <span className={`delivery-state ${purchase.delivery === "On time" ? "is-good" : "is-warn"}`}>
                      {purchase.delivery === "On time" ? <BadgeCheck size={12} /> : <TriangleAlert size={12} />}
                      {purchase.delivery}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="memory">
          <div className="memory-head">
            <h2>What Munshi remembers</h2>
            <History size={16} />
          </div>
          <div className="memory-list">
            {scenario.supplierMemory.map((item) => (
              <div key={item.supplier} className={`memory-row ${item.tone === "warn" ? "is-warn" : ""}`}>
                <span className="memory-dot" />
                <div>
                  <strong>{item.supplier}</strong>
                  <p>{item.line}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="memory-note">
            <RefreshCw size={15} />
            <p>
              The next time {scenario.buyer.workspace} buys {scenario.unit}, Munshi starts with this quote history and
              delivery record. The buyer-side data is the moat.
            </p>
          </div>
          <button className="btn btn-primary memory-cta" onClick={onNewIndent}>
            Start a repeat indent <ArrowRight size={15} />
          </button>
        </aside>
      </div>

      <div className="history-foot">
        <p>
          Demo workspace data for {scenario.industry.toLowerCase()}. Names, quotes, and delivery outcomes are
          illustrative and are not real market benchmarks.
        </p>
      </div>
    </div>
  );
}
