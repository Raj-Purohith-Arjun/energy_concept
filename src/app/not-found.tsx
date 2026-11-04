import type { Metadata } from "next";
import Link from "next/link";
import { getSite } from "@/lib/content";

export const metadata: Metadata = {
  title: getSite().notFound.title,
};

export default function NotFound() {
  const { notFound, brand } = getSite();
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-4 py-24">
      <h1 className="h-page">{notFound.heading}</h1>
      <Link href={brand.homeHref} className="inline-flex min-h-11 items-center underline underline-offset-4">
        {notFound.homeLabel}
      </Link>
    </section>
  );
}
