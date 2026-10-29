# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript. Chosen by the user for the internship hackathon submission. No database: the demo runs on an authored, clearly labelled in-memory dataset. Gnani Prisma v3.0 is the only speech-to-text model and Gnani Timbre v3.0 the only text-to-speech model. **Mistral Small 4** (`mistral-small-2603`) is used only for supplier matching/screening, with a local-rules fallback. The economic decision — landed cost, hard constraints, weighted ranking — is deterministic and inspectable, not an LLM judgement.

## Users

Owners and operators of small Indian businesses. The demo follows four buyers across four industries: a café in Ahmedabad buying branded packaging, a bakery in Pune buying refined flour, a restaurant in Delhi buying commercial gas ranges, and a salon in Mumbai buying cotton towels. They are not procurement specialists. They source repeatedly, usually from a phone or a laptop in a busy back office, and they carry the whole purchase in their head: calls, rates, MOQs, advance payments, delivery promises.

## Product Purpose

Munshi is a buyer-side AI procurement agent. A buyer describes a purchase in natural language. Munshi turns it into a structured indent, screens a curated supplier directory, calls suppliers, asks the questions a good buyer would ask, normalises every offer to a comparable landed cost, verifies what it can, and returns a decision memo with evidence. The buyer approves the supplier and the purchase; Munshi never commits spend on its own. Success is a confident purchasing decision in minutes, with the reasoning and the supplier's own words attached.

## Positioning

Most B2B marketplaces stop at discovery and sell supplier leads. Munshi works for the buyer after discovery: it runs the outreach, fills missing quote details, negotiates, normalises hidden costs, checks constraints, and explains the trade-off between the cheapest offer and the right one. The durable asset is a buyer-side memory of supplier responsiveness, quoted prices, delivery reliability, and buyer preferences.

## Operating Context

Four demo indents, each with a different buyer, supplier roster, quote set, and recommendation: café packaging (5,000 cups, ₹2/cup, 7 days), bakery ingredients (500 kg maida, ₹38/kg, 5 days), restaurant equipment (2 gas ranges, ₹28,000/range, 10 days), and salon linen (1,000 towels, ₹55/towel, 7 days). Each industry has 8 suppliers (3 called, 5 screened). Offers include per-unit price, printing where relevant, one-time charges (plate/installation), freight, GST, MOQ, lead time, payment terms, quote validity, and certifications. Supplier calls are scripted (disclosed in the demo tweet/README); the voices are real Gnani Timbre output. There is no payment processing and no live telephony. The buyer can approve a simulated purchase order, adjust constraints, and ask follow-up questions.

## Capabilities and Constraints

- Voice-first intake: browser microphone → Gnani Prisma v3.0 (automatic Indic language detection) → editable brief.
- Deterministic brief parser for quantity, product, target price, delivery window, city, print, and certification.
- **Mistral Small 4 supplier matching** over each industry's 8-supplier roster; returns 3 shortlisted suppliers plus a concrete reason for every screened supplier. Local-rules fallback if the model is unavailable.
- Curated supplier directory with verification state and relationship history; 4 industries, 32 suppliers.
- Scripted supplier calls with real Gnani Timbre voices in Gujarati, Marathi, and Hindi, plus an English/original transcript toggle.
- Live quote capture, landed-cost normalisation, constraint checks, risk flags, and evidence links.
- Constraint-aware recommendation with buyer-controlled levers (budget, deadline, certification, priority).
- Decision memo, "How Munshi chose this" workings, supplier comparison, follow-up Q&A, demo PO, and a post-approval order-status page with a delivery timeline, advance/balance, and supplier-memory update.
- Examples library with three prompt variants per industry.
- No real supplier data, no live calls, no payments, no automated purchasing. All supplier names, quotes, certifications, GSTIN states, and histories are illustrative demo data and are labelled as such in the interface.

## Brand Commitments

The user's framing is the source of truth: an AI-native IndiaMART where the agent works for the buyer and helps them make a purchasing decision, not a three-supplier price-comparison demo. Product name and agent name are open; this build uses "Munshi" for the agent and "Indent" for the purchase brief. Indian-language support, buyer control, and evidence-backed recommendations are binding.

## Evidence on Hand

The user supplied a written concept, a café packaging example, and a Gnani API key. No real supplier quotes, customer logos, testimonials, benchmarks, or production data exist. Every number in the demo is authored illustrative material. The build must not present it as a real market claim.

## Product Principles

1. The agent does the work after discovery, not just the search.
2. Matching is LLM-assisted; the economic decision is deterministic and inspectable.
3. Every recommendation shows its evidence and its trade-offs.
4. Hard constraints are respected; the buyer decides when to relax them.
5. The buyer keeps the pen: Munshi recommends, the buyer approves.
6. Every successful purchase should make the next one better.

## Accessibility & Inclusion

The interface must work with keyboard and screen reader, maintain 4.5:1 body contrast, respect reduced-motion preferences, and remain usable at 390 px. Hindi, Marathi, and Gujarati transcript text must render in proper script fonts, with an English translation available.
