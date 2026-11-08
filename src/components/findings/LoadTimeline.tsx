import type { CSSProperties } from "react";
import { Fact } from "@/components/ui/Fact";
import { factSeconds, getFact, getFindings } from "@/lib/content";

// Two phones replaying the measured lab timelines at real speed: blank, first
// paint, then the largest element. CSS only (see .lt-* in globals.css): the play
// control is a checkbox like the <Fact> source panels, and only opacity and
// transform animate. Timings reach CSS as custom properties read from the
// registry, so nothing is typed and the replay cannot drift from the facts.
// Without play, or with reduced motion, both phones show their end state.
export function LoadTimeline() {
  const t = getFindings().timeline;
  // validateFindings guarantees both ids are timing facts, fcp <= lcp.
  const seconds = (id: string) => factSeconds(getFact(id)) ?? 0;
  const phones = t.phones.map((p) => ({ ...p, fcpS: seconds(p.fcp), lcpS: seconds(p.lcp) }));
  const total = Math.max(...phones.map((p) => p.lcpS));
  const at = (s: number) => `${(s / total) * 100}%`;

  return (
    <section aria-labelledby="load-timeline" className="lt mt-16">
      <h2 id="load-timeline" className="h-section">
        {t.heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{t.intro}</p>
      <label className="lt-play-label mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-current px-4 font-semibold">
        <input type="checkbox" className="lt-play sr-only" />
        <span aria-hidden="true" className="lt-glyph" />
        {t.play}
      </label>
      {/* Hidden with the control under reduced motion: there is nothing to replay. */}
      <p className="lt-note mt-3 max-w-3xl text-sm leading-6 text-muted">{t.replayNote}</p>
      <div className="mt-6 grid max-w-xl grid-cols-2 gap-4 sm:gap-8">
        {phones.map((p) => (
          <figure
            key={p.label}
            className="lt-phone"
            style={{ "--fcp": `${p.fcpS}s`, "--lcp": `${p.lcpS}s` } as CSSProperties}
          >
            <figcaption className="font-semibold">{p.label}</figcaption>
            <div className="lt-screen mt-2" aria-hidden="true">
              <div className="lt-first">
                <span className="lt-line lt-line-wide" />
                <span className="lt-line" />
                <span className="lt-line lt-line-short" />
              </div>
              <div className="lt-main" />
            </div>
            <div className="lt-track mt-3" aria-hidden="true">
              <span className="lt-fill" style={{ width: at(p.lcpS) }} />
              <span className="lt-mark" style={{ left: at(p.fcpS) }} />
            </div>
            <dl className="mt-3 grid gap-1 text-sm">
              <div>
                <dt className="inline">{t.firstPaint}: </dt>
                <dd className="inline">
                  <Fact id={p.fcp} />
                </dd>
              </div>
              <div>
                <dt className="inline">{t.mainPaint}: </dt>
                <dd className="inline">
                  <Fact id={p.lcp} />
                </dd>
              </div>
            </dl>
          </figure>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6">{t.caption}</p>
    </section>
  );
}
