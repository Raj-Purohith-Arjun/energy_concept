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
  "planned-figure",
] as const;
export type RefusalCategory = (typeof REFUSAL_CATEGORIES)[number];

export const NO_ANSWER_REASONS = ["no-match", "post-check", "language", "empty", "too-long"] as const;
export type NoAnswerReason = (typeof NO_ANSWER_REASONS)[number];

const RefusalCopySchema = z.strictObject({ label: nonEmpty, title: nonEmpty, why: nonEmpty });
const NoAnswerCopySchema = z.strictObject({ title: nonEmpty, body: nonEmpty });

export const AssistantSchema = z.strictObject({
  $comment: comment.optional(),
  pageTitle: nonEmpty,
  intro: z.strictObject({ heading: nonEmpty, body: nonEmpty, hardRule: nonEmpty }),
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
  }),
  answer: z.strictObject({
    heading: nonEmpty,
    factLine: nonEmpty.includes("{label}").includes("{value}"),
    alsoLine: nonEmpty.includes("{value}"),
    sourcesHeading: nonEmpty,
  }),
  concepts: z.record(kebabId, z.array(nonEmpty).min(1)),
  factConcepts: z.record(kebabId, z.array(kebabId).min(1)),
  related: z.record(kebabId, z.array(kebabId).min(1)),
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
