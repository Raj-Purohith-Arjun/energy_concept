import type { Metadata } from "next";
import { GapsReport } from "@/components/gaps/GapsReport";
import { getAllFacts, getGaps, getGapsCopy } from "@/lib/content";

// "(demo)" comes from the site title template in layout.tsx.
export const metadata: Metadata = {
  title: getGapsCopy().title,
};

// Reads the committed snapshot content/gaps.json, never the git-ignored log.
export default function GapsPage() {
  return <GapsReport gaps={getGaps()} facts={getAllFacts()} copy={getGapsCopy()} />;
}
