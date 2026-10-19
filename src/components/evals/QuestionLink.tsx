import { questionText } from "@/lib/evals-view";

/** The live assistant with this question already asked. */
export function askHref(question: string): string {
  return `/?q=${encodeURIComponent(question.trim())}`;
}

// Every example question on /evals opens the real assistant. A plain <a>, not
// next/link: no prefetch, no client JS. Blank questions can't be asked, so
// they render as text.
export function QuestionLink({ question }: { question: string }) {
  const text = questionText(question);
  if (question.trim() === "") return <>{text}</>;
  return (
    <a href={askHref(question)} className="underline underline-offset-4">
      {text}
    </a>
  );
}
