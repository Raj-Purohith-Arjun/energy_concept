import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

export const TODO_PREFIX = "TODO(content)";

export function isTodo(value: string): boolean {
  return value.startsWith(TODO_PREFIX);
}

const nonEmpty = z.string().trim().min(1);
const isoDate = z.iso.date();
const kebabId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");

// A source URL is either a real https URL or an explicit TODO(content) marker.
// TODOs are allowed so an incomplete registry still builds for previews; they
// render as visible "pending" text and lint:facts lists them as warnings.
const sourceUrl = z.union([z.url({ protocol: /^https$/ }), z.string().startsWith(TODO_PREFIX)]);

// `$comment` and `note` are author annotations: accepted, never rendered.
const comment = z.union([z.string(), z.array(z.string())]);

// ---------------------------------------------------------------------------
// Facts registry (content/facts.json)
// ---------------------------------------------------------------------------

export const FACT_KINDS = ["actual", "planned", "estimate", "company-claim"] as const;
export const FactKindSchema = z.enum(FACT_KINDS);

// "stated": the source page itself says what the figure counts.
// "inferred": it doesn't, and the basis is this registry's reading.
export const BasisSourceSchema = z.enum(["stated", "inferred"]);

export const AlsoPublishedAsSchema = z.strictObject({
  value: nonEmpty,
  basis: nonEmpty,
  basisSource: BasisSourceSchema,
  url: sourceUrl,
  accessed: isoDate,
  note: z.string().optional(),
});

export const FactSchema = z.strictObject({
  id: kebabId,
  label: nonEmpty,
  // Full display string, unit included ("7.5 s"). `unit` qualifies `numeric`.
  value: nonEmpty,
  numeric: z.number().optional(),
  unit: nonEmpty.optional(),
  basis: nonEmpty,
  basisSource: BasisSourceSchema,
  kind: FactKindSchema,
  source: z.strictObject({
    title: nonEmpty,
    url: sourceUrl,
    accessed: isoDate,
  }),
  owner: nonEmpty,
  approvedAt: isoDate.nullable(),
  verified: z.boolean(),
  alsoPublishedAs: z.array(AlsoPublishedAsSchema).default([]),
  note: z.string().optional(),
  $comment: comment.optional(),
});

export const FactsFileSchema = z.strictObject({
  $comment: comment.optional(),
  facts: z.array(FactSchema),
});

export type FactKind = z.infer<typeof FactKindSchema>;
export type BasisSource = z.infer<typeof BasisSourceSchema>;
export type AlsoPublishedAs = z.infer<typeof AlsoPublishedAsSchema>;
export type Fact = z.infer<typeof FactSchema>;

export function isForwardLooking(fact: Pick<Fact, "kind">): boolean {
  return fact.kind === "planned" || fact.kind === "estimate";
}

// ---------------------------------------------------------------------------
// Site copy (content/site.json)
// ---------------------------------------------------------------------------

export const NavLinkSchema = z.strictObject({ label: nonEmpty, href: nonEmpty });

export const SiteSchema = z.strictObject({
  banner: nonEmpty,
  bannerLabel: nonEmpty,
  description: nonEmpty,
  skipLink: nonEmpty,
  brand: z.strictObject({ name: nonEmpty, tag: nonEmpty, homeHref: nonEmpty }),
  nav: z.array(NavLinkSchema),
  menu: z.strictObject({ open: nonEmpty, close: nonEmpty, label: nonEmpty }),
  footer: z.strictObject({
    notice: z.strictObject({
      heading: nonEmpty,
      paragraphs: z.array(nonEmpty),
      official: z.strictObject({ lead: nonEmpty, label: nonEmpty, href: nonEmpty }),
    }),
    credit: nonEmpty,
  }),
  notFound: z.strictObject({ title: nonEmpty, heading: nonEmpty, homeLabel: nonEmpty }),
  factUi: z.strictObject({
    // "{label}" is replaced with the fact's label.
    showSource: nonEmpty.includes("{label}"),
    basis: nonEmpty,
    inferred: nonEmpty,
    source: nonEmpty,
    sourcePending: nonEmpty,
    accessed: nonEmpty,
    pendingApproval: nonEmpty,
    approved: nonEmpty,
    verified: nonEmpty,
    unverified: nonEmpty,
    // Label for the figure(s) shown after the lead figure when a fact is published more than one way.
    alsoPublished: nonEmpty,
    kinds: z.strictObject({
      actual: nonEmpty,
      planned: nonEmpty,
      estimate: nonEmpty,
      "company-claim": nonEmpty,
    }),
  }),
  forwardLooking: z.strictObject({ marker: nonEmpty, note: nonEmpty }),
  llms: z.lazy(() => LlmsCopySchema),
  factsPage: z.strictObject({
    title: nonEmpty,
    heading: nonEmpty,
    intro: nonEmpty,
    registryHeading: nonEmpty,
    labels: z.strictObject({
      kind: nonEmpty,
      owner: nonEmpty,
      status: nonEmpty,
      details: nonEmpty,
    }),
    sameSubject: z.strictObject({ heading: nonEmpty, body: nonEmpty }),
  }),
});

export type NavLink = z.infer<typeof NavLinkSchema>;
export type Site = z.infer<typeof SiteSchema>;

// ---------------------------------------------------------------------------
// Assistant copy and retrieval vocabulary (content/assistant.json)
// ---------------------------------------------------------------------------

export const REFUSAL_CATEGORIES = [
  "ipo",
  "future-timing",
  "returns",
  "advice",
  "valuation",
  "guarantees",
  "comparison",
  "offering",
] as const;
export type RefusalCategory = (typeof REFUSAL_CATEGORIES)[number];

// "draft": a draft request for a format that isn't built; "draft-topic": a LinkedIn
// post with no topic the registry can write about.
export const NO_ANSWER_REASONS = ["no-match", "post-check", "language", "draft", "draft-topic", "empty", "too-long"] as const;
export type NoAnswerReason = (typeof NO_ANSWER_REASONS)[number];

const RefusalCopySchema = z.strictObject({ label: nonEmpty, title: nonEmpty, why: nonEmpty });
const NoAnswerCopySchema = z.strictObject({ title: nonEmpty, body: nonEmpty });
const TitleBodySchema = z.strictObject({ title: nonEmpty, body: nonEmpty });

export const AssistantSchema = z.strictObject({
  $comment: comment.optional(),
  pageTitle: nonEmpty,
  intro: z.strictObject({ heading: nonEmpty, body: nonEmpty, hardRule: nonEmpty, rulesTitle: nonEmpty }),
  form: z.strictObject({
    label: nonEmpty,
    placeholder: nonEmpty,
    submit: nonEmpty,
    pending: nonEmpty,
    privacy: nonEmpty,
  }),
  maxLength: z.number().int().positive(),
  examples: z.strictObject({
    heading: nonEmpty,
    groups: z.array(z.strictObject({ label: nonEmpty, questions: z.array(nonEmpty).min(1) })),
  }),
  youAsked: nonEmpty,
  recognisedAs: nonEmpty.includes("{label}"),
  refusals: z.strictObject(
    Object.fromEntries(REFUSAL_CATEGORIES.map((c) => [c, RefusalCopySchema])) as Record<
      RefusalCategory,
      typeof RefusalCopySchema
    >,
  ),
  handoff: z.strictObject({ lead: nonEmpty, label: nonEmpty, href: z.url({ protocol: /^https$/ }), tail: nonEmpty }),
  noAnswer: z.strictObject({
    ...(Object.fromEntries(NO_ANSWER_REASONS.map((r) => [r, NoAnswerCopySchema])) as Record<
      NoAnswerReason,
      typeof NoAnswerCopySchema
    >),
    coverageLead: nonEmpty,
    // Heading for the nearest-facts questions offered when nothing matched.
    nearestLead: nonEmpty,
    // Heading for the draft requests offered after a draft request it can't write.
    draftLead: nonEmpty,
    // Heading for the curated examples shown when nothing is near the question.
    examplesLead: nonEmpty,
    // Collapsed list of every topic covered, with a link to the full registry.
    registryLink: z.strictObject({ label: nonEmpty, href: nonEmpty }),
  }),
  // The three lines every drafted or clarifying response opens with (CLAUDE.md §3).
  trace: z.strictObject({ understood: nonEmpty, matched: nonEmpty, did: nonEmpty }),
  // Asked back instead of guessed: which of two intents, or which of several equal matches.
  clarify: z.strictObject({
    intent: z.strictObject({
      ...TitleBodySchema.shape,
      understood: nonEmpty,
      did: nonEmpty,
      draftLead: nonEmpty,
      answerLead: nonEmpty,
    }),
    ambiguous: z.strictObject({
      ...TitleBodySchema.shape,
      understood: nonEmpty,
      did: nonEmpty,
      lead: nonEmpty,
    }),
  }),
  // Drafting (CLAUDE.md §4): LinkedIn post only so far.
  draft: z.strictObject({
    maxFacts: z.number().int().positive(),
    // topic concept id -> the facts a post about it may use. Explicit on purpose:
    // EnergyX's own published figures only; no funding or investor facts, and
    // none of Raj's measurements of its website.
    topics: z.record(kebabId, z.strictObject({ label: nonEmpty, factIds: z.array(kebabId).min(1) })),
    requestTemplate: nonEmpty.includes("{topic}"),
    linkedin: z.strictObject({ opening: nonEmpty.includes("{topic}"), closing: nonEmpty }),
    // `pnpm compose:posts`: whole posts written ahead of time, one per topic. The
    // rules are what the model is told; the checks enforce them regardless.
    voice: z.strictObject({
      postTopics: z.array(kebabId).min(1),
      rules: z.array(nonEmpty).min(1),
    }),
    brand: z.strictObject({
      banned: z.array(nonEmpty),
      // CLAUDE.md §2.3: a pattern matches a wrong upgrade of a precise noun.
      preciseNouns: z.array(z.strictObject({ noun: nonEmpty, use: nonEmpty, pattern: nonEmpty })),
      // A fact whose basis names this noun ("grant") may not be described with the `banned` words in its own sentence.
      grant: z.strictObject({ noun: nonEmpty, banned: z.array(nonEmpty).min(1) }),
      // TODO(content): approved terminology, from the CMO. Empty until supplied.
      terminology: z.array(z.strictObject({ avoid: nonEmpty, use: nonEmpty })),
    }),
    result: z.strictObject({
      heading: nonEmpty,
      understoodPost: nonEmpty,
      understoodQuestion: nonEmpty,
      matched: nonEmpty.includes("{topics}"),
      did: nonEmpty,
      editLabel: nonEmpty,
      editHint: nonEmpty,
      notice: nonEmpty,
      // Collapsed sources block under the post: "4 figures, all sourced".
      figuresSummary: z.strictObject({ one: nonEmpty.includes("{count}"), other: nonEmpty.includes("{count}") }),
      ignored: nonEmpty.includes("{phrases}"),
      rejected: z.strictObject({
        heading: nonEmpty,
        intro: nonEmpty,
        wrote: nonEmpty,
        wrong: nonEmpty,
        shipped: nonEmpty,
      }),
    }),
    // Formats it will not or does not yet write, each said out loud.
    unsupported: z.strictObject({
      section: TitleBodySchema,
      investor: TitleBodySchema,
      other: TitleBodySchema,
    }),
  }),
  answer: z.strictObject({
    heading: nonEmpty,
    factLine: nonEmpty.includes("{label}").includes("{value}"),
    alsoLine: nonEmpty.includes("{value}"),
    // Plans and estimates: the figure, said to be a plan or estimate, never a result.
    plannedLine: nonEmpty.includes("{label}").includes("{value}"),
    estimateLine: nonEmpty.includes("{label}").includes("{value}"),
    // Hand-written wording that does not echo the label: factId -> sentence with {value}.
    phrasings: z.record(kebabId, nonEmpty.includes("{value}")),
    sourcesHeading: nonEmpty,
    // Which composer wrote the wording; the template fallback is never silent.
    wordedByModel: nonEmpty.includes("{model}"),
    wordedByTemplate: nonEmpty,
    wordedByMixed: nonEmpty.includes("{model}"),
  }),
  concepts: z.record(kebabId, z.array(nonEmpty).min(1)),
  factConcepts: z.record(kebabId, z.array(kebabId).min(1)),
  related: z.record(kebabId, z.array(kebabId).min(1)),
  // factId -> a question that retrieves it; offered as a clickable example.
  questions: z.record(kebabId, nonEmpty),
});

export type AssistantContent = z.infer<typeof AssistantSchema>;

// ---------------------------------------------------------------------------
// /black-giant page copy (content/black-giant.json)
// ---------------------------------------------------------------------------

export const BlackGiantSchema = z.strictObject({
  $comment: comment.optional(),
  title: nonEmpty,
  heading: nonEmpty,
  lead: nonEmpty,
  poster: z.strictObject({ alt: nonEmpty }),
  placeholderLabel: nonEmpty,
  video: z.strictObject({
    sources: z
      .array(
        z.strictObject({
          // Local public/ files only: the video must never come from a third-party host.
          src: z.string().regex(/^\/media\/[\w./-]+\.(?:mp4|webm)$/),
          type: z.enum(["video/mp4", "video/webm"]),
        }),
      )
      .min(1),
    pause: nonEmpty,
    play: nonEmpty,
  }),
  factsHeading: nonEmpty,
  factIds: z.array(kebabId).min(1),
  registryLink: NavLinkSchema,
  delivery: z.strictObject({ heading: nonEmpty, points: z.array(nonEmpty).min(1) }),
});

export type BlackGiantContent = z.infer<typeof BlackGiantSchema>;

// ---------------------------------------------------------------------------
// /findings page copy (content/findings.json)
//
// Prose may embed figures as {fact:<id>} tokens, rendered as <Fact> by
// FactText. Table and payload cells are fact ids, or a TODO(content) marker for
// a figure not yet measured, which renders as visible "pending" text.
// ---------------------------------------------------------------------------

const factRef = z.union([kebabId, z.string().startsWith(TODO_PREFIX)]);

const PayloadPageSchema = z.strictObject({
  label: nonEmpty,
  total: factRef,
  // Byte facts that add up to `total`; `video` picks the bar shade.
  parts: z.array(z.strictObject({ label: nonEmpty, fact: kebabId, video: z.boolean() })),
});

// A count in copy: { one, other } forms, each with {count} (see lib/plural.ts).
const countLabel = z.strictObject({ one: nonEmpty.includes("{count}"), other: nonEmpty.includes("{count}") });

export const FindingsSchema = z.strictObject({
  $comment: comment.optional(),
  title: nonEmpty,
  heading: nonEmpty,
  // Three before -> after pairs shown large above all prose.
  verdict: z.strictObject({
    heading: nonEmpty,
    pairs: z.array(z.strictObject({ label: nonEmpty, before: kebabId, after: kebabId })).length(3),
    summary: nonEmpty,
  }),
  intro: nonEmpty,
  caveatsLink: nonEmpty,
  pending: nonEmpty,
  // Two phones replaying measured First Contentful Paint -> LCP at real speed.
  timeline: z.strictObject({
    heading: nonEmpty,
    intro: nonEmpty,
    play: nonEmpty,
    firstPaint: nonEmpty,
    mainPaint: nonEmpty,
    caption: nonEmpty,
    phones: z.array(z.strictObject({ label: nonEmpty, fcp: kebabId, lcp: kebabId })).length(2),
  }),
  payload: z.strictObject({
    heading: nonEmpty,
    body: z.array(nonEmpty).min(1),
    totalLabel: nonEmpty,
    pages: z.array(PayloadPageSchema).min(1),
    scaleNote: nonEmpty,
  }),
  comparison: z.strictObject({
    heading: nonEmpty,
    intro: nonEmpty,
    caption: nonEmpty,
    columns: z.strictObject({ metric: nonEmpty, before: nonEmpty, after: nonEmpty }),
    rows: z.array(z.strictObject({ label: nonEmpty, before: factRef, after: factRef })).min(1),
    method: nonEmpty,
  }),
  caveats: z.strictObject({ heading: nonEmpty, count: countLabel, points: z.array(nonEmpty).min(1) }),
  registry: z.strictObject({
    heading: nonEmpty,
    count: countLabel,
    intro: nonEmpty,
    cases: z
      .array(
        z.strictObject({
          heading: nonEmpty,
          body: z.array(nonEmpty).min(1),
          // A fact with alsoPublishedAs figures, shown side by side.
          figures: kebabId.optional(),
        }),
      )
      .min(1),
  }),
  firstWeek: z.strictObject({
    heading: nonEmpty,
    count: countLabel,
    intro: nonEmpty,
    points: z.array(nonEmpty).length(5),
  }),
});

// ---------------------------------------------------------------------------
// /evals page copy (content/evals.json)
//
// No figures at all: every count and rate is generated at build from the eval
// cases. Label maps are records; the page fails the build on a missing key.
// ---------------------------------------------------------------------------

const labels = z.record(z.string(), nonEmpty);
// Collapsed sections: a heading, plus a { one, other } count for the summary.
const collapsed = { heading: nonEmpty, count: countLabel };

export const EvalsSchema = z.strictObject({
  $comment: comment.optional(),
  title: nonEmpty,
  heading: nonEmpty,
  intro: nonEmpty,
  // Three questions that are eval cases (checked at build), linked into the assistant.
  tryIt: z.strictObject({
    heading: nonEmpty,
    intro: nonEmpty,
    expect: nonEmpty.includes("{outcome}"),
    questions: z.array(z.strictObject({ question: nonEmpty, note: nonEmpty })).length(3),
  }),
  rejections: z.strictObject({
    heading: nonEmpty,
    intro: nonEmpty,
    allOmissions: nonEmpty,
    none: nonEmpty,
    columns: z.strictObject({ wrote: nonEmpty, why: nonEmpty, shipped: nonEmpty }),
    omitted: nonEmpty.includes("{missing}"),
    other: nonEmpty.includes("{reason}"),
    times: nonEmpty.includes("{count}"),
    writtenBy: nonEmpty.includes("{model}"),
  }),
  // Whole LinkedIn posts the model wrote at build time and the checks refused.
  postRejections: z.strictObject({
    heading: nonEmpty,
    intro: nonEmpty,
    none: nonEmpty,
    columns: z.strictObject({ wrote: nonEmpty, why: nonEmpty, shipped: nonEmpty }),
    // How the model is kept from producing a number, and what the checks cannot catch.
    mechanism: z.strictObject({ heading: nonEmpty, body: nonEmpty }),
    limitation: z.strictObject({ heading: nonEmpty, body: nonEmpty }),
    // Which model wrote the stored posts, and where words that are not figures come from.
    composer: nonEmpty.includes("{model}"),
    writtenBy: nonEmpty.includes("{model}"),
    sources: nonEmpty,
  }),
  mutation: z.strictObject({
    heading: nonEmpty,
    intro: nonEmpty,
    // Mutant ids shown open; the rest are in the collapsed full table.
    highlights: z.array(nonEmpty).min(1),
    // Shown under the big number, so no {count} here.
    failed: z.strictObject({ one: nonEmpty, other: nonEmpty }),
    missed: nonEmpty,
    full: z.strictObject({ ...collapsed }),
    columns: z.strictObject({ mutant: nonEmpty, failed: nonEmpty, where: nonEmpty }),
    labels,
    groupCount: nonEmpty.includes("{count}").includes("{label}"),
  }),
  verdict: z.strictObject({
    heading: nonEmpty,
    cases: nonEmpty,
    categories: nonEmpty.includes("{total}"),
    mutants: nonEmpty.includes("{total}"),
    passRate: nonEmpty,
    allPass: nonEmpty.includes("{rate}"),
    someFail: nonEmpty.includes("{failed}"),
  }),
  folds: z.strictObject({ tryIt: nonEmpty, rejections: nonEmpty, postRejections: nonEmpty, mutation: nonEmpty }),
  model: nonEmpty,
  groups: labels,
  refusals: z.strictObject({
    ...collapsed,
    intro: nonEmpty,
    expected: nonEmpty,
    example: nonEmpty,
  }),
  adversarial: z.strictObject({
    ...collapsed,
    intro: nonEmpty,
    techniques: z.record(z.string(), z.strictObject({ name: nonEmpty, attempts: nonEmpty })),
    labels: z.strictObject({ attempts: nonEmpty, example: nonEmpty, result: nonEmpty }),
  }),
  mustNotRefuse: z.strictObject({
    heading: nonEmpty,
    lead: nonEmpty.includes("{count}"),
    list: z.strictObject({ ...collapsed }),
  }),
  modelSlot: z.strictObject({ ...collapsed, intro: nonEmpty, stubs: labels, expected: nonEmpty }),
  composer: z.strictObject({
    heading: nonEmpty,
    count: countLabel,
    withModel: nonEmpty.includes("{model}"),
    templateOnly: nonEmpty,
    unchanged: nonEmpty,
    changed: nonEmpty,
    decisionHeading: nonEmpty,
    decision: nonEmpty,
    tradeOffHeading: nonEmpty,
    tradeOff: nonEmpty.includes("{median}"),
    opsErrors: nonEmpty.includes("{errors}"),
    opsNoErrors: nonEmpty.includes("{min}"),
  }),
  other: z.strictObject({ ...collapsed, intro: nonEmpty }),
  table: z.strictObject({
    question: nonEmpty,
    outcome: nonEmpty,
    result: nonEmpty,
    pass: nonEmpty,
    fail: nonEmpty,
    empty: nonEmpty,
    refused: nonEmpty.includes("{label}"),
    answered: nonEmpty.includes("{facts}"),
    drafted: nonEmpty.includes("{facts}"),
    clarified: z.strictObject({ intent: nonEmpty, ambiguous: nonEmpty }),
    noAnswer: z.strictObject(
      Object.fromEntries(NO_ANSWER_REASONS.map((r) => [r, nonEmpty])) as Record<NoAnswerReason, typeof nonEmpty>,
    ),
  }),
});

export type EvalsContent = z.infer<typeof EvalsSchema>;

// ---------------------------------------------------------------------------
// Gap report (CLAUDE.md section 5): content/gaps.json is a committed,
// hand-reviewed snapshot written by `pnpm export:gaps`; content/gaps-copy.json
// is the page copy.
// ---------------------------------------------------------------------------

export const GAP_REASONS = ["no-match", "post-check", "language"] as const;
export type GapReason = (typeof GAP_REASONS)[number];

export const GapRowSchema = z.strictObject({
  question: nonEmpty,
  // A concept key from assistant.json, or "unmatched" when no concept was recognised.
  subject: nonEmpty,
  count: z.number().int().min(1),
  firstAt: z.iso.datetime(),
  lastAt: z.iso.datetime(),
  reason: z.enum(GAP_REASONS),
  // Fact ids; labels are resolved from the registry when the page renders.
  nearest: z.array(nonEmpty),
});

export const GapsFileSchema = z.strictObject({
  $comment: comment.optional(),
  generatedAt: z.iso.datetime().nullable(),
  source: z.strictObject({
    linesRead: z.number().int().min(0),
    kept: z.number().int().min(0),
    skipped: z.record(z.string(), z.number().int().min(0)),
    malformed: z.number().int().min(0),
  }),
  gaps: z.array(GapRowSchema),
});
export type GapsFile = z.infer<typeof GapsFileSchema>;
export type GapRow = z.infer<typeof GapRowSchema>;

export const GapsCopySchema = z.strictObject({
  $comment: comment.optional(),
  title: nonEmpty,
  heading: nonEmpty,
  framing: nonEmpty,
  verdict: nonEmpty.includes("{questions}").includes("{subjects}"),
  questions: countLabel,
  subjects: countLabel,
  empty: z.strictObject({ heading: nonEmpty, body: nonEmpty }),
  unmatchedSubject: nonEmpty,
  columns: z.strictObject({ asked: nonEmpty, nearest: nonEmpty, suggested: nonEmpty }),
  noNearest: nonEmpty,
  times: countLabel,
  suggestedPlaceholder: nonEmpty,
});
export type GapsCopy = z.infer<typeof GapsCopySchema>;

export type PayloadPage = z.infer<typeof PayloadPageSchema>;
export type FindingsContent = z.infer<typeof FindingsSchema>;

// ---------------------------------------------------------------------------
// llms.txt copy (content/site.json -> llms)
// ---------------------------------------------------------------------------

export const LlmsCopySchema = z.strictObject({
  title: nonEmpty,
  summary: nonEmpty,
  notes: z.array(nonEmpty),
  pagesHeading: nonEmpty,
  pages: z.array(z.strictObject({ label: nonEmpty, href: nonEmpty, note: nonEmpty })),
  factsHeading: nonEmpty,
  basis: nonEmpty.includes("{basisSource}"),
  forwardLooking: nonEmpty.includes("{kind}"),
  source: nonEmpty,
  accessed: nonEmpty,
  alsoPublishedAs: nonEmpty,
  approval: nonEmpty,
});

export type LlmsCopy = z.infer<typeof LlmsCopySchema>;
