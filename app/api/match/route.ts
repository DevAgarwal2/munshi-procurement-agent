import { NextRequest, NextResponse } from "next/server";
import { defaultLevers, evaluateOffers } from "@/lib/engine";
import { scenarioById } from "@/lib/scenarios";
import type { MatchResult, Scenario } from "@/lib/types";

export const runtime = "nodejs";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MODEL = "mistral-small-2603";
const cache = new Map<string, MatchResult>();

function key() {
  return process.env.MISTRAL_API_KEY || process.env.mistral_api_key || "";
}

function summary(scenario: Scenario) {
  return scenario.suppliers.map((supplier) => {
    const quote = scenario.quotes[supplier.id];
    return {
      id: supplier.id,
      name: supplier.name,
      city: supplier.city,
      category: supplier.category,
      products: supplier.products,
      certifications: supplier.certifications,
      foodGrade: supplier.foodGrade,
      gstActive: supplier.gstStatus === "active",
      onTime: supplier.onTime,
      orders: supplier.orders,
      rating: supplier.rating,
      moq: quote?.effectiveMoq ?? supplier.moq ?? null,
      leadDays: quote?.leadDays ?? supplier.leadDays ?? null,
      hasQuote: Boolean(quote),
      quoteSummary: quote
        ? {
            unitPrice: quote.base,
            freight: quote.freight,
            gstRate: quote.gstRate,
            payment: quote.payment,
            validityDays: quote.validityDays,
            moqNote: quote.moqNote ?? null,
          }
        : null,
    };
  });
}

function localMatch(scenario: Scenario, note?: string): MatchResult {
  const offers = evaluateOffers(scenario, defaultLevers(scenario));
  return {
    shortlist: scenario.callOrder.map((id) => {
      const offer = offers.find((o) => o.supplier.id === id);
      const supplier = scenario.suppliers.find((s) => s.id === id)!;
      return {
        id,
        fit: Math.round(offer?.score ?? 70),
        reason: supplier.note,
      };
    }),
    excluded: scenario.screenedOut.map((item) => ({
      id: item.supplierId,
      reason: item.reason,
    })),
    source: "local",
    model: "local-rules",
    note,
  };
}

function normalise(scenario: Scenario, payload: unknown): MatchResult | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as {
    shortlist?: { id?: string; fit?: number; reason?: string }[];
    excluded?: { id?: string; reason?: string }[];
  };
  const callable = new Set(scenario.callOrder);
  const shortlist = (raw.shortlist ?? [])
    .filter((item) => item?.id && callable.has(item.id))
    .map((item) => ({
      id: item.id!,
      fit: Math.max(0, Math.min(100, Math.round(Number(item.fit) || 70))),
      reason: String(item.reason ?? "").slice(0, 220),
    }));
  if (shortlist.length < 3) return null;
  const seen = new Set<string>();
  const unique = shortlist.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (unique.length < 3) return null;
  const excluded = (raw.excluded ?? [])
    .filter((item) => item?.id && scenario.suppliers.some((s) => s.id === item.id) && !callable.has(item.id))
    .map((item) => ({ id: item.id!, reason: String(item.reason ?? "").slice(0, 220) }));
  const mergedExcluded = scenario.screenedOut.map((item) => {
    const fromMistral = excluded.find((e) => e.id === item.supplierId);
    return fromMistral ?? { id: item.supplierId, reason: item.reason };
  });
  return {
    shortlist: unique.slice(0, 3),
    excluded: mergedExcluded,
    source: "mistral",
    model: MODEL,
  };
}

export async function POST(req: NextRequest) {
  let body: { scenarioId?: string; brief?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const scenario = scenarioById(body.scenarioId ?? "cafe");
  const brief = (body.brief ?? "").trim();
  if (!brief) return NextResponse.json({ error: "A brief is required." }, { status: 400 });

  const cacheKey = `v2:${scenario.id}:${brief}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  if (!key()) {
    const fallback = localMatch(scenario, "MISTRAL_API_KEY is not configured.");
    cache.set(cacheKey, fallback);
    return NextResponse.json(fallback);
  }

  const suppliers = summary(scenario);
  const system = `You are Munshi's supplier-matching step for Indian B2B procurement.
Match a buyer's brief to suppliers using only the fields provided. Do not invent prices, certifications, or capabilities.
Return JSON only, with no markdown:
{"shortlist":[{"id":"supplier id","fit":0-100,"reason":"<= 18 words, concrete"}],"excluded":[{"id":"supplier id","reason":"<= 18 words, concrete"}]}
Rules:
- shortlist must contain exactly the 3 suppliers with hasQuote=true, ordered best-first for this brief.
- never shortlist a supplier with hasQuote=false.
- excluded must contain every hasQuote=false supplier, with the concrete reason it is screened out for this brief.
- reason must reference product, city, MOQ, lead time, certification, or reliability — not generic praise.
- fit is relative to this brief, not a general supplier rating.
- never quote a price, rupee amount, or landed cost in a reason. Reasons must be qualitative and reference only product, city, MOQ, lead time, certification, or reliability.
- excluded must contain every hasQuote=false supplier.`;

  const user = `Buyer brief:
${brief}

Demo scenario: ${scenario.industry} · ${scenario.buyer.workspace}, ${scenario.buyer.city}
Demo order: ${scenario.quantity} ${scenario.unit} · target ₹${scenario.budgetDefault}/${scenario.unitShort} landed · ${scenario.daysDefault}-day deadline
Required spec: ${scenario.specLabel}
Screened suppliers to explain: ${scenario.suppliers.length - scenario.callOrder.length}

Suppliers:
${JSON.stringify(suppliers, null, 2)}`;

  try {
    const res = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      const fallback = localMatch(scenario, `Mistral returned ${res.status}: ${detail.slice(0, 160)}`);
      cache.set(cacheKey, fallback);
      return NextResponse.json(fallback);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start >= 0 && end > start) parsed = JSON.parse(content.slice(start, end + 1));
    }

    const result = normalise(scenario, parsed);
    if (!result) {
      const fallback = localMatch(scenario, "Mistral returned an unreadable match; local rules used.");
      cache.set(cacheKey, fallback);
      return NextResponse.json(fallback);
    }

    cache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const fallback = localMatch(
      scenario,
      `Mistral unavailable: ${error instanceof Error ? error.message.slice(0, 160) : "network error"}`
    );
    cache.set(cacheKey, fallback);
    return NextResponse.json(fallback);
  }
}
