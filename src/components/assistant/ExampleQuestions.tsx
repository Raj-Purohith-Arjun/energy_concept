import Link from "next/link";
import { getAssistant } from "@/lib/content";

// Plain links to /?q=..., so any outcome can be opened from a bookmark.
export function ExampleQuestions() {
  const { heading, groups } = getAssistant().examples;
  return (
    <section aria-labelledby="examples" className="mt-12">
      <h2 id="examples" className="text-lg font-semibold">
        {heading}
      </h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="text-sm font-semibold text-muted">{group.label}</h3>
            <ul className="mt-2">
              {group.questions.map((q) => (
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
          </div>
        ))}
      </div>
    </section>
  );
}
