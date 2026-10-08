import { getSite } from "@/lib/content";
import { isTodo, type BasisSource } from "@/lib/schemas";

// Small server-rendered pieces shared by the <Fact> panel and the /facts page.
// All of them render phrasing content (spans), so they are valid inside <p>.

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export function IsoDate({ iso }: { iso: string }) {
  return <time dateTime={iso}>{dateFormat.format(new Date(`${iso}T00:00:00Z`))}</time>;
}

export function BasisText({ basis, basisSource }: { basis: string; basisSource: BasisSource }) {
  const { inferred } = getSite().factUi;
  return (
    <span>
      {basisSource === "inferred" && (
        <span className="mr-1.5 inline-block rounded border border-dashed border-current px-1.5 text-xs font-semibold">
          {inferred}
        </span>
      )}
      {basis}
    </span>
  );
}

function displayUrl(url: string): string {
  const { hostname, pathname } = new URL(url);
  return `${hostname.replace(/^www\./, "")}${pathname === "/" ? "" : pathname}`;
}

// A TODO(content) URL is never rendered as a link.
export function SourceLink({ url, title }: { url: string; title?: string }) {
  if (isTodo(url)) {
    return <span className="font-semibold text-red-800 dark:text-red-300">{getSite().factUi.sourcePending}</span>;
  }
  return (
    <a href={url} rel="noopener noreferrer" className="underline underline-offset-2 break-words">
      {title ?? displayUrl(url)}
    </a>
  );
}

export function ApprovalState({ approvedAt }: { approvedAt: string | null }) {
  const { pendingApproval, approved } = getSite().factUi;
  if (approvedAt === null) return <span>{pendingApproval}</span>;
  return (
    <span>
      {approved} <IsoDate iso={approvedAt} />
    </span>
  );
}

// Always real text, never CSS-generated, and no prop can suppress it.
export function UnverifiedMarker() {
  return (
    <span className="fact-unverified ml-1.5 inline-block rounded border-2 border-red-700 bg-red-50 px-1.5 align-middle text-xs font-bold tracking-wide text-red-800 uppercase">
      {getSite().factUi.unverified}
    </span>
  );
}
