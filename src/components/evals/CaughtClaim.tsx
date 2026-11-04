import { CAUGHT_TOPIC, findCaughtClaim } from "@/lib/assistant/caught-claim";
import { getPostStore, shippedPostText } from "@/lib/assistant/composed-posts";
import { draftPool } from "@/lib/assistant/draft";
import { FactValue } from "@/components/ui/FactValue";
import { getAllFacts, getAssistant, getEvals, getSite } from "@/lib/content";
import { fill } from "@/lib/evals-view";
import type { CSSProperties } from "react";

const at = (i: number) => ({ "--i": i }) as CSSProperties;

// One stored rejection, walked through in steps. CSS only (see .cc-* in
// globals.css), no client JS. Every step is in its final state until the viewer
// presses play, and with reduced motion the control is gone and that state stays.
//
// One tap replays: CSS restarts an animation only when its name changes, and
// clicking a checked radio does nothing. So there are two radios under one button,
// the unchecked one on top, and each runs under its own keyframe name.
//
// FactValue, not Fact: the source panel would show the basis wording while the
// step below refuses that word. See limitation.notes in content/evals.json.
export async function CaughtClaim() {
  const c = getEvals().caughtClaim;
  const r = getEvals().postRejections;
  const assistant = getAssistant();
  const pool = draftPool([CAUGHT_TOPIC], getAllFacts(), assistant).slice(0, assistant.draft.maxFacts);
  const claim = findCaughtClaim(getPostStore().rejections, pool, {
    brand: assistant.draft.brand,
    forwardLooking: getSite().forwardLooking,
  });
  const shipped = await shippedPostText(CAUGHT_TOPIC);

  const button = "lt-play-label relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-current px-4 font-semibold";
  return (
    <section aria-labelledby="caught-claim" data-caught-claim="" className="lt mt-8 rounded-lg border-2 border-red-700 p-5 sm:p-6 dark:border-red-400">
      <h2 id="caught-claim" className="h-section">
        {c.heading}
      </h2>
      <div role="radiogroup" aria-labelledby="caught-claim" className="cc-play mt-4">
        <label className={button}>
          <input type="radio" name="cc-play" autoComplete="off" className="lt-play sr-only" />
          <span aria-hidden="true" className="lt-glyph" />
          {c.play}
        </label>
        <label className={button}>
          <input type="radio" name="cc-play" autoComplete="off" aria-label={c.playAgain} className="cc-b lt-play sr-only" />
          <span aria-hidden="true" className="lt-glyph" />
          {c.play}
        </label>
      </div>
      {/* Hidden with the control under reduced motion: there is nothing to replay. */}
      <p className="cc-note mt-3 max-w-3xl text-sm leading-6 text-muted">{c.replayNote}</p>
      <ol className="mt-6 grid max-w-3xl list-decimal gap-5 pl-5 leading-7">
        <li className="cc-step" style={at(0)}>
          <h3 className="font-semibold">{r.columns.wrote}</h3>
          <div>
            {claim.words.map((w, i) => (
              <span key={`${i}-${w.text}`}>
                <span className="cc-w" style={at(i)}>
                  {w.fact ? (
                    <FactValue fact={w.fact} />
                  ) : w.caught ? (
                    <span className="cc-word font-semibold text-red-700 dark:text-red-400">
                      {w.text}
                      <span aria-hidden="true" className="cc-strike" />
                    </span>
                  ) : (
                    w.text
                  )}
                </span>{" "}
              </span>
            ))}
          </div>
          <div className="text-sm text-muted">{fill(r.writtenBy, { model: claim.model })}</div>
        </li>
        <li className="cc-step" style={at(1)}>
          <h3 className="font-semibold">{c.figuresChecked}</h3>
          <ul className="grid gap-1">
            {pool.map((fact) => (
              <li key={fact.id}>
                <span aria-hidden="true">✓ </span>
                {fact.label}: <FactValue fact={fact} />
              </li>
            ))}
          </ul>
        </li>
        <li className="cc-step" style={at(2)}>
          <h3 className="font-semibold">{r.columns.why}</h3>
          <div className="font-semibold text-red-700 dark:text-red-400">{claim.reason}</div>
          <div>{c.provenance}</div>
        </li>
        <li className="cc-step" style={at(3)}>
          <h3 className="font-semibold">{r.columns.shipped}</h3>
          <pre className="font-sans whitespace-pre-wrap [overflow-wrap:anywhere]">{shipped}</pre>
        </li>
      </ol>
    </section>
  );
}
