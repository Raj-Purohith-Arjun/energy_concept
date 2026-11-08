import { describe, expect, it } from "vitest";
import { getEvals, getFindings } from "@/lib/content";

// The back-navigation limitation is stated on two pages that share one replay
// pattern (checkbox or radio driving a CSS animation). One wording, so a reader
// who sees it twice sees the same thing, and an edit to one cannot leave the
// other saying something different.
describe("replay limitation note", () => {
  it("reads the same on /evals and /findings", () => {
    expect(getFindings().timeline.replayNote).toBe(getEvals().caughtClaim.replayNote);
  });

  it("says what happens and why, in plain words", () => {
    const note = getFindings().timeline.replayNote;
    expect(note).toMatch(/press back/);
    expect(note).toMatch(/start again by itself/);
    expect(note).toMatch(/CSS cannot reset/);
  });
});
