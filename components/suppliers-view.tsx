"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { callFor, formatINR, formatPerUnit, supplierById } from "@/lib/engine";
import type { MatchResult, Scenario } from "@/lib/types";
import { Stamp, SupplierMark } from "./ui";

const FILTERS = [
  { id: "all", label: "All suppliers" },
  { id: "called", label: "Called" },
  { id: "screened", label: "Screened" },
] as const;

function money(value: number) {
  return value >= 1000 ? formatINR(value) : formatPerUnit(value);
}

export function SuppliersView({
  scenario,
  match,
  selectedId,
  onSelect,
  onBack,
}: {
  scenario: Scenario;
  match: MatchResult | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");

  const calledIds = new Set(scenario.callOrder);
  const filtered = useMemo(() => {
    return scenario.suppliers.filter((s) => {
      if (filter === "called" && !calledIds.has(s.id)) return false;
      if (filter === "screened" && calledIds.has(s.id)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.products.join(" ").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filter, query, scenario, calledIds]);

  const selected = selectedId ? scenario.suppliers.find((s) => s.id === selectedId) ?? null : null;
  const selectedCalled = selected ? calledIds.has(selected.id) : false;
  const selectedQuote = selected && selectedCalled ? scenario.quotes[selected.id] : null;
  const selectedCall = selected ? callFor(scenario, selected.id) : null;
  const matchReason = selected
    ? match?.shortlist.find((s) => s.id === selected.id)?.reason ??
      match?.excluded.find((s) => s.id === selected.id)?.reason ??
      scenario.screenedOut.find((s) => s.supplierId === selected.id)?.reason
    : null;
  const screenedReason =
    selected && !selectedCalled
      ? match?.excluded.find((s) => s.id === selected.id)?.reason ??
        scenario.screenedOut.find((s) => s.supplierId === selected.id)?.reason ??
        selected.note
      : null;

  return (
    <div className="directory-shell">
      <div className="directory-head">
        <div>
          <button className="text-btn back-link" onClick={onBack}>
            <ArrowLeft size={14} /> Back to the sourcing file
          </button>
          <h1>
            {scenario.industry} <span className="directory-industry">directory</span>
          </h1>
          <p>
            Curated, verified, and small on purpose. {scenario.suppliers.length} suppliers for{" "}
            {scenario.buyer.workspace} in {scenario.buyer.city}. Munshi ranks them against the brief and
            only calls the top {scenario.callOrder.length}.
          </p>
        </div>
        <div className="directory-count">
          <Users size={17} />
          <span>
            <strong>{scenario.suppliers.length}</strong> suppliers
          </span>
          <span className="directory-count-sub">
            {scenario.callOrder.length} called · {scenario.screenedOut.length} screened out
          </span>
        </div>
      </div>

      <div className="directory-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filter suppliers">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`filter-tab ${filter === f.id ? "is-active" : ""}`}
              onClick={() => setFilter(f.id)}
              role="tab"
              aria-selected={filter === f.id}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, city, or product"
            aria-label="Search suppliers"
          />
        </label>
      </div>

      <div className={`directory-grid ${selected ? "has-profile" : ""}`}>
        <div className="directory-table-wrap">
          <table className="directory-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Category</th>
                <th>Location</th>
                <th className="num">On-time</th>
                <th className="num">Orders</th>
                <th>Verification</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((supplier) => {
                const called = calledIds.has(supplier.id);
                return (
                  <tr
                    key={supplier.id}
                    className={selectedId === supplier.id ? "is-selected" : ""}
                    onClick={() => onSelect(supplier.id)}
                  >
                    <td>
                      <div className="directory-supplier">
                        <SupplierMark supplier={supplier} size={32} />
                        <div>
                          <strong>{supplier.name}</strong>
                          <span>{supplier.relationship}</span>
                        </div>
                      </div>
                    </td>
                    <td>{supplier.category}</td>
                    <td>
                      <span className="loc">
                        <MapPin size={12} /> {supplier.area}, {supplier.city}
                      </span>
                    </td>
                    <td className="num">
                      <span
                        className={
                          supplier.onTime >= 90 ? "num-good" : supplier.onTime >= 75 ? "num-warn" : "num-bad"
                        }
                      >
                        {supplier.onTime}%
                      </span>
                    </td>
                    <td className="num">{supplier.orders}</td>
                    <td>
                      <span
                        className={`verify-badge ${
                          supplier.gstStatus === "active" &&
                          (!scenario.requiresFoodGrade || supplier.foodGrade)
                            ? "is-good"
                            : "is-warn"
                        }`}
                      >
                        {supplier.gstStatus === "active" && (!scenario.requiresFoodGrade || supplier.foodGrade) ? (
                          <ShieldCheck size={12} />
                        ) : (
                          <TriangleAlert size={12} />
                        )}
                        {supplier.gstStatus === "active" && (!scenario.requiresFoodGrade || supplier.foodGrade)
                          ? "Verified"
                          : "Needs review"}
                      </span>
                    </td>
                    <td>
                      <span className={`called-mark ${called ? "is-called" : ""}`}>
                        {called ? "Called" : "Screened"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="directory-empty">
              <Search size={18} />
              <p>No supplier matches that filter. Try a broader search.</p>
              <button
                className="text-btn"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>

        {selected ? (
          <aside className="supplier-profile">
            <div className="profile-head">
              <div className="profile-top">
                <SupplierMark supplier={selected} size={44} />
                <div>
                  <h2>{selected.name}</h2>
                  <span>
                    {selected.area}, {selected.city} · since {selected.since}
                  </span>
                </div>
                <button className="icon-btn" onClick={() => onSelect(null)} aria-label="Close supplier profile">
                  <X size={15} />
                </button>
              </div>
              <div className="profile-badges">
                {selected.foodGrade ? (
                  <span className="tag tag-good">Food-grade</span>
                ) : (
                  <span className="tag">Non-food</span>
                )}
                {selected.certifications.map((cert) => (
                  <span className="tag" key={cert}>
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            <p className="profile-note">{selected.note}</p>

            {selectedCalled && matchReason ? (
              <div className="profile-match">
                <span className="profile-match-label">
                  Why matched
                </span>
                <p>{matchReason}</p>
              </div>
            ) : null}

            <div className="profile-stats">
              <div>
                <span>On-time</span>
                <strong>{selected.onTime}%</strong>
              </div>
              <div>
                <span>Response</span>
                <strong>{selected.responseMins}m</strong>
              </div>
              <div>
                <span>Orders</span>
                <strong>{selected.orders}</strong>
              </div>
              <div>
                <span>Rating</span>
                <strong className="rating">
                  <Star size={13} fill="currentColor" /> {selected.rating}
                </strong>
              </div>
            </div>

            {selectedQuote ? (
              <div className="profile-quote">
                <div className="profile-quote-head">
                  <span className="block-label">Last quote · this run</span>
                  <Stamp tone={selectedQuote.supplierId === scenario.callOrder[0] ? "green" : "ink"} rotate={-2}>
                    {selectedQuote.supplierId === scenario.callOrder[0] ? "Negotiated" : "Captured"}
                  </Stamp>
                </div>
                <div className="profile-quote-grid">
                  <div>
                    <span>Base</span>
                    <strong>{money(selectedQuote.base)}</strong>
                  </div>
                  <div>
                    <span>One-time</span>
                    <strong>{formatINR(selectedQuote.plate)}</strong>
                  </div>
                  <div>
                    <span>Freight</span>
                    <strong>{formatINR(selectedQuote.freight)}</strong>
                  </div>
                  <div>
                    <span>Lead</span>
                    <strong>{selectedQuote.leadDays} days</strong>
                  </div>
                  <div>
                    <span>MOQ</span>
                    <strong>
                      {selectedQuote.effectiveMoq.toLocaleString("en-IN")} {scenario.unit}
                    </strong>
                  </div>
                  <div>
                    <span>GST</span>
                    <strong>{Math.round(selectedQuote.gstRate * 100)}%</strong>
                  </div>
                </div>
                {selectedQuote.negotiation ? (
                  <p className="profile-negotiation">
                    <Check size={13} /> Opened at {money(selectedQuote.negotiation.from)}, closed at{" "}
                    {money(selectedQuote.negotiation.to)}.
                  </p>
                ) : null}
              </div>
            ) : null}

            {screenedReason ? (
              <div className="profile-screened">
                <TriangleAlert size={16} />
                <div>
                  <strong>
                    Screened out before calling
                  </strong>
                  <p>{screenedReason}</p>
                </div>
              </div>
            ) : null}

            {selectedCall ? (
              <div className="profile-call">
                <div className="profile-call-head">
                  <span className="block-label">Call file</span>
                  <span className="profile-call-meta">
                    {selectedCall.language.toUpperCase()} · Gnani Timbre v3.0
                  </span>
                </div>
                <div className="profile-call-lines">
                  {selectedCall.lines.slice(0, 4).map((line) => (
                    <div key={line.id} className={`profile-call-line ${line.speaker === "agent" ? "is-agent" : ""}`}>
                      <span>{line.speaker === "agent" ? "Munshi" : selected.shortName}</span>
                      <p>{line.display}</p>
                    </div>
                  ))}
                </div>
                <span className="profile-call-note">Full transcript from the sourcing call.</span>
              </div>
            ) : null}

            <div className="profile-actions">
              <button className="btn btn-quiet" onClick={onBack}>
                <ArrowLeft size={14} /> Decision file
              </button>
              <button className="btn btn-primary" onClick={() => onSelect(null)}>
                Back to directory <ArrowRight size={14} />
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
