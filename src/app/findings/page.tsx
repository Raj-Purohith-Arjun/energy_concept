import type { Metadata } from "next";
import { BeforeAfter } from "@/components/findings/BeforeAfter";
import { BundleWeight } from "@/components/findings/BundleWeight";
import { Caveats } from "@/components/findings/Caveats";
import { FirstWeek } from "@/components/findings/FirstWeek";
import { LoadTimeline } from "@/components/findings/LoadTimeline";
import { PayloadBreakdown } from "@/components/findings/PayloadBreakdown";
import { RegistryFindings } from "@/components/findings/RegistryFindings";
import { Verdict } from "@/components/findings/Verdict";
import { WhyPlain } from "@/components/findings/WhyPlain";
import { getFindings } from "@/lib/content";

export const metadata: Metadata = {
  title: getFindings().title,
};

// Phase C/D: the argument on one page, ordered for a 15-second skim: verdict,
// load replay, bytes, table; caveats, registry and first week collapsed.
// Server components only; no client JS beyond the site-wide mobile menu, and
// no images.
export default function FindingsPage() {
  const page = getFindings();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 lg:px-8">
      <h1 className="h-page">{page.heading}</h1>
      <Verdict />
      <p className="mt-6 max-w-3xl leading-7">{page.intro}</p>
      <p className="mt-3">
        <a href="#caveats" className="inline-flex min-h-11 items-center underline underline-offset-4">
          {page.caveatsLink}
        </a>
      </p>
      <WhyPlain />
      <LoadTimeline />
      <PayloadBreakdown />
      <BeforeAfter />
      <BundleWeight />
      <Caveats />
      <RegistryFindings />
      <FirstWeek />
    </div>
  );
}
