import { getSite } from "@/lib/content";

export function SiteFooter() {
  const { notice, credit } = getSite().footer;
  return (
    <footer className="bg-neutral-950 text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <section aria-labelledby="concept-notice" className="max-w-3xl text-sm leading-6">
          <h2 id="concept-notice" className="mb-2 font-semibold text-white">
            {notice.heading}
          </h2>
          {notice.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mb-2">
              {paragraph}
            </p>
          ))}
          <p>
            {notice.official.lead}{" "}
            <a
              href={notice.official.href}
              rel="noopener noreferrer"
              className="text-white underline underline-offset-4"
            >
              {notice.official.label}
            </a>
            .
          </p>
        </section>

        <p className="mt-8 border-t border-white/10 pt-6 text-xs">{credit}</p>
      </div>
    </footer>
  );
}
