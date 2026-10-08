import Link from "next/link";
import { getSite } from "@/lib/content";

const linkClass = "inline-flex min-h-11 items-center text-sm hover:text-white lg:min-h-8";

export function SiteFooter() {
  const { columns, contact, notice, credit, copyright } = getSite().footer;
  return (
    <footer className="bg-neutral-950 text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <nav aria-label="Footer">
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
            {columns.map((column, i) => (
              <div key={column.heading ?? `group-${i}`}>
                {column.heading && (
                  <h2 className="mb-2 text-sm font-semibold text-white">{column.heading}</h2>
                )}
                <ul>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <address className="text-sm not-italic">
              <p className="py-1">{contact.email}</p>
              {contact.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <Link href={contact.link.href} className={`${linkClass} mt-2`}>
                {contact.link.label}
              </Link>
            </address>
          </div>
        </nav>

        <section
          aria-labelledby="concept-notice"
          className="mt-16 rounded-lg border border-white/10 p-6 text-sm leading-6"
        >
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

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs md:flex-row md:justify-between">
          <p>{credit}</p>
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
