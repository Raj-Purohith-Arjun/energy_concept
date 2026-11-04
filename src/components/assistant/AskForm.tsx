"use client";

import Form from "next/form";
import { useId } from "react";
import { useFormStatus } from "react-dom";
import type { AssistantContent } from "@/lib/schemas";

interface AskFormProps {
  copy: AssistantContent["form"];
  maxLength: number;
}

// The only client island on this page (CLAUDE.md §4). next/form submits as a
// GET to /?q=..., so it also works without JavaScript; with JS it navigates
// client-side and the server renders the answer. No answer logic lives here.
export function AskForm({ copy, maxLength }: AskFormProps) {
  const id = useId();
  const privacyId = `${id}-privacy`;
  return (
    <Form action="/" className="mt-8">
      <label htmlFor={id} className="block font-semibold">
        {copy.label}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          id={id}
          name="q"
          required
          rows={2}
          maxLength={maxLength}
          placeholder={copy.placeholder}
          aria-describedby={privacyId}
          onKeyDown={(event) => {
            // Enter asks, Shift+Enter adds a line; never mid-IME composition.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="min-h-11 w-full flex-1 resize-y rounded-lg border border-line bg-transparent px-3 py-2"
        />
        <SubmitButton idle={copy.submit} pending={copy.pending} />
      </div>
      <p id={privacyId} className="mt-2 text-xs leading-5 text-muted">
        {copy.privacy}
      </p>
    </Form>
  );
}

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={status.pending}
      className="min-h-11 shrink-0 rounded-lg bg-neutral-900 px-5 font-semibold text-white aria-disabled:opacity-70 dark:bg-white dark:text-neutral-900"
    >
      {status.pending ? pending : idle}
    </button>
  );
}
