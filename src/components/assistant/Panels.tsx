import { getAssistant, getSite } from "@/lib/content";
import { TEMPLATE } from "@/lib/assistant/composed";
import type { AssistantOutcome } from "@/lib/assistant/pipeline";
import type { Fact } from "@/lib/schemas";
import { ApprovalState, BasisText, IsoDate, SourceLink } from "@/components/ui/FactParts";
import { FactValue } from "@/components/ui/FactValue";

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
      {outcome.sources.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {outcome.sources.map((s) => (
            <li key={s.url + s.title}>
              <SourceLink url={s.url} title={s.title} />
            </li>
          ))}
        </ul>
      )}
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

export function NoAnswerPanel({ outcome, question }: { outcome: Of<"no-answer">; question?: string }) {
  const { noAnswer } = getAssistant();
  const copy = noAnswer[outcome.reason];
  return (
    <article aria-labelledby="assistant-result" className="rounded-lg border border-current/20 p-5 leading-7">
      {question && <YouAsked question={question} />}
      <h2 id="assistant-result" className="mt-1 text-xl font-semibold">
        {copy.title}
      </h2>
      <p className="mt-2">{copy.body}</p>
      {outcome.coverage.length > 0 && (
        <>
          <p className="mt-4 font-semibold">{noAnswer.coverageLead}</p>
          <ul className="mt-1 grid list-disc gap-x-8 pl-5 text-sm sm:grid-cols-2">
            {outcome.coverage.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function Citation({ fact }: { fact: Fact }) {
  const ui = getSite().factUi;
  return (
    <li className="rounded-lg border border-current/15 p-4 text-sm leading-6">
      <p className="font-medium">{fact.label}</p>
      <p className="text-lg">
        <FactValue fact={fact} />
      </p>
      <p className="mt-1">
        <span className="font-semibold">{ui.basis}: </span>
        <BasisText basis={fact.basis} basisSource={fact.basisSource} />
      </p>
      {fact.alsoPublishedAs.map((alt) => (
        <p key={alt.value + alt.url} className="mt-2 border-l-2 border-current/20 pl-3">
          <span className="font-semibold tabular-nums">{alt.value}</span>
          {" — "}
          <BasisText basis={alt.basis} basisSource={alt.basisSource} /> <SourceLink url={alt.url} />
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
