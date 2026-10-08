import Image from "next/image";
import poster from "@/assets/black-giant-poster.jpg";
import { getBlackGiant } from "@/lib/content";
import { HeroVideo } from "./HeroVideo";

// Fixed-height box, so nothing moves when the video fades in over the poster.
// The poster is the one preloaded image on the page and the LCP element.
export function Hero() {
  const { heading, lead, poster: posterCopy, placeholderLabel, video } = getBlackGiant();
  return (
    <section className="relative isolate h-[60svh] max-h-[44rem] min-h-80 overflow-hidden bg-neutral-950 text-white">
      <Image
        src={poster}
        alt={posterCopy.alt}
        fill
        preload
        sizes="100vw"
        className="object-cover"
      />
      <HeroVideo video={video} />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
      <p className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded bg-black/75 px-2 py-1 text-xs">
        {placeholderLabel}
      </p>
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-end px-4 pb-16 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{heading}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-white/90">{lead}</p>
      </div>
    </section>
  );
}
