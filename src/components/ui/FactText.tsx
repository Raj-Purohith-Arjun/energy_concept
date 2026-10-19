import { parseFactText } from "@/lib/fact-text";
import { Fact } from "./Fact";

// Prose from content/*.json with {fact:<id>} tokens rendered as <Fact>.
// Phrasing content only, so it is valid inside <p> and <li>.
export function FactText({ text }: { text: string }) {
  return (
    <>
      {parseFactText(text).map((part, i) =>
        "factId" in part ? <Fact key={i} id={part.factId} /> : <span key={i}>{part.text}</span>,
      )}
    </>
  );
}
