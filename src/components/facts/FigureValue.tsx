import type { Fact } from "@/lib/schemas";
import type { Figure } from "@/lib/figures";
import { FactValue } from "@/components/ui/FactValue";

// One published figure. The registry's own figure keeps its markers (planned,
// estimate, unverified); the others are plain values.
export function FigureValue({ fact, figure }: { fact: Fact; figure: Figure }) {
  return figure.primary ? <FactValue fact={fact} /> : <span className="font-semibold tabular-nums">{figure.value}</span>;
}
