import Link from "next/link";
import { Fragment } from "react";
import { getAssistant, getSite } from "@/lib/content";
import { TEMPLATE } from "@/lib/assistant/composed";
import type { AssistantOutcome } from "@/lib/assistant/pipeline";
import { plural } from "@/lib/plural";
import type { Fact } from "@/lib/schemas";
import { ApprovalState, BasisText, IsoDate, SourceLink } from "@/components/ui/FactParts";
import { FigureValue } from "@/components/facts/FigureValue";
import { orderedFigures } from "@/lib/figures";

type Of<K extends AssistantOutcome["kind"]> = Extract<AssistantOutcome, { kind: K }>;

// Who wrote the wording, so a fallback to the template is visible to the reader.
export function wordedByLine(wordedBy: string[]): string {
  const { answer } = getAssistant();
  const models = wordedBy.filter((w) => w !== TEMPLATE);
  if (models.length === 0) return answer.wordedByTemplate;
  const model = models.join(", ");
  return (wordedBy.includes(TEMPLATE) ? answer.wordedByMixed : answer.wordedByModel).replace("{model}", model);
}

function YouAsked({ question }: { question: string }) {
  return (
    <p className="text-sm opacity-80">
      {getAssistant().youAsked}: <q>{question}</q>
    </p>
  );
}

export function RefusalPanel({ outcome, question }: { outcome: Of<"refuse">; question: string }) {
  const { refusals, recognisedAs, handoff, intro } = getAssistant();
  const copy = refusals[outcome.category];
  return (
    <article
      aria-labelledby="assistant-result"
      className="rounded-lg border-2 border-amber-500 bg-amber-50 p-5 leading-7 text-amber-950"
    >
      <YouAsked question={question} />
      <p className="mt-3 text-xs font-semibold tracking-wide uppercase">
        {recognisedAs.replace("{label}", copy.label)}
      </p>
      <h2 id="assistant-result" className="mt-1 text-xl font-semibold">
        {copy.title}
      </h2>
      <p className="mt-2">{copy.why}</p>
      <p className="mt-4">
        {handoff.lead}{" "}
        <a href={handoff.href} rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
          {handoff.label}
        </a>{" "}
        {handoff.tail}
      </p>
      <p className="mt-4 border-t border-amber-500/50 pt-3 font-semibold">{intro.hardRule}</p>
    </article>
  );
}

function QuestionLinks({ questions }: { questions: string[] }) {
  return (
    <ul className="mt-1">
      {questions.map((q) => (
        <li key={q}>
          <Link
            href={{ pathname: "/", query: { q } }}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            {q}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The three lines every drafted or clarifying response opens with (CLAUDE.md §3).
function Trace({ lines }: { lines: { label: string; text: string }[] }) {
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
      {lines.map(({ label, text }) => (
        <Fragment key={label}>
          <dt className="font-semibold">{label}</dt>
          <dd>{text}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function NoAnswerPanel({ outcome, question }: { outcome: Of<"no-answer">; question?: string }) {
  const { noAnswer, examples, draft } = getAssistant();
  const copy = outcome.reason === "draft" && outcome.format ? draft.unsupported[outcome.format] : noAnswer[outcome.reason];
  const draftReason = outcome.reason === "draft" || outcome.reason === "draft-topic";
  const nearby = outcome.nearest.map((n) => n.question);
  // Nothing near the question: offer questions it can answer, not a wall of labels.
  const curated = !draftReason && nearby.length === 0 && outcome.coverage.length > 0 ? examples.groups[0].questions : [];
  const suggestions = nearby.length > 0 ? nearby : curated;
  const lead = draftReason ? noAnswer.draftLead : nearby.length > 0 ? noAnswer.nearestLead : noAnswer.examplesLead;
  return (
    <article aria-labelledby="assistant-result" className="rounded-lg border border-current/20 p-5 leading-7">
      {question && <YouAsked question={question} />}
      <h2 id="assistant-result" className="mt-1 text-xl font-semibold">
        {copy.title}
      </h2>
      <p className="mt-2">{copy.body}</p>
      {suggestions.length > 0 && (
        <>
          <p className="mt-4 font-semibold">{lead}</p>
          <QuestionLinks questions={suggestions} />
        </>
      )}
      {outcome.coverage.length > 0 && (
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">{noAnswer.coverageLead}</summary>
          <ul className="mt-1 grid list-disc gap-x-8 pl-5 text-sm sm:grid-cols-2">
            {outcome.coverage.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <p className="mt-2">
            <Link href={noAnswer.registryLink.href} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
              {noAnswer.registryLink.label}
            </Link>
          </p>
        </details>
      )}
    </article>
  );
}

export function ClarifyPanel({ outcome, question }: { outcome: Of<"clarify">; question: string }) {
  const { clarify, trace } = getAssistant();
  const copy = clarify[outcome.why];
  const questions = (mode: "draft" | "answer") => outcome.options.filter((o) => o.mode === mode).map((o) => o.question);
  return (
    <article aria-labelledby="assistant-result" className="rounded-lg border-2 border-current/40 p-5 leading-7">
      <YouAsked question={question} />
      <h2 id="assistant-result" className="mt-1 text-xl font-semibold">
        {copy.title}
      </h2>
      <p className="mt-2">{copy.body}</p>
      <Trace
        lines={[
          { label: trace.understood, text: copy.understood },
          { label: trace.did, text: copy.did },
        ]}
      />
      {outcome.why === "intent" ? (
        <>
          {questions("draft").length > 0 && (
            <>
              <p className="mt-4 font-semibold">{clarify.intent.draftLead}</p>
              <QuestionLinks questions={questions("draft")} />
            </>
          )}
          {questions("answer").length > 0 && (
            <>
              <p className="mt-4 font-semibold">{clarify.intent.answerLead}</p>
              <QuestionLinks questions={questions("answer")} />
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-4 font-semibold">{clarify.ambiguous.lead}</p>
          <QuestionLinks questions={questions("answer")} />
        </>
      )}
    </article>
  );
}

function Citation({ fact }: { fact: Fact }) {
  const ui = getSite().factUi;
  // The stated figure leads; an inferred one follows with its own basis.
  const [lead, ...others] = orderedFigures(fact);
  return (
    <li className="rounded-lg border border-current/15 p-4 text-sm leading-6">
      <p className="font-medium">{fact.label}</p>
      <p className="text-lg">
        <FigureValue fact={fact} figure={lead} />
      </p>
      <p className="mt-1">
        <span className="font-semibold">{ui.basis}: </span>
        <BasisText basis={lead.basis} basisSource={lead.basisSource} />
      </p>
      {others.map((figure) => (
        <p key={figure.value + figure.url} className="mt-2 border-l-2 border-current/20 pl-3">
          <span className="font-semibold">{ui.alsoPublished}: </span>
          <FigureValue fact={fact} figure={figure} />
          {" — "}
          <BasisText basis={figure.basis} basisSource={figure.basisSource} />{" "}
          <SourceLink url={figure.url} title={figure.title} />
        </p>
      ))}
      <p className="mt-2 opacity-80">
        {ui.kinds[fact.kind]} · {fact.owner} · <SourceLink url={fact.source.url} title={fact.source.title} /> ·{" "}
        {ui.accessed} <IsoDate iso={fact.source.accessed} /> · <ApprovalState approvedAt={fact.approvedAt} />
      </p>
    </li>
  );
}

export function AnswerPanel({ outcome, question }: { outcome: Of<"answer">; question: string }) {
  const { answer } = getAssistant();
  return (
    <article aria-labelledby="assistant-result" className="rounded-lg border border-current/20 p-5 leading-7">
      <YouAsked question={question} />
      <h2 id="assistant-result" className="mt-1 text-xl font-semibold">
        {answer.heading}
      </h2>
      {outcome.text.split("\n").map((line) => (
        <p key={line} className="mt-2">
          {line}
        </p>
      ))}
      <p className="mt-3 text-sm" data-worded-by={outcome.wordedBy.join(" ")}>
        {wordedByLine(outcome.wordedBy)}
      </p>
      <h3 className="mt-5 text-sm font-semibold tracking-wide uppercase opacity-80">{answer.sourcesHeading}</h3>
      <ul className="mt-2 grid gap-3">
        {outcome.facts.map((fact) => (
          <Citation key={fact.id} fact={fact} />
        ))}
      </ul>
    </article>
  );
}

export function DraftPanel({ outcome, question }: { outcome: Of<"draft">; question: string }) {
  const { draft, trace } = getAssistant();
  const { result } = draft;
  const { rejected } = result;
  return (
    <article aria-labelledby="assistant-result" className="rounded-lg border border-current/20 p-5 leading-7">
      <YouAsked question={question} />
      <h2 id="assistant-result" className="mt-1 text-xl font-semibold">
        {result.heading}
      </h2>
      <Trace
        lines={[
          { label: trace.understood, text: outcome.asQuestion ? result.understoodQuestion : result.understoodPost },
          { label: trace.matched, text: result.matched.replace("{topics}", outcome.topics.join(", ")) },
          { label: trace.did, text: result.did },
        ]}
      />
      {outcome.ignored.length > 0 && (
        <p className="mt-3 rounded border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {result.ignored.replace("{phrases}", outcome.ignored.map((p) => `“${p}”`).join(", "))}
        </p>
      )}
      <label htmlFor="draft-text" className="mt-4 block text-sm font-semibold">
        {result.editLabel}
      </label>
      {/* A plain textarea: editable and selectable with no client JavaScript. */}
      <textarea
        id="draft-text"
        defaultValue={outcome.text}
        rows={outcome.text.split("\n").length + 1}
        className="mt-1 w-full rounded-lg border border-current/30 p-3 leading-7"
      />
      <p className="mt-1 text-sm">{result.editHint}</p>
      <p className="mt-1 text-sm font-semibold">{result.notice}</p>
      <p className="mt-3 text-sm" data-worded-by={outcome.wordedBy.join(" ")}>
        {wordedByLine(outcome.wordedBy)}
      </p>
      {/* Collapsed: the count says everything was sourced; the detail is one click away. */}
      <details className="mt-5">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">
          {plural(outcome.facts.length, result.figuresSummary)}
        </summary>
        <ul className="mt-2 grid gap-3">
          {outcome.facts.map((fact) => (
            <Citation key={fact.id} fact={fact} />
          ))}
        </ul>
      </details>
      {outcome.rejected.length > 0 && (
        <details open className="mt-5 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-amber-950">
          <summary className="cursor-pointer font-semibold">{rejected.heading}</summary>
          <p className="mt-2">{rejected.intro}</p>
          {outcome.rejected.map((r) => (
            <div key={r.text} className="mt-3">
              <p className="text-sm font-semibold">{rejected.wrote}</p>
              <pre className="mt-1 text-sm whitespace-pre-wrap">{r.text}</pre>
              <p className="mt-2 text-sm font-semibold">{rejected.wrong}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {r.problems.map((p) => (
                  <li key={p.detail}>{p.detail}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-3 font-semibold">{rejected.shipped}</p>
        </details>
      )}
    </article>
  );
}
