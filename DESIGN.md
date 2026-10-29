# Design System — Munshi

## The world

The procurement file, alive. Indian business paperwork — the indent, the quotation slip, the rubber stamp, the ledger — rebuilt as a calm operating surface. Warm paper ground, ink type, a deep green cover rail, and vermillion stamps reserved for the moments that matter: DRAFT, SIMULATED, RECOMMENDED. The interface should feel like a file a trusted clerk keeps for you, not a dashboard.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f3efe5` | page ground |
| `--paper-raised` | `#fbf8f0` | panels, file surfaces |
| `--paper-bright` | `#fdfaf3` | PO document paper |
| `--paper-deep` | `#e9e2d2` | insets, hover grounds, segmented controls |
| `--ink` | `#171a16` | primary type |
| `--ink-soft` | `#54574e` | secondary type |
| `--ink-faint` | `#7d7e72` | metadata, labels |
| `--rule` / `--rule-strong` | `#d8cfbc` / `#b9af9b` | hairlines, borders |
| `--rail` | `#17211c` | sidebar + call card ground |
| `--green` | `#1e5b49` | primary actions, pass states, the chosen supplier |
| `--stamp` | `#c4472f` | rubber stamps, fail states, the seal dot |
| `--amber` | `#b8802a` | warnings, negotiation notes, what-if hints |

Restrained strategy: neutrals plus green (action/pass), vermillion (attention), amber (caution). Colour carries state, never decoration.

## Type

One family — **Archivo** (variable, `wdth` 62–125). Expanded (112–114%) for display and wordmarks; normal width for body. `Noto Sans Devanagari` / `Noto Sans Gujarati` for original-script transcripts (Hindi/Marathi, Gujarati).

Scale (fixed rem, product UI): 10px micro uppercase labels → 11–12px metadata → 12.5–13px table/body-secondary → 13–14px body → 15–17px leads/inputs → 19–24px section headings → 34–58px display (clamp per breakpoint). Tracking floor −0.035em; display uses −0.035em. Nothing below 9.5px. Tabular numerals everywhere data appears.

## Components

- **File panels** — `--paper-raised` with 1px rule borders, a small folder tab pseudo-element at the top-left, `0 0 10px 10px` radius. Elevation is the border plus a soft long shadow; never both a heavy shadow and a border tint.
- **Stamps** — 1.5px currentColor border, 2px radius, 10px/800/0.13em uppercase, rotated 2–4°. Two per surface maximum.
- **Tags** — 10px uppercase chips for status (Food-grade, Negotiated); constraint dots are 7px circles (filled = pass, hollow = fail) with title tooltips.
- **Buttons** — primary: `--green` fill, 13px/650; quiet: transparent with `--rule-strong` border. 7px radius. Icon buttons 32px.
- **Verdict band** — the decision screen opens on a committed `--green` panel: paper-white headline, rationale, chips, paper-on-green primary action, and a 2×2 stat block (landed/unit, total, delivery, confidence). This is the only large colour field in the product; paper handles information, green handles the decision.
- **Industry bar** — four pill tabs (Café / Bakery / Equipment / Salon) above the brief, with a topbar select for the same switch on other screens. Each industry is a self-contained buyer + 8-supplier roster.
- **Example briefs** — prompt chips (Quick / Owner’s note / Full brief) that deliberately shift the target or deadline, so the parsed grid visibly changes inside the brief; the full library is a 2-column card grid with buyer, order constraints, prompts, called roster, and a directory link.
- **Match rationale** — the run strip's Match step and each supplier profile carry the match/screen reason. The model is not named in the UI.
- **Call card** — the one dark surface (`--rail`), 12px radius, waveform bars (green for Munshi, amber for the supplier), 13.5px transcript. The SIMULATED stamp sits in its header.
- **Levers** — 28×16 switches (green when on) + a 4-way priority segmented control on `--paper-deep`.
- **Drawers** — right-side, `min(480–580px, 94vw)`, scrim `rgba(15,20,17,.48)`, Escape to close, body scroll locked. The PO is document paper (`--paper-bright`) with terms and signature rules; line items adapt to the industry (printing/plate only when relevant, installation as the one-time charge for equipment).
- **How Munshi chose this** — a collapsed `<details>` under the comparison: formula, landed-cost table, hard-constraint matrix, and "what would change it". This is the product's audit trail, one click away.
- **Order confirmation** — after approval, a full page rather than a toast: a green "Order placed" band, a five-step vertical timeline with dates (done / active / pending nodes), an order-summary card with the cost split and advance/balance, and a "what this order teaches Munshi" memory card. The transcript defaults to the Indic original with a **Show English** toggle.

## Motion

150–250ms transitions; one authored moment per surface — the run strip's fill line eases `cubic-bezier(0.16,1,0.3,1)`, transcript lines rise 4px on entry, capture rows fade in when a field lands. Live elements pulse (status dot, waveform) and nothing else loops. `prefers-reduced-motion` collapses all durations to 0.001ms.

## Browser surfaces

Warm-paper selection (`#edc9a8`), green focus rings with 2px offset, thin warm scrollbars, green caret in inputs.

## Responsive

Structural, not typographic: rail collapses under 900px to a drawer; run grid drops to one column (strip becomes 2×2 without connector lines); comparison table becomes offer cards; memo/levers stack. Body measure stays 60–75ch for prose; data tables scroll horizontally with `min-width` floors.
