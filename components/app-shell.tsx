"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, History, Inbox, Menu, Plus, Users, X } from "lucide-react";
import { SCENARIOS, SCENARIO_ORDER } from "@/lib/scenarios";
import type { Buyer, Scenario } from "@/lib/types";
import { BrandMark } from "./ui";

export type View = "sourcing" | "suppliers" | "history" | "examples";

const NAV = [
  { id: "sourcing" as const, label: "Sourcing", icon: Inbox },
  { id: "suppliers" as const, label: "Suppliers", icon: Users },
  { id: "history" as const, label: "Purchase history", icon: History },
  { id: "examples" as const, label: "Example briefs", icon: BookOpen },
];

export function AppShell({
  view,
  onView,
  onNewIndent,
  status,
  statusTone = "live",
  buyer,
  scenario,
  onScenario,
  children,
}: {
  view: View;
  onView: (view: View) => void;
  onNewIndent: () => void;
  status: string;
  statusTone?: "live" | "done" | "idle";
  buyer: Buyer;
  scenario: Scenario;
  onScenario: (id: string) => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (next: View) => {
    onView(next);
    setMobileOpen(false);
  };

  return (
    <div className="app">
      <aside className={`rail ${mobileOpen ? "is-open" : ""}`}>
        <div className="rail-top">
          <button className="brand" onClick={onNewIndent} aria-label="Munshi home">
            <BrandMark />
            <span className="brand-word">MUNSHI</span>
          </button>
          <button className="rail-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <p className="rail-tagline">Procurement, handled.</p>

        <nav className="rail-nav" aria-label="Workspace">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                className={`rail-item ${active ? "is-active" : ""}`}
                onClick={() => go(item.id)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                {active ? <span className="rail-item-mark" aria-hidden /> : null}
              </button>
            );
          })}
        </nav>

        <div className="rail-file">
          <span className="rail-file-label">Open indent</span>
          <button className="rail-file-card" onClick={() => go("sourcing")}>
            <span className="rail-file-id">{buyer.indentId}</span>
            <span className="rail-file-name">{scenario.quantity.toLocaleString("en-IN")} {scenario.unit}</span>
            <span className="rail-file-state">
              <span className="dot dot-live" /> Sourcing
            </span>
          </button>
        </div>

        <div className="rail-bottom">
          <div className="workspace">
            <span className="avatar avatar-paper">{buyer.initials}</span>
            <span className="workspace-copy">
              <strong>{buyer.workspace}</strong>
              <span>{buyer.city}</span>
            </span>
            <ChevronRight size={15} className="workspace-arrow" />
          </div>
          <p className="rail-legal">Demo workspace · illustrative supplier data</p>
        </div>
      </aside>

      {mobileOpen ? <button className="rail-scrim" onClick={() => setMobileOpen(false)} aria-label="Close menu" /> : null}

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={19} />
            </button>
            <div className="crumbs">
              <span>{view === "sourcing" ? "Sourcing" : view === "suppliers" ? "Suppliers" : view === "history" ? "Purchase history" : "Example briefs"}</span>
              <ChevronRight size={13} />
              <span className="crumb-current">
                {view === "sourcing" ? `Indent ${buyer.indentId}` : view === "suppliers" ? "Directory" : view === "history" ? "2026" : "Library"}
              </span>
            </div>
          </div>

          <div className="topbar-right">
            <label className="scenario-picker">
              <span>Industry</span>
              <select
                value={scenario.id}
                onChange={(event) => onScenario(event.target.value)}
                aria-label="Demo industry"
              >
                {SCENARIO_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {SCENARIOS[id].industry}
                  </option>
                ))}
              </select>
            </label>
            <div className={`agent-status ${statusTone}`}>
              <span className={`dot ${statusTone === "live" ? "dot-live" : statusTone === "done" ? "dot-done" : ""}`} />
              <span>{status}</span>
            </div>
            <button className="btn btn-quiet btn-small new-indent-btn" onClick={onNewIndent}>
              <Plus size={15} />
              New indent
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
