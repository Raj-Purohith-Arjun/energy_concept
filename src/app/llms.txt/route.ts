import { getAllFacts, getSite } from "@/lib/content";
import { renderLlmsTxt } from "@/lib/llms";

// No request data is read, so with Cache Components this GET handler is
// prerendered at build time, like a static page.
export function GET() {
  const site = getSite();
  return new Response(renderLlmsTxt(getAllFacts(), site.llms, site.factUi.kinds), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
