import { getFindings } from "@/lib/content";

export function FirstWeek() {
  const { heading, intro, points } = getFindings().firstWeek;
  return (
    <section aria-labelledby="first-week" className="mt-16">
      <h2 id="first-week" className="text-2xl font-semibold tracking-tight">
        {heading}
      </h2>
      <p className="mt-3 max-w-3xl leading-7">{intro}</p>
      <ol className="mt-4 grid max-w-3xl list-decimal gap-3 pl-5 leading-7">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
    </section>
  );
}
