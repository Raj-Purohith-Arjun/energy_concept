import { getPostStore, shippedPostText } from "@/lib/assistant/composed-posts";
import { getAssistant, getEvals } from "@/lib/content";
import { fill } from "@/lib/evals-view";

// Whole posts the model wrote at build time that the checks refused, from the
// append-only log in data/composed-posts.json: what it wrote, every check it
// failed, and the template post readers get instead. Nothing here is typed or
// staged: with no refusals recorded, it says so.
export async function PostRejections() {
  const r = getEvals().postRejections;
  const model = getPostStore().model;
  const assistant = getAssistant();
  const rows = await Promise.all(
    getPostStore().rejections.map(async (rej) => ({
      ...rej,
      label: assistant.draft.topics[rej.topicId]?.label ?? rej.topicId,
      shipped: await shippedPostText(rej.topicId),
    })),
  );

  return (
    <section aria-labelledby="post-rejections" className="mt-16 rounded-lg border-2 border-red-700 p-5 sm:p-6 dark:border-red-400">
      <h2 id="post-rejections" className="h-section">
        {r.heading}
      </h2>
      {model && <p className="mt-3 max-w-3xl font-semibold leading-7">{fill(r.composer, { model })}</p>}
      <p className="mt-3 max-w-3xl leading-7">{r.sources}</p>
      <p className="mt-3 max-w-3xl leading-7">{rows.length > 0 ? r.intro : r.none}</p>
      <h3 className="mt-5 font-semibold">{r.mechanism.heading}</h3>
      <p className="mt-1 max-w-3xl leading-7">{r.mechanism.body}</p>
      <h3 className="mt-5 font-semibold">{r.limitation.heading}</h3>
      <p className="mt-1 max-w-3xl leading-7">{r.limitation.body}</p>
      {r.limitation.notes.map((note) => (
        <p key={note} className="mt-3 max-w-3xl leading-7">
          {note}
        </p>
      ))}
      <div className="mt-6 grid gap-6">
        {rows.map((row) => (
          <article key={`${row.topicId}-${row.at}-${row.text}`} data-post-rejection={row.topicId} className="border-l-4 border-line pl-4">
            <h3 className="font-semibold">{row.label}</h3>
            <p className="text-sm text-muted">{fill(r.writtenBy, { model: row.model })}</p>
            {row.note && <p className="mt-2 max-w-3xl text-sm font-semibold leading-6">{row.note}</p>}
            <dl className="mt-2 grid gap-2 text-sm leading-6 sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">{r.columns.wrote}</dt>
              <dd>
                <pre className="font-sans whitespace-pre-wrap [overflow-wrap:anywhere]">{row.text}</pre>
              </dd>
              <dt className="font-semibold">{r.columns.why}</dt>
              <dd>
                <ul className="list-disc pl-5">
                  {row.problems.map((p) => (
                    <li key={p.detail}>{p.detail}</li>
                  ))}
                </ul>
              </dd>
              <dt className="font-semibold">{r.columns.shipped}</dt>
              <dd>
                <pre className="font-sans whitespace-pre-wrap [overflow-wrap:anywhere]">{row.shipped}</pre>
              </dd>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
