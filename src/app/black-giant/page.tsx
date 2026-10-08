import type { Metadata } from "next";
import { Hero } from "@/components/black-giant/Hero";
import { DeliveryNotes, KeyFacts } from "@/components/black-giant/KeyFacts";
import { getBlackGiant } from "@/lib/content";

export const metadata: Metadata = {
  title: getBlackGiant().title,
};

// Phase D: the performance proof. Fully static; the only client code is the
// deferred hero video and the site-wide mobile menu.
export default function BlackGiantPage() {
  return (
    <>
      <Hero />
      <KeyFacts />
      <DeliveryNotes />
    </>
  );
}
