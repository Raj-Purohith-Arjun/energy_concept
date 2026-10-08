"use client";

import { useEffect, useRef, useState } from "react";
import type { BlackGiantContent } from "@/lib/schemas";

// Second approved "use client" island (Phase D, flagged in the plan). The
// poster <Image> underneath is server-rendered and is the LCP element; this
// component only ever adds the video on top of it, and only:
//   - after window `load` plus an idle callback,
//   - when neither prefers-reduced-motion nor Save-Data is set,
//   - playing only while on screen and the tab is visible.
// Until then there is no <video> element at all, so nothing can be fetched.

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

interface HeroVideoProps {
  video: BlackGiantContent["video"];
}

function prefersNoVideo(): boolean {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as NavigatorWithConnection).connection?.saveData === true;
  return reducedMotion || saveData;
}

export function HeroVideo({ video }: HeroVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [attached, setAttached] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [blocked, setBlocked] = useState(false);

  // 1. Attach after load + idle, unless the visitor asked for less motion/data.
  useEffect(() => {
    if (prefersNoVideo()) return;
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const attach = () => setAttached(true);
    const schedule = () => {
      // Safari has no requestIdleCallback; a zero-delay task after load is the fallback.
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(attach, { timeout: 3000 });
      }
      else timeoutId = window.setTimeout(attach, 0);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    // Turning reduced motion on mid-visit removes the video entirely.
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (motion.matches) setAttached(false);
    };
    motion.addEventListener("change", onMotionChange);

    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  // 2. Track whether the hero is on screen and the tab is visible.
  useEffect(() => {
    const el = ref.current;
    if (!attached || !el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.25,
    });
    observer.observe(el);
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.pause();
    };
  }, [attached]);

  // 3. Play only when attached, on screen, tab visible and not paused by the user.
  useEffect(() => {
    const el = ref.current;
    if (!attached || !el) return;
    if (inView && tabVisible && !userPaused) {
      el.muted = true; // required for autoplay policies, set as a property too
      el.play().catch((error: unknown) => {
        // A pause() interrupting play() is expected; anything else (autoplay
        // blocked, decode failure) leaves the poster in place.
        if (!(error instanceof DOMException && error.name === "AbortError")) setBlocked(true);
      });
    } else {
      el.pause();
    }
  }, [attached, inView, tabVisible, userPaused]);

  if (!attached || blocked) return null;

  return (
    <>
      <video
        ref={ref}
        muted
        playsInline
        loop
        preload="none"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        data-playing={playing}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 data-[playing=true]:opacity-100"
      >
        {video.sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>
      <button
        type="button"
        onClick={() => setUserPaused((paused) => !paused)}
        aria-label={userPaused ? video.play : video.pause}
        className="absolute right-3 bottom-3 z-20 flex size-11 items-center justify-center rounded-full bg-black/70 text-white"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          {userPaused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
        </svg>
      </button>
    </>
  );
}
