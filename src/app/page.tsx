import type { Metadata } from "next";
import { Suspense } from "react";
import { AskForm } from "@/components/assistant/AskForm";
import { AssistantResponse, AssistantResponseFallback } from "@/components/assistant/AssistantResponse";
import { ExampleQuestions } from "@/components/assistant/ExampleQuestions";
import { getAssistant, pageTitle } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: pageTitle(getAssistant().pageTitle) },
};

export default function Home({ searchParams }: PageProps<"/">) {
  const { intro, form, maxLength } = getAssistant();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{intro.heading}</h1>
      <p className="mt-3 leading-7">{intro.body}</p>
      <p className="mt-5 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 font-semibold leading-7 text-amber-950">
        {intro.hardRule}
      </p>

      <AskForm copy={form} maxLength={maxLength} />

      {/* Reserved height so an answer streaming in doesn't push the examples. */}
      <div aria-live="polite" className="mt-8 min-h-48">
        <Suspense fallback={<AssistantResponseFallback />}>
          <AssistantResponse searchParams={searchParams} />
        </Suspense>
      </div>

      <ExampleQuestions />
    </div>
  );
}
