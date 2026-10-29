import { CALLS } from "./scenarios";
import type {
  ChatAnswer,
  Evidence,
  Levers,
  Offer,
  Priority,
  Recommendation,
  Scenario,
  Supplier,
} from "./types";

const WEIGHTS: Record<Priority, { cost: number; speed: number; reliability: number; verification: number }> = {
  balanced: { cost: 0.4, speed: 0.25, reliability: 0.2, verification: 0.15 },
  cost: { cost: 0.8, speed: 0.05, reliability: 0.05, verification: 0.1 },
  speed: { cost: 0.1, speed: 0.65, reliability: 0.1, verification: 0.15 },
  risk: { cost: 0.15, speed: 0.15, reliability: 0.35, verification: 0.35 },
};

export type ParsedBrief = {
  raw: string;
  quantity: number | null;
  product: string | null;
  sizeMl: number | null;
  gsm: number | null;
  budget: number | null;
  days: number | null;
  city: string | null;
  print: boolean;
  foodGrade: boolean;
  allIn: boolean;
  missing: string[];
};

const CITIES = [
  "Ahmedabad",
  "Surat",
  "Rajkot",
  "Vadodara",
  "Mumbai",
  "Pune",
  "Delhi",
  "Noida",
  "Bengaluru",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Jaipur",
  "Indore",
  "Ludhiana",
  "Nashik",
];

export function parseBrief(raw: string): ParsedBrief {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // Quantity detection: ignore prices, delivery windows, and packaging specs
  // (250 ml, 5 kg bags, 500 GSM), then prefer the first order-sized number.
  const withoutPrices = lower.replace(/₹\s*[\d,]+(?:\.\d+)?/g, " ");
  const candidates = [...withoutPrices.matchAll(/\b(\d[\d,]*)\b/g)]
    .map((match) => {
      const index = match.index ?? 0;
      const value = Number(match[1].replace(/,/g, ""));
      const before = withoutPrices.slice(Math.max(0, index - 16), index);
      const after = withoutPrices.slice(index + match[0].length, index + match[0].length + 14);
      return { value, before, after };
    })
    .filter((candidate) => {
      if (!candidate.value) return false;
      if (/^\s*(ml|gsm|mm|cm|litre|liter|%|percent|days?|din|year|years)/i.test(candidate.after)) return false;
      if (/^\s*kg\s+(bags?|packs?|sacks?)/i.test(candidate.after)) return false;
      if (/(under|below|max(?:imum)?|budget|target|per)\s*$/i.test(candidate.before)) return false;
      return true;
    });
  const orderSized = candidates.find((candidate) => candidate.value >= 100);
  let quantity: number | null = orderSized?.value ?? candidates[0]?.value ?? null;
  if (!quantity) {
    const words: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
      nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, fifty: 50,
    };
    const wordMatch = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|fifty)\b/);
    if (wordMatch) quantity = words[wordMatch[1]];
  }
  if (!quantity) {
    const fallback = [...lower.matchAll(/\b([\d,]{1,})\b/g)]
      .map((m) => Number(m[1].replace(/,/g, "")))
      .filter((n) => n >= 1 && n <= 1000000);
    if (fallback.length) quantity = Math.max(...fallback);
  }

  const budgetMatch =
    lower.match(/(?:under|below|max(?:imum)?|budget(?: of)?|target(?: of)?|≤|<=)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)/i) ||
    lower.match(/₹\s*(\d[\d,]*(?:\.\d+)?)\s*(?:per|\/)\s*(?:cup|piece|unit|bag|lid|kg|towel|range)/i);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : null;

  const daysMatch =
    lower.match(/(?:within|in|delivery(?: in)?|lead time(?: of)?)\s*(\d+)\s*(?:days?|din|दिन)/i) ||
    lower.match(/(\d+)\s*(?:days?|din|दिन)/i);
  const days = daysMatch ? Number(daysMatch[1]) : null;

  const city = CITIES.find((c) => lower.includes(c.toLowerCase())) ?? null;
  const sizeMatch = lower.match(/(\d+)\s*ml\b/i);
  const sizeMl = sizeMatch ? Number(sizeMatch[1]) : null;
  const gsmMatch = lower.match(/(\d+)\s*gsm\b/i);
  const gsm = gsmMatch ? Number(gsmMatch[1]) : null;

  let product: string | null = null;
  if (/paper\s+cups?|\bcups?\b/i.test(lower)) product = "Paper cups";
  else if (/refined\s+flour|\bmaida\b|\bflour\b/i.test(lower)) product = "Refined flour (maida)";
  else if (/gas\s+ranges?|four[- ]burner|commercial\s+range/i.test(lower)) product = "Commercial gas range";
  else if (/towels?/i.test(lower)) product = "Cotton towels";
  else if (/\b(kraft\s+)?bags?\b/i.test(lower)) product = "Kraft bags";
  else if (/\blids?\b/i.test(lower)) product = "Cup lids";
  else if (/\bnapkins?\b/i.test(lower)) product = "Napkins";
  else if (/\bcartons?\b|\bboxes?\b/i.test(lower)) product = "Cartons";

  const print = /\b(two|2)[- ]?colou?r|\blogo\s+print|\bprinted\b/i.test(lower);
  const foodGrade = /food[- ]?grade|fssai|bakery[- ]?grade|food safe/i.test(lower);
  const allIn = /all[- ]?in|landed|including\s+gst|incl\.?\s+gst/i.test(lower);

  const missing: string[] = [];
  if (!quantity) missing.push("quantity");
  if (!product) missing.push("product");
  if (!budget) missing.push("target price");
  if (!days) missing.push("delivery window");
  if (!city) missing.push("delivery city");

  return {
    raw,
    quantity,
    product,
    sizeMl,
    gsm,
    budget,
    days,
    city,
    print,
    foodGrade,
    allIn,
    missing,
  };
}

export function formatINR(value: number, options?: { decimals?: number; compact?: boolean }) {
  if (options?.compact && value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: options?.decimals ?? 0,
    maximumFractionDigits: options?.decimals ?? 0,
  }).format(value);
}

export function formatPerUnit(value: number) {
  return `₹${value.toFixed(2)}`;
}

export function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function defaultLevers(scenario: Scenario): Levers {
  return {
    budget: true,
    delivery: true,
    certification: true,
    priority: "balanced",
    budgetCap: scenario.budgetDefault,
    deadline: scenario.daysDefault,
    budgetBase: scenario.budgetDefault,
    deadlineBase: scenario.daysDefault,
  };
}

export function evaluateOffers(scenario: Scenario, levers: Levers): Offer[] {
  const supplierMap = new Map(scenario.suppliers.map((s) => [s.id, s]));
  const quantity = scenario.quantity;

  const raw = scenario.callOrder.map((id) => {
    const supplier = supplierMap.get(id)!;
    const quote = { ...scenario.quotes[id], quantity };
    const goodsCost = quantity * quote.base;
    const printCost = quantity * quote.print;
    const oneTimeCost = quote.plate;
    const freightCost = quote.freight;
    const subtotal = goodsCost + printCost + oneTimeCost + freightCost;
    const gst = subtotal * quote.gstRate;
    const total = subtotal + gst;
    const landed = total / quantity;

    const relaxedBudget = levers.budgetBase * 1.18;
    const relaxedDeadline = levers.deadlineBase + 3;
    const budgetPass = landed <= (levers.budget ? levers.budgetCap : relaxedBudget) + 0.0001;
    const deliveryPass = quote.leadDays <= (levers.delivery ? levers.deadline : relaxedDeadline);
    const moqPass = quote.effectiveMoq <= quantity;
    const specPass = quote.specOk !== false;
    const certificationPass =
      supplier.gstStatus === "active" && (!scenario.requiresFoodGrade || supplier.foodGrade);

    const constraints = [
      {
        key: "budget" as const,
        label: "Budget",
        pass: budgetPass,
        detail: `${formatPerUnit(landed)} vs ${formatPerUnit(levers.budget ? levers.budgetCap : relaxedBudget)} ceiling`,
        hard: true,
      },
      {
        key: "delivery" as const,
        label: "Delivery",
        pass: deliveryPass,
        detail: `${quote.leadDays} days vs ${levers.delivery ? levers.deadline : relaxedDeadline}-day deadline`,
        hard: true,
      },
      {
        key: "moq" as const,
        label: "MOQ",
        pass: moqPass,
        detail: quote.moqNote ?? `${quote.effectiveMoq.toLocaleString("en-IN")} ${scenario.unit}`,
        hard: true,
      },
      {
        key: "spec" as const,
        label: scenario.specLabel,
        pass: specPass,
        detail: quote.specDetail ?? scenario.specLabel,
        hard: true,
      },
      {
        key: "certification" as const,
        label: scenario.requiresFoodGrade ? "Food-grade" : "Verification",
        pass: certificationPass,
        detail: certificationPass ? "Certificate on file" : "Missing or inactive",
        hard: false,
      },
    ];

    const hardFails = constraints.filter((c) => c.hard && !c.pass).length;

    return {
      supplier,
      quote,
      goodsCost,
      printCost,
      oneTimeCost,
      freightCost,
      subtotal,
      gst,
      total,
      landed,
      constraints,
      hardFails,
      feasible: hardFails === 0,
      score: 0,
      costScore: 0,
      speedScore: 0,
    } satisfies Offer;
  });

  const landeds = raw.map((o) => o.landed);
  const leads = raw.map((o) => o.quote.leadDays);
  const bestLanded = Math.min(...landeds);
  const worstLanded = Math.max(...landeds);
  const bestLead = Math.min(...leads);
  const worstLead = Math.max(...leads);

  return raw
    .map((offer) => {
      const costScore =
        worstLanded === bestLanded ? 100 : ((worstLanded - offer.landed) / (worstLanded - bestLanded)) * 100;
      const speedScore =
        worstLead === bestLead ? 100 : ((worstLead - offer.quote.leadDays) / (worstLead - bestLead)) * 100;
      const w = WEIGHTS[levers.priority];
      const rawScore =
        w.cost * costScore +
        w.speed * speedScore +
        w.reliability * offer.supplier.onTime +
        w.verification * offer.supplier.verificationScore;
      const score = Math.max(0, Math.min(100, rawScore - offer.hardFails * 18));
      return { ...offer, costScore, speedScore, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((offer, index) => ({ ...offer, rank: index + 1 }));
}

function withUnit(value: number, unitShort: string) {
  return `${formatPerUnit(value)}/${unitShort}`;
}

function tradeoffBetween(offer: Offer, baseline: Offer, scenario: Scenario) {
  const costDelta = baseline.total - offer.total;
  const leadDelta = baseline.quote.leadDays - offer.quote.leadDays;
  const parts: string[] = [];
  if (Math.abs(costDelta) >= 1) {
    parts.push(
      costDelta > 0
        ? `${formatINR(costDelta)} cheaper`
        : `${formatINR(Math.abs(costDelta))} more expensive`
    );
  }
  if (leadDelta !== 0) {
    parts.push(`${Math.abs(leadDelta)} day${Math.abs(leadDelta) === 1 ? "" : "s"} ${leadDelta > 0 ? "faster" : "slower"}`);
  }
  if (!parts.length) parts.push("a different risk profile");
  return parts.join(", ");
}

export function recommend(offers: Offer[], levers: Levers, scenario: Scenario): Recommendation {
  const feasible = offers.filter((o) => o.feasible);
  const recommended = feasible[0] ?? offers[0] ?? null;
  const baseline = offers.find((o) => o.supplier.id === scenario.callOrder[0]) ?? offers[0];
  const confidence = recommended ? Math.round(60 + recommended.score * 0.3) : 0;

  let changed: string | null = null;
  if (recommended && baseline && recommended.supplier.id !== baseline.supplier.id) {
    changed = `${recommended.supplier.name} now leads at ${withUnit(
      recommended.landed,
      scenario.unitShort
    )}. It is ${tradeoffBetween(recommended, baseline, scenario)} against ${baseline.supplier.shortName}.`;
  }

  let rationale = "No offer clears every hard constraint. The closest options are shown with the exact trade-off.";
  if (recommended) {
    if (feasible.length === 1) {
      const negoti = recommended.quote.negotiation;
      rationale = `${recommended.supplier.name} is the only offer that clears every hard constraint. It lands at ${withUnit(
        recommended.landed,
        scenario.unitShort
      )}, delivers in ${recommended.quote.leadDays} days, and ${
        negoti
          ? `Munshi negotiated the ${negoti.label} from ${formatINR(negoti.from)} to ${formatINR(negoti.to)}.`
          : `scores highest on your current priority.`
      }`;
    } else {
      const runnerUp = feasible[1];
      rationale = `${recommended.supplier.name} clears every hard constraint and ranks highest on your priority. It lands at ${withUnit(
        recommended.landed,
        scenario.unitShort
      )} and delivers in ${recommended.quote.leadDays} days.${
        runnerUp
          ? ` ${runnerUp.supplier.shortName} is ${tradeoffBetween(runnerUp, recommended, scenario)}.`
          : ""
      }`;
    }
  }

  return {
    offers,
    feasible,
    recommended,
    confidence,
    headline: recommended
      ? `${recommended.supplier.name} · ${withUnit(recommended.landed, scenario.unitShort)} landed`
      : "No compliant offer",
    rationale,
    changed,
  };
}

export function callFor(scenario: Scenario, supplierId: string) {
  return CALLS[scenario.callOrder.find((id) => id === supplierId) ?? ""] ?? null;
}

export function evidenceFor(scenario: Scenario, supplierId: string): Evidence[] {
  const call = callFor(scenario, supplierId);
  if (!call) return [];
  return call.lines
    .filter((line) => line.captures.length > 0 && line.speaker === "supplier")
    .map((line) => ({
      id: `ev-${line.id}`,
      supplierId: call.supplierId,
      callId: call.id,
      lineId: line.id,
      at: line.at,
      speaker: line.speaker,
      quote: line.display,
      field: line.captures.join(", "),
    }));
}

export function supplierById(scenario: Scenario, id: string): Supplier {
  return scenario.suppliers.find((s) => s.id === id)!;
}

export function answerQuestion(
  question: string,
  offers: Offer[],
  levers: Levers,
  recommendation: Recommendation,
  scenario: Scenario
): ChatAnswer {
  const q = question.toLowerCase();
  const recommended = recommendation.recommended ?? offers[0];
  const byCost = [...offers].sort((a, b) => a.landed - b.landed);
  const bySpeed = [...offers].sort((a, b) => a.quote.leadDays - b.quote.leadDays);
  const cheapest = byCost[0];
  const fastest = bySpeed[0];
  const runnerUp = recommendation.feasible.find((o) => o.supplier.id !== recommended?.supplier.id);

  const cite = (id: string) => {
    const evidence = evidenceFor(scenario, id);
    const first = evidence[0];
    const supplier = scenario.suppliers.find((s) => s.id === id);
    return first && supplier
      ? [{ label: `${supplier.shortName} call · ${first.at}`, lineId: first.lineId }]
      : supplier
        ? [{ label: `${supplier.shortName} profile` }]
        : [];
  };

  if (!recommended) {
    return {
      text: "No offer clears the hard constraints on this brief. I can show you which constraint each offer misses and what relaxing it would cost.",
      citations: [{ label: "Constraint check" }],
      action: "levers",
    };
  }

  const namedOffer = offers.find(
    (o) =>
      q.includes(o.supplier.shortName.toLowerCase()) ||
      q.includes(o.supplier.name.toLowerCase().split(" ")[0])
  );

  if (/(why not|why is|cheapest|cheaper|price)/i.test(q)) {
    const target = namedOffer ?? cheapest;
    if (target.supplier.id === recommended.supplier.id) {
      return {
        text: `${target.supplier.name} is the recommended offer — it is the best fit on your current priority, not just the cheapest sticker price. It lands at ${withUnit(
          target.landed,
          scenario.unitShort
        )} with a ${target.quote.leadDays}-day lead.`,
        citations: cite(target.supplier.id),
      };
    }
    const failed = target.constraints.filter((c) => c.hard && !c.pass);
    return {
      text: `${target.supplier.name} lands at ${withUnit(target.landed, scenario.unitShort)} — ${
        target.landed < recommended.landed
          ? `${formatINR(recommended.total - target.total)} cheaper overall`
          : `${formatINR(target.total - recommended.total)} more expensive overall`
      } — but it fails ${failed.map((c) => c.label).join(", ") || "no hard constraint"}. ${
        failed.find((c) => c.key === "delivery")
          ? `Its ${target.quote.leadDays}-day lead misses your ${levers.deadline}-day deadline.`
          : ""
      } If you relax that constraint, I will re-rank it.`,
      citations: [...cite(target.supplier.id), { label: "Constraint check" }],
      action: "levers",
    };
  }

  if (/risk|safe|reliable|trust|warranty|certif/i.test(q)) {
    const negoti = recommended.quote.negotiation;
    const risks = [
      ...(recommended.oneTimeCost > 0 && recommended.quote.oneTimeNote ? [recommended.quote.oneTimeNote] : []),
      recommended.quote.payment.toLowerCase(),
      `a quote valid for ${recommended.quote.validityDays} days`,
    ];
    return {
      text: `${recommended.supplier.name} is the safest feasible option here. GSTIN is ${
        recommended.supplier.gstStatus === "active" ? "active" : "inactive"
      }, ${recommended.supplier.certifications.slice(0, 2).join(" and ")} are on file, and it has delivered ${
        recommended.supplier.orders
      } orders with a ${recommended.supplier.onTime}% on-time record. The open risks: ${risks
        .map((r) => r.replace(/\.$/, ""))
        .join("; ")}.${negoti ? ` I already negotiated the ${negoti.label} from ${formatINR(negoti.from)} to ${formatINR(negoti.to)}.` : ""}`,
      citations: [
        ...cite(recommended.supplier.id),
        { label: "Supplier verification" },
      ],
    };
  }

  if (/negotiat|discount|reduce|better rate|concession/i.test(q)) {
    const negoti = recommended.quote.negotiation;
    if (negoti) {
      return {
        text: `I already moved the ${negoti.label} from ${formatINR(negoti.from)} to ${formatINR(
          negoti.to
        )} — worth ${formatINR(negoti.saved)} after tax. ${negoti.note} Further pressure would likely trade away the ${recommended.quote.leadDays}-day delivery.`,
        citations: cite(recommended.supplier.id),
      };
    }
    return {
      text: `The quote held at ${formatINR(recommended.quote.base)} per ${scenario.unitShort}. I can ask for a concession on a larger order, but pushing this one further would likely trade away the ${recommended.quote.leadDays}-day delivery.`,
      citations: cite(recommended.supplier.id),
    };
  }

  if (/fast|urgent|quick|lead time/i.test(q)) {
    return {
      text: `${fastest.supplier.name} is the fastest offer at ${fastest.quote.leadDays} days, landing at ${withUnit(
        fastest.landed,
        scenario.unitShort
      )}. That is ${formatINR(fastest.total - recommended.total)} ${
        fastest.total >= recommended.total ? "more" : "less"
      } than ${recommended.supplier.shortName}. It is the right choice only if the shorter lead is worth the difference.`,
      citations: cite(fastest.supplier.id),
    };
  }

  if (/deadline|wait|relax|delay|late/i.test(q)) {
    const late = offers.find(
      (o) => o.constraints.find((c) => c.key === "delivery" && !c.pass) && o.landed <= recommended.landed
    );
    return {
      text: late
        ? `If you extend the delivery window to ${levers.deadlineBase + 3} days, ${late.supplier.name} becomes feasible at ${withUnit(
            late.landed,
            scenario.unitShort
          )} — ${formatINR(recommended.total - late.total)} ${
            recommended.total > late.total ? "cheaper" : "more expensive"
          } than ${recommended.supplier.shortName}. The trade-off is its ${late.supplier.onTime}% on-time record and ${late.quote.payment.toLowerCase()}.`
        : `Every offer already fits the ${levers.deadline}-day window. The binding constraint is ${
            recommended.constraints.find((c) => !c.pass)?.label ?? "price"
          }.`,
      citations: late ? cite(late.supplier.id) : [{ label: "Constraint check" }],
      action: "levers",
    };
  }

  if (/po|purchase order|approve|order/i.test(q)) {
    return {
      text: `I can draft the purchase order for ${recommended.supplier.name}: ${scenario.quantity.toLocaleString(
        "en-IN"
      )} ${scenario.unit} at ${withUnit(recommended.landed, scenario.unitShort)}, ${formatINR(
        recommended.total
      )} total including GST, ${recommended.quote.payment.toLowerCase()}. You still approve it — I will not send anything until you do.`,
      citations: cite(recommended.supplier.id),
      action: "po",
    };
  }

  if (/compare|summary|difference|all three/i.test(q)) {
    return {
      text: offers
        .map(
          (o) =>
            `${o.supplier.shortName}: ${withUnit(o.landed, scenario.unitShort)} · ${o.quote.leadDays} days · ${
              o.feasible ? "feasible" : `${o.hardFails} constraint${o.hardFails === 1 ? "" : "s"} failed`
            }`
        )
        .join(" | ") + `. ${recommended.supplier.shortName} is the current recommendation.`,
      citations: [{ label: "Three normalised offers" }],
    };
  }

  if (/spec|install|warranty|cotton|colour|color|fssai|food.grade|gsm|print|plate/i.test(q)) {
    return {
      text: `${recommended.supplier.name} confirms ${recommended.quote.specDetail ?? scenario.specLabel}. ${
        recommended.quote.oneTimeNote ?? ""
      } The quote is ${formatINR(recommended.total)} total, or ${withUnit(
        recommended.landed,
        scenario.unitShort
      )} landed.`,
      citations: cite(recommended.supplier.id),
    };
  }

  if (/who|supplier|profile|gst/i.test(q)) {
    return {
      text: `${recommended.supplier.name} is a ${recommended.supplier.category.toLowerCase()} supplier in ${recommended.supplier.area}, ${
        recommended.supplier.city
      }, running since ${recommended.supplier.since}. GSTIN is ${recommended.supplier.gstStatus}, and the relationship note says: “${
        recommended.supplier.relationship
      }”. It quoted ${formatINR(recommended.quote.base)} per ${scenario.unitShort} plus ${formatINR(
        recommended.quote.freight
      )} freight and ${pct(recommended.quote.gstRate)} GST.`,
      citations: cite(recommended.supplier.id),
    };
  }

  return {
    text: `I can answer that from the sourcing file. The current recommendation is ${recommended.supplier.name} at ${withUnit(
      recommended.landed,
      scenario.unitShort
    )}. Ask me about the trade-off, the negotiation, the supplier's reliability, or say “draft the PO”.`,
    citations: [{ label: `Indent ${scenario.buyer.indentId}` }],
  };
}
