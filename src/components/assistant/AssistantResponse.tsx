import { ask } from "@/lib/assistant/pipeline";
import { getAssistant, getVerifiedFacts } from "@/lib/content";
import { recordUnanswered } from "@/lib/assistant/unanswered";
import { AnswerPanel, ClarifyPanel, DraftPanel, NoAnswerPanel, RefusalPanel } from "./Panels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Server-rendered per request from ?q=. Rendered inside <Suspense> so the rest
// of / stays a static prerendered shell (Cache Components / PPR).
export async function AssistantResponse({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  if (raw === undefined) return null;

  const outcome = await ask(raw, { facts: getVerifiedFacts(), assistant: getAssistant() });
  const question = raw.trim();

  if (outcome.kind === "refuse") return <RefusalPanel outcome={outcome} question={question} />;
  if (outcome.kind === "answer") return <AnswerPanel outcome={outcome} question={question} />;
  if (outcome.kind === "draft") return <DraftPanel outcome={outcome} question={question} />;
  // Asked back, not a gap: nothing is logged.
  if (outcome.kind === "clarify") return <ClarifyPanel outcome={outcome} question={question} />;
  // Questions it can't answer are the content backlog (CLAUDE.md §3, §5).
  await recordUnanswered(outcome.reason, question);
  // Don't echo empty or over-long input back onto the page.
  const echo = outcome.reason === "empty" || outcome.reason === "too-long" ? undefined : question;
  return <NoAnswerPanel outcome={outcome} question={echo} />;
}

export function AssistantResponseFallback() {
  return (
    <p aria-busy="true" className="py-5 opacity-70">
      {getAssistant().form.pending}
    </p>
  );
}
