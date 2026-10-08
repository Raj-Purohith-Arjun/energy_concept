import { getFact, getSite } from "@/lib/content";
import { ApprovalState, BasisText, IsoDate, SourceLink } from "./FactParts";
import { FactValue } from "./FactValue";

interface FactProps {
  id: string;
}

// Renders a registry figure with its source panel. Unknown ids throw, which
// fails the prerender and therefore the build.
//
// The panel is a visually hidden checkbox inside a <label>, revealed with
// :has(:checked) in globals.css. That works without JavaScript and needs no
// element ids: a popover would need an id, and Server Component useId() values
// repeat across pages that Cache Components keeps mounted in hidden <Activity>
// trees. Trade-off: no Escape-to-close, and screen readers announce a checkbox.
export function Fact({ id }: FactProps) {
  const fact = getFact(id);
  const ui = getSite().factUi;
  return (
    <span className="fact" data-fact={fact.id}>
      <FactValue fact={fact} />
      <label className="fact-toggle">
        <input
          type="checkbox"
          className="fact-toggle-input sr-only"
          aria-label={ui.showSource.replace("{label}", fact.label)}
        />
        <span aria-hidden="true">ⓘ</span>
      </label>
      <span className="fact-panel">
        <span className="block">
          <span className="font-semibold">{ui.basis}: </span>
          <BasisText basis={fact.basis} basisSource={fact.basisSource} />
        </span>
        <span className="mt-2 block">
          <span className="font-semibold">{ui.source}: </span>
          <SourceLink url={fact.source.url} title={fact.source.title} />
        </span>
        <span className="mt-2 block">
          <span className="font-semibold">{ui.accessed}: </span>
          <IsoDate iso={fact.source.accessed} />
        </span>
        <span className="mt-2 block">
          <ApprovalState approvedAt={fact.approvedAt} />
        </span>
      </span>
    </span>
  );
}
