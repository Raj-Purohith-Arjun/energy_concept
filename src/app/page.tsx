import type { Metadata } from "next";
import { getSite, pageTitle } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: pageTitle("Home") },
};

export default function Home() {
  const { brand } = getSite();
  return (
    // TODO(content): placeholder until the Phase 1 hero. `data-header-overlay`
    // opts this page into the transparent header; the negative margin slides
    // the section underneath it.
    <section
      data-header-overlay
      className="-mt-(--header-h) flex min-h-[120svh] items-center justify-center bg-neutral-950 px-4 pt-(--header-h) text-white"
    >
      <h1 className="text-4xl font-semibold tracking-tight">{brand.name}</h1>
    </section>
  );
}
