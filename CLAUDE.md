# EnergyX Concept Site — project rules for Claude Code

Read this file before writing any code. It is the contract for this repo.
If a request conflicts with a rule here, say so before you build.

---

## 1. What this is

A private, password-protected concept redesign of energyx.com, built by Raj Purohith Arjun
as part of an interview process for the AI Engineer role at EnergyX.

It is **not** an official EnergyX communication. It is shown on a laptop and a phone to
Teague Egan (CEO), Kellee Khalil (CMO) and Luke Gustafson (design/3D).

### The three things it has to prove, in order

1. **It can be published in minutes, with review.** A press release becomes a reviewed,
   live page in under five minutes. This is the whole point. Everything else supports it.
2. **It is faster than the current site**, measured honestly on the same pages with the
   same tools.
3. **It looks more cinematic and more premium** than the current site.

If a feature does not serve one of those three, it is cut. See §8.

### What it must never become

A beautiful site that is slow. The current energyx.com is already beautiful-ish and slow.
Shipping a slower, prettier site loses the argument before it starts. Every visual
decision is also a performance decision.

---

## 2. Non-negotiable rules

These are hard. Do not "temporarily" break them.

1. **No typed numbers.** Every business claim — money, tonnes, acres, patents,
   percentages, dates of future events — renders through `<Fact id="..." />` reading from
   `content/facts.json`. `scripts/lint-facts.ts` fails the build on violations. This is
   the single feature that proves the candidate understood their real problem
   (their live site shows 120+, 140+ and 150+ patents on different pages).
2. **No new claims.** Facts come from EnergyX's own public pages, each with a source URL
   and access date. `approvedAt` is `null` on every fact — Raj is not EnergyX and cannot
   approve their numbers. The UI shows that honestly.
3. **Precise nouns.** Eni *stake*, Army *conditional lease*, Compass *non-binding MOU*,
   Lonestar *demonstration plant*. Never upgrade an MOU to a partnership or a lease to a
   contract. The AI publish prompt enforces this too.
4. **Forward-looking figures are chipped and footnoted.** `kind: planned | estimate`
   renders an amber chip and registers an automatic forward-looking footnote on that page.
   EnergyX runs a Reg A raise; this is not decoration.
5. **Labeled as a concept, everywhere.** Non-dismissible banner on every page,
   "(concept)" in every `<title>`, `X-Robots-Tag: noindex, nofollow`, robots disallow all,
   basic auth on everything. No real invest flow, no forms that collect personal data,
   no analytics or tracking pixels.
6. **Performance budgets are enforced in CI**, not aspirational. See §5.
7. **No secrets in client code.** Nothing sensitive behind `NEXT_PUBLIC_`.
   `.env*` is gitignored before the first commit.

---

## 3. Stack

| Layer | Choice | Note |
| --- | --- | --- |
| Framework | Next.js 16.x App Router, TypeScript strict | Same stack as their real site — the point is proving you can make *their* tech fast. Run `npm show next version` and pin current stable; do not hardcode a version from memory. |
| Package manager | pnpm | lockfile committed |
| Rendering | Static at build time for every page | Content changes a few times a day; static HTML from a CDN wins |
| Styling | Tailwind + brand tokens as CSS variables | |
| Content | JSON + MDX in Git, validated with Zod at build | Loader throws on invalid file, unknown fact ID, orphan milestone |
| Motion | GSAP for the scroll story only; CSS everywhere else | |
| 3D | `cobe` globe; `three` + `@sparkjsdev/spark` splat viewer | Both lazy, both behind a tap |
| Hosting | Vercel, preview URL per PR | |
| AI | One `generateDraft()` function. Model behind it is swappable. | |
| Tests | Vitest, Playwright + axe, Lighthouse CI, linkinator, k6 | |

Do not add dependencies without asking. Every dependency is a liability and a page-weight
cost. Specifically not wanted: a component library, a state manager, a CSS-in-JS library,
a smooth-scroll library.

---

## 4. Architecture rules

- **Server components by default.** `"use client"` is allowed only in: hero video
  controller, stat count-up, scroll story, projects carousel, globe, splat viewer,
  mobile menu. Nothing else. If you think you need another, say why first.
- Heavy libraries (`three`, `spark`, `gsap`, `cobe`) import via `next/dynamic` **inside**
  the client island, never in `layout.tsx`.
- All page copy comes from `/content` through `src/lib/content.ts`. Never hardcode copy
  in a component.
- Images: `next/image` with an honest `sizes`. Only the hero poster gets `priority`.
  Always set width/height or use `fill` inside an aspect-ratio box.
- Animate `transform` and `opacity` only. Never width, height, top, left.
- Nothing animates before first paint. Respect `prefers-reduced-motion` and `Save-Data`.
- Anything moving longer than 5s needs a visible pause control.
- Accessibility: semantic HTML, visible focus rings, alt text, 44px tap targets,
  labels on buttons. axe scan must show zero serious/critical.
- Keep components under ~150 lines.

### Folder shape

```
content/        facts.json, projects/, milestones.json, press/*.mdx, faq.json, site.json
public/         media/, splats/
scripts/        new-press.ts (AI publish CLI), lint-facts.ts
src/app/        layout, page, [slug], projects, press, concept, sitemap, robots, og
src/components/ ui/ sections/ three/
src/lib/        schemas.ts content.ts facts.ts validators.ts
src/proxy.ts    basic auth (Next 16 name; older versions: middleware.ts)
tests/          unit/ e2e/
```

One `[slug]` route serves project pages and designed stub pages, with
`generateStaticParams` and `dynamicParams = false` so unknown URLs 404 cleanly.

---

## 5. Performance budgets (CI-enforced, mobile lab)

| Metric | Budget |
| --- | --- |
| Lighthouse performance | ≥ 90 |
| LCP | ≤ 2.5 s |
| CLS | ≤ 0.1 |
| Total blocking time | ≤ 200 ms |
| First-load JS, compressed | ≤ 180 KB |
| Page weight before hero video starts | ≤ 1.5 MB |
| Hero poster | ≤ 200 KB |
| Fonts | ≤ 2 files, ≤ 100 KB |
| Splat file | ≤ 25 MB, downloaded **only after tap** |

A Playwright test asserts no `.spz` request occurs before the 3D button is clicked.
If a new effect blows a budget, the build fails and the effect gets simplified — not the
budget raised.

---

## 6. Build order

Deploy before you design. The site must be live on a phone within the first hour, then
everything after is an increment to a live site.

**Phase 0 — spine (do not skip, do not reorder)**
1. Scaffold, push, connect Vercel, confirm the production URL loads on a phone.
2. Basic auth proxy, noindex headers, concept banner, full EnergyX nav + footer shell.
3. Design tokens, fonts.
4. `schemas.ts`, `content.ts`, `facts.json`, `<Fact/>`, `lint-facts.ts` + its unit tests.

**Phase 1 — the argument**
5. Homepage sections in order: hero → numbers band → Brine-to-Battery scroll story →
   featured project → projects showcase → conventional vs DLE → milestones → press →
   invest placeholder → FAQ.
6. Black Giant project page: hero, key facts, status stepper, milestone timeline,
   gallery, 3D tour slot, partners, related press, forward-looking footnote.
7. Press index + article template + RSS + OG images.
8. AI publish flow (`pnpm new:press`) with validators and PR creation.

**Phase 2 — proof**
9. Tests, axe, Lighthouse CI, link check, GitHub Actions, branch protection.
10. Before/after measurement, `/concept` leave-behind page with the numbers and the
    fact-conflict table.

**Phase 3 — the extras, only if Phase 2 is green**
11. Globe, splat viewer, Lonestar + Powder Hound, stub pages for every remaining menu
    item (Company, Lithium, Nuclear, Batteries, Media, Careers, Contact, Shop,
    Investor Portal), image comparison slider, MCP server.

---

## 7. The AI publish flow — the demo centerpiece

`pnpm new:press --file releases/x.txt --project powder-hound`

1. Read release text.
2. Load `facts.json`, brand rules, three example articles.
3. Model call with a JSON response schema, temperature ~0.3.
4. Zod parse.
5. Checks: every `<Fact id>` exists · facts lint passes on the body · forward-looking
   detector · banned promotional phrases ("guaranteed", "risk-free", "can't lose",
   "best investment") · title ≤ 90 chars · summary 80–160 · unique slug · sourceUrl present.
6. Write `content/press/<slug>.mdx`, branch, commit, push, `gh pr create`.
7. Vercel comments the preview URL; CI runs everything.
8. Human reviews the preview and merges. Live in about a minute.

**The model writes structured data, never code, and can never introduce a number that is
not in the registry.** Numbers it finds in the release that are not in the registry go
into `newClaims[]` with the exact text and why it matters, and the PR is labeled
`needs-fact-approval`. Say that sentence out loud in the demo — it is the answer to
"how do you stop it hallucinating a lithium yield into an investor-facing page."

Always keep the no-API fallback working: `--print-prompt` prints the full prompt to paste
into a chat, `--from-json draft.json` runs the identical checks and PR steps. If the API
is rate-limited on demo morning, the demo still runs.

---

## 8. Cut order

When time runs short, drop from the top. Decide by the list, not by mood at 11pm.

1. MCP server
2. Git-based CMS editor
3. Image comparison slider (keep the table)
4. Lonestar / Powder Hound pages (keep as designed stubs)
5. Globe interactivity (keep a static map with pins)
6. GSAP pinning on desktop (keep fade-in cards)
7. k6 load test (keep Lighthouse CI)

**Never cut:** the deployed private URL · the hero · numbers via the facts registry ·
Black Giant page with status stepper · the publish flow · before/after numbers ·
CI with tests · the compliance guardrails · the backup screen recording.

---

## 9. Things Claude Code must not do in this repo

- Do not type a number into a component or MDX body.
- Do not add a dependency without asking.
- Do not add `"use client"` to a component outside the approved island list without
  flagging it.
- Do not generate fake photographs of EnergyX facilities, equipment or people.
  AI-generated backgrounds are abstract only and labeled "illustrative".
- Do not remove or weaken the concept banner, the noindex headers or the basic auth.
- Do not point any load test at energyx.com. Only at our own preview deployment.
- Do not invent EnergyX facts, partnerships, dates or figures to fill a section.
  If content is missing, leave a `TODO(content)` and say so.
- Do not raise a performance budget to make a build pass.

---

## 10. Open scope question

Raj has asked for a more interactive, "state of the art" experience than the original
weekend plan, plus a link to official merchandise.

Treat added interactivity as a **Phase 3** item that must pass the §5 budgets. The merch
link is a nav/footer item pointing to the designed Shop stub — trivial, do it in Phase 3
step 11. Resolve the ambition against the budgets, never by relaxing them: the headline
claim of this build is "more cinematic *and* faster", and the second half is the half
that is hard to argue with.
