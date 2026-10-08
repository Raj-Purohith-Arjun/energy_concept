import type { ReactNode } from "react";
import { ForwardLookingNote } from "@/components/ui/ForwardLookingNote";

// Each route renders its own template instance inside its own <Activity>
// boundary, so this frame scopes the forward-looking footnote to one page.
// A future route folder with sibling pages (e.g. a/[slug]) needs its own
// template.tsx re-exporting this one, so each sibling gets its own frame.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="page-frame flex flex-1 flex-col">
      {children}
      <ForwardLookingNote />
    </div>
  );
}
