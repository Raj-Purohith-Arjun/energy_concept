import { Fact } from "@/components/ui/Fact";
import { getFindings } from "@/lib/content";
import { isTodo } from "@/lib/schemas";

// A measured figure, or visible pending text for a TODO(content) cell.
export function FactOrPending({ factRef }: { factRef: string }) {
  if (isTodo(factRef)) {
    return <span className="text-sm italic">{getFindings().pending}</span>;
  }
  return <Fact id={factRef} />;
}
