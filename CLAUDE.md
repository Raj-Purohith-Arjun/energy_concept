# EnergyX Trust Layer — project rules

Read before writing code. This is the contract. If a request conflicts with it,
say so before building.

**Replaces the previous version.** That one described four routes and a
question-answering assistant. The scope has changed — see §1.

---

## 1. What changed, and why

On 2026-10-19 this demo was sent to EnergyX. On 2026-10-28 the feedback came
back: **the CMO typed investor questions and got no result.**

Diagnosis:

1. The refusal gate declines nearly every investor question by design — IPO,
   returns, advice, valuation, guarantees, comparisons, buying shares, and
   also targets and estimates. That last one was too strict.
2. Retrieval requires every concept to match across ~44 facts. Most natural
   phrasings return "no sourced answer".
3. Likely expectation mismatch: she runs a Brand Studio prototype. Her mental
   model of an AI tool is "type intent, get a draft". She may have asked it to
   *write* something, which it cannot do.

**The lesson, which governs everything below: a guardrail that declines without
making it obvious that it chose to decline is indistinguishable from a broken
system.** The refusals were correct. The product still failed. Both are true.
Never write "working as intended" in copy, comments or correspondence.

---

## 2. Non-negotiable rules (unchanged)

1. **No typed numbers.** Every business claim renders through `<Fact id="..." />`
   from `content/facts.json`. `scripts/lint-facts.ts` fails the build.
2. **No new claims.** Facts come from EnergyX's own public pages with a source
   URL and access date. `approvedAt` is `null` on every EnergyX fact.
3. **Precise nouns.** Eni *stake*, Army *conditional lease*, Compass
   *non-binding MOU*, Lonestar *demonstration plant*. Never upgrade one.
4. **Forward-looking figures are chipped and footnoted** — but see §3, they are
   now answered rather than refused.
5. **Labeled as an unaffiliated demo everywhere.** Banner, "(demo)" in titles,
   noindex, robots disallow, basic auth, production fail-closed. No invest flow,
   no forms collecting personal data, no analytics. Never reproduce EnergyX's
   legal or offering text.
6. **Performance budgets enforced.** §6.
7. **No secrets in client code.** API keys server-side only, never `NEXT_PUBLIC_`.

---

## 3. The assistant: what it does now

### Two modes, one registry

- **Answer** — a question about EnergyX's published information.
- **Draft** — a request to write something from those same facts.

An intent router decides which. When it is unsure, it says so and offers both.

### Never a dead end

Every response states what it understood, what it matched, and what it did.
Three outcomes, all of which must read as deliberate:

- **Answered** — with sources, and what it matched on.
- **Declined** — "I won't answer this", the reason in plain words, and a named
  handoff to EnergyX Investor Relations. Never a bare apology.
- **Not covered** — "I don't have a sourced answer for that", plus the nearest
  facts it does have, as clickable examples.

A blank or near-blank response is a bug, not a safe default.

### Targets and estimates are ANSWERED, not refused

`kind: planned | estimate` renders the figure with the amber chip and the
forward-looking footnote: *"Black Giant's planned capacity is 53Ktpa LCE — a
target, not current production."* This is more useful and still compliant.

Refusal is reserved for genuine speculation — asking what *will* happen, what a
figure *will* be, or what something is worth — not for repeating a published plan.

### Retrieval

Partial and synonym matching. When confidence is low, return the nearest facts
with an honest label rather than nothing.

### Unanswered questions are logged

Every question that returns "not covered" is recorded. That log is a content
roadmap, not a debug file — see §5.

---

## 4. Drafting mode

**Formats: a LinkedIn post and a web page section. Nothing else.**

**Do NOT build investor email or investor update drafting.** Drafting investor
communications during an active Reg A raise is the one thing that could read as
reckless. Saying "I deliberately did not build that" is stronger than the feature.

Rules, all enforced, not requested:

- Every figure comes from the registry. The model cannot introduce a number.
- Planned and estimate figures carry their chip and footnote in the draft.
- The same pre-filter runs over the composed draft text. A draft containing
  forward-looking or promotional language is rejected and the reason shown.
- Brand rules are checked, not hoped for: approved terminology, precise nouns,
  banned promotional phrases.
- Output is 90% there and editable, per the CMO's own stated standard. The
  system does not publish anything.

**One rejection must be demonstrable on screen** — a draft that overstates,
caught, with what was wrong and what shipped instead.

---

## 5. The gap report

**The page was cut (§8, cut order 2). There is no gap page.** What shipped is
the log and the export:

- Every question answered with "not covered" is logged, with emails and long
  numbers removed: to `data/unanswered.jsonl` locally (git-ignored) and to the
  server log. That log is the content backlog.
- `pnpm export:gaps` turns the log into a redacted, deduplicated,
  subject-grouped snapshot in `content/gaps.json`. It is run by hand and read by
  a person before anything is committed. It never runs at build time, and
  nothing on the site reads the file.

Framed for a marketing lead, not an engineer: *these are the questions people
asked that EnergyX's public pages do not answer.* It is a content backlog.

Seeded from the demo's own logs. No invented questions, ever.

---

## 6. Performance budgets (unchanged, CI-enforced, mobile)

Lighthouse ≥ 95 · LCP ≤ 2.0 s · CLS ≤ 0.05 · TBT ≤ 150 ms ·
first-load JS ≤ 150 KB compressed · any page ≤ 3 MB.

Measured numbers as of 2026-10-19, US West, Lighthouse 13.5.0 mobile:
this build's `/black-giant/` scored 95, LCP 2.1 s, 930 kB transferred.
EnergyX's scored 50, LCP 7.5 s, 50.6 MB — of which 49.0 MB is two video files,
leaving 1.6 MB for everything else.

---

## 7. Build order (five days)

**Day 1 — fix what the CMO hit**
1. Verify the live site actually works. Reproduce before theorising.
2. No dead ends (§3).
3. Answer planned and estimate figures instead of refusing them.
4. Looser retrieval with a nearest-facts fallback.
5. Log unanswered questions.

**Days 2–3 — drafting mode (§4)**
6. Intent router, question vs draft.
7. LinkedIn post and web page section.
8. Brand rules enforced; one visible rejection.

**Day 4**
9. The gap report (§5): the page was cut (§8). The log and the export script shipped.
10. Brand rules added to the eval suite — same machinery as the refusal cases.

**Day 5**
11. Re-measure, re-run evals, two-minute screen recording, short written note.

---

## 8. Cut order

1. Web page section (keep the LinkedIn post)
2. The gap report page (keep the log)
3. Brand rules in the eval suite (keep them enforced at generation)

**Never cut:** the no-dead-ends fix, answering planned figures, the visible
rejection in drafting mode, the compliance guardrails, the screen recording.

---

## 9. Things Claude Code must not do

- Type a number into a component or MDX body.
- Add a dependency without asking.
- Invent EnergyX facts, partnerships, dates or figures. Leave `TODO(content)`.
- Build investor email or investor update drafting (§4).
- Let the assistant answer a genuinely speculative question, even hedged.
- Return a blank or unexplained response in any mode.
- Weaken the banner, noindex, basic auth or production fail-closed.
- Raise a performance budget to make a build pass.
- Write "working as intended" anywhere a reader could see it.
- Build merchandise, shop or product-design features.

---

## 10. Audience

Teague Egan (CEO) — travelling until 2026-11-11. Thinks in capital velocity
and narrative. Wants a number he can feel.

Kellee Khalil (CMO) — built her own Brand Studio prototype with Claude. Measures
engineering by shipped business outcomes, not technical complexity. Her stated
standard is 90% done, then human review. Her stated fear is depending on an
engineer for every change. She is the one who tested this and got nothing.

Luke Gustafson (design/3D) — advocate. Owns the video and visual work. The
delivery pipeline is the problem, never his footage. Never phrase it otherwise.

Write every page for a reader who will skim it for fifteen seconds: verdict
first, detail collapsed behind it, plain English with the technical term in
parentheses after.
