"use client";

import { Check, CircleCheck, Truck } from "lucide-react";
import { formatINR, formatPerUnit } from "@/lib/engine";
import type { Offer, Scenario } from "@/lib/types";
import { Stamp, SupplierMark } from "./ui";

const BASE = new Date("2026-10-29T10:42:00+05:30");

function money(value: number) {
  return value >= 1000 ? formatINR(value) : formatPerUnit(value);
}

function addDays(days: number) {
  const date = new Date(BASE);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function OrderConfirmation({
  scenario,
  offer,
  onBack,
  onNewIndent,
  onViewPo,
}: {
  scenario: Scenario;
  offer: Offer;
  onBack: () => void;
  onNewIndent: () => void;
  onViewPo: () => void;
}) {
  const advancePct = Number(offer.quote.payment.match(/(\d+)%/)?.[1] ?? 30) / 100;
  const advance = offer.total * advancePct;
  const balance = offer.total - advance;
  const delivery = addDays(offer.quote.leadDays);
  const repeatPrice =
    offer.oneTimeCost > 0
      ? ((offer.subtotal - offer.oneTimeCost) * (1 + offer.quote.gstRate)) / offer.quote.quantity
      : null;

  return (
    <div className="order-shell">
      <div className="decision-file order-file">
        <div className="file-head">
          <div className="file-head-left">
            <span className="file-id">ORDER / {scenario.buyer.indentId}-01</span>
            <span className="file-date">Placed {scenario.buyer.date} · demo order</span>
          </div>
          <Stamp tone="green" rotate={2}>
            Confirmed
          </Stamp>
        </div>

        <div className="order-band">
          <div className="order-band-icon">
            <CircleCheck size={26} />
          </div>
          <div className="order-band-copy">
            <h1>Order placed.</h1>
            <p>
              Confirmed with {offer.supplier.name} · delivery by {delivery}.
            </p>
            <div className="order-band-meta">
              <span>PO {scenario.buyer.indentId}-01</span>
              <span>
                {scenario.quantity.toLocaleString("en-IN")} {scenario.unit} · {money(offer.landed)}/
                {scenario.unitShort} landed
              </span>
              <span>{formatINR(offer.total)} total</span>
            </div>
          </div>
          <div className="order-band-side">
            <span className="order-band-label">Delivery</span>
            <strong>{delivery}</strong>
            <em>Confirmed · demo</em>
          </div>
        </div>
      </div>

      <div className="order-status-card" aria-label="Order status">
        <div className="order-status-step is-done">
          <span className="order-status-node">
            <Check size={13} />
          </span>
          <div>
            <strong>Placed</strong>
            <em>{scenario.buyer.date} · 10:42 AM</em>
          </div>
        </div>
        <span className="order-status-line is-done" />
        <div className="order-status-step is-done">
          <span className="order-status-node">
            <Check size={13} />
          </span>
          <div>
            <strong>Confirmed</strong>
            <em>{offer.supplier.shortName}</em>
          </div>
        </div>
        <span className="order-status-line" />
        <div className="order-status-step is-next">
          <span className="order-status-node">
            <Truck size={13} />
          </span>
          <div>
            <strong>Delivery</strong>
            <em>by {delivery}</em>
          </div>
        </div>
      </div>

      <div className="order-simple-grid">
        <section className="order-summary-card">
          <div className="order-summary-head">
            <h2>Order summary</h2>
            <SupplierMark supplier={offer.supplier} size={34} />
          </div>
          <div className="order-summary-supplier">
            <strong>{offer.supplier.name}</strong>
            <span>
              {offer.supplier.area}, {offer.supplier.city} · GSTIN {offer.supplier.gstin}
            </span>
          </div>
          <dl className="order-costs">
            <div>
              <dt>Total payable</dt>
              <dd>{formatINR(offer.total)}</dd>
            </div>
            <div>
              <dt>Advance · {Math.round(advancePct * 100)}%</dt>
              <dd>{formatINR(advance)}</dd>
            </div>
            <div>
              <dt>Balance on delivery</dt>
              <dd>{formatINR(balance)}</dd>
            </div>
          </dl>
          <div className="order-summary-foot">
            <span>
              {offer.quote.payment} · quote valid {offer.quote.validityDays} days
            </span>
          </div>
        </section>

        <section className="order-next-card">
          <div className="order-section-head">
            <h2>Saved to supplier memory</h2>
            <Check size={16} />
          </div>
          <p className="order-memory-line">
            {repeatPrice ? `Repeat price ${money(repeatPrice)}/${scenario.unitShort} · ` : ""}
            {offer.supplier.onTime}% on-time · this preference is saved for the next indent.
          </p>
          <div className="order-next-actions">
            <button className="btn btn-primary" onClick={onNewIndent}>
              Start a repeat indent
            </button>
            <button className="btn btn-quiet" onClick={onViewPo}>
              View PO
            </button>
            <button className="btn btn-quiet" onClick={onBack}>
              Back to decision
            </button>
          </div>
          <p className="order-disclaimer">
            Demo order. No payment was taken and no goods will ship.
          </p>
        </section>
      </div>
    </div>
  );
}
