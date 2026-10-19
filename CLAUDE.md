# EnergyX Trust Layer — project rules for Claude Code

Read this file before writing any code. It is the contract for this repo.
If a request conflicts with a rule here, say so before you build.

**This file replaced an earlier version that described a concept redesign of
energyx.com. That project is cancelled.** EnergyX shipped a new Next.js site in
early October 2026. Building a competing redesign of work their CMO just shipped
is the wrong move. Do not build hero sections, scroll stories, globes, splat
viewers or mirrored page structures. If you find references to those, they are stale.

---

## 1. What this is

A private, password-protected technical demo built by Raj Purohith Arjun for the
AI Engineer interview at EnergyX. It is shown to Teague Egan (CEO), Kellee Khalil
(CMO) and Luke Gustafson (design/3D). It is **not** an official EnergyX communication
and it is **not** a redesign of their site.

### The argument it makes

EnergyX has 40,000+ retail shareholders, an active Reg A+ raise and an IPO ahead.
Three things are true of their public information today, all measured:

1. **It contradicts itself.** Their own pages have shown different patent counts.
   (Verify current state before relying on this; if the conflict was fixed in the
   rebuild, use whatever conflicts do exist, or drop the claim.)
2. **It is too heavy to reach people.** Lighthouse mobile, Slow 4G, Oct 8 2026:
   homepage Performance 55, LCP 5.9s, 32.9 MB total — 27.7 MB of it a hero video
   served from a Box shared link. `/black-giant/` Performance 50, LCP 7.5s,
   48.3 MB total — a single 39.9 MB autoplaying video that is itself the LCP element,
   plus a second 7.9 MB video on the same page.
3. **It is invisible to AI.** No `llms.txt`, no `ai-catalog.json`, no WebMCP tools
   registered. Lighthouse 13.5 scores `/black-giant/` 1/2 on Agentic Browsing.
   Retail investors increasingly research by asking a model.

The demo fixes all three with one idea: make EnergyX's public information
consistent, cited, fast and machine-readable.

### Tone rule about Luke

The videos are Luke's work and he is the internal advocate for this candidate.
The problem is never the content or the production value — it is that no delivery
pipeline sits between his output and the browser. Never phrase it any other way,
in code comments, copy, or the demo script.

---

## 2. Non-negotiable rules

1. **No typed numbers.** Every business claim renders through `<Fact id="..." />`
   reading `content/facts.json`. `scripts/lint-facts.ts` fails the build on
   violations. Allowlist: years, ISO dates, list numbering, CSS and Tailwind
   values, version strings, street addresses, copyright years.
2. **No new claims.** Facts come from EnergyX's own public pages, each with a
   source URL and access date. `approvedAt` is `null` on every fact — Raj is not
   EnergyX and cannot approve their numbers. The UI says so.
3. **Precise nouns.** Eni *stake*, Army *conditional lease*, Compass *non-binding
   MOU*, Lonestar *demonstration plant*. Never upgrade an MOU to a partnership.
4. **Forward-looking figures are chipped and footnoted.** `kind: planned | estimate`
   gets an amber chip and an automatic forward-looking footnote on that page.
5. **Labeled as an unaffiliated demo, everywhere.** Non-dismissible banner, "(demo)"
   in every title, `X-Robots-Tag: noindex, nofollow`, robots disallow, basic auth on
   everything, production fail-closed. No invest flow, no forms collecting personal
   data, no analytics or tracking pixels. Do not reproduce EnergyX's Reg A legal
   text — Raj is not the issuer; the notice is in his own words.
6. **Performance budgets enforced in CI.** See §5. This demo argues about speed;
   it cannot be slow.
7. **No secrets in client code.** Nothing sensitive behind `NEXT_PUBLIC_`.

---

## 3. Stack

Next.js 16.4 App Router, TypeScript strict, pnpm, Tailwind, static at build time,
content as JSON + MDX validated with Zod, Vercel hosting. Tests: Vitest,
Playwright + axe, Lighthouse CI.

Do not add dependencies without asking. No component library, no state manager,
no CSS-in-JS, no animation library unless a specific route needs one and it is
justified first.

---

## 4. Architecture rules

- Server components by default. `"use client"` only for the mobile menu and the
  assistant's chat input. Anything else, flag it first.
- All copy comes from `/content` via `src/lib/content.ts`. Never hardcode copy.
- `next/image` with honest `sizes`. Only an above-fold poster gets `priority`.
- Animate `transform` and `opacity` only. Respect `prefers-reduced-motion`.
- Accessibility: semantic HTML, visible focus, alt text, 44px tap targets.
  axe must show zero serious/critical — the demo criticises their contrast failures,
  so it cannot have its own.
- Components under ~150 lines.

### Routes

```
/                  what this is + the assistant
/facts             the registry, with auto-generated conflicts table
/black-giant       ONE page rebuilt properly — the performance proof
/findings          audit numbers, before/after, what AI models say about EnergyX
/evals             the assistant's eval suite and mutation testing, generated at build
```

Five routes. Not a site. Resist adding more. (`/evals` added Oct 19 2026 by
Raj's explicit override.)

---

## 5. Performance budgets (CI-enforced, mobile lab)

Lighthouse performance ≥ 95 · LCP ≤ 2.0s · CLS ≤ 0.05 · TBT ≤ 150ms ·
first-load JS ≤ 150 KB compressed · any page ≤ 3 MB total.

Tighter than a normal project on purpose: the argument is that their pages are
50 and 55, so this one being 92 would be embarrassing. If an effect blows a
budget, the effect gets simplified. Never the budget.

---

## 6. Build order

**Phase A — the registry (do first, everything depends on it)**
1. `src/lib/schemas.ts`, `src/lib/content.ts`, `content/facts.json`,
   `<Fact/>`, `scripts/lint-facts.ts` + unit tests.
2. `/facts` route: every fact with source, date, kind chip, approval state, and a
   conflicts table generated from the registry.

**Phase B — the answer layer (the centrepiece)**
3. An assistant that answers questions using **only** facts in the registry, cites
   the source page for each, and says plainly when it doesn't know.
4. **Refusal behaviour, which is the actual demo.** Forward-looking questions
   ("when is the IPO", "what return will I get", "will this go up") get a visible,
   explained decline and a handoff to IR — not a hedge, not a guess. Build the
   classifier and the refusal copy before polishing the happy path.
5. The three-tier framing in the UI: public (answerable here), gated (requires
   identity — EnergyX already does this with DocSend), private (human only).

**Phase C — AI discoverability**
6. `llms.txt`, structured data, consistent facts. `/findings` shows before/after
   screenshots of what ChatGPT and Claude say about EnergyX.

**Phase D — the performance proof**
7. `/black-giant` rebuilt: poster image as LCP, video `preload="none"` attached
   after load, correctly sized images, no render-blocking CSS. Measure on the same
   emulated device as the audit and put both numbers on `/findings`.

**Stretch, only if Phases A–D are done and green**
8. The AI publish flow (`pnpm new:press`): release text → structured draft → Zod →
   validators → branch → PR → preview → human merge. The model writes structured
   data, never code, and can never introduce a number absent from the registry;
   unknown numbers go to `newClaims[]` for a human. Needs a working `gh` CLI.

---

## 7. Cut order

Drop from the top when time runs short:

1. The publish flow (stretch anyway)
2. The three-tier UI framing — keep it as a talking point instead
3. `/black-giant` full rebuild — a hero-only rebuild still proves the number
4. Before/after AI screenshots — keep `llms.txt` itself

**Never cut:** the facts registry, the conflicts table, the assistant's refusal
behaviour, the measured performance numbers, the compliance guardrails, the
backup screen recording.

---

## 8. Deadline

Decisions land mid-week of Oct 13 2026. **Ship and send by Monday Oct 12.**
Something smaller in their hands before the decision beats something better after it.
When in doubt, cut scope, not the send date.

---

## 9. Things Claude Code must not do

- Type a number into a component or MDX body.
- Add a dependency without asking.
- Invent EnergyX facts, partnerships, dates or figures. Leave `TODO(content)` and say so.
- Generate fake photographs of EnergyX facilities, equipment or people.
- Reproduce EnergyX's legal, Reg A or offering text.
- Make the assistant answer a forward-looking or investment-advice question, even
  partially, even hedged. The refusal is the product.
- Weaken the banner, the noindex headers, the basic auth or the production fail-closed.
- Raise a performance budget to make a build pass.
- Point any load test at energyx.com.
- Build merchandise, shop or product-design features. Out of role, and it steps on
  Luke's work.
