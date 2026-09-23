"use client";

import { useEffect, useRef, useState } from "react";
import { registerLiveRegion } from "./useAnnounce";

/**
 * The app's two ARIA live regions, mounted once. Everything routed through
 * `useAnnounce` lands here.
 *
 * Two regions, not one: `polite` waits for a pause, `assertive` interrupts,
 * and an element's politeness cannot be changed after the fact in a way
 * screen readers reliably pick up.
 *
 * Each message is cleared and then set on the next frame. A region whose text
 * does not change is not re-announced, so without the clear the same message
 * twice in a row ("5 tracks removed", then "5 tracks removed") would be
 * spoken once.
 */
export function LiveRegion() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const framesRef = useRef<number[]>([]);

  useEffect(() => {
    const unregister = registerLiveRegion((message, isAssertive) => {
      const set = isAssertive ? setAssertive : setPolite;
      set("");
      const frame = requestAnimationFrame(() => {
        framesRef.current = framesRef.current.filter((id) => id !== frame);
        set(message);
      });
      framesRef.current.push(frame);
    });

    return () => {
      unregister();
      for (const frame of framesRef.current) cancelAnimationFrame(frame);
      framesRef.current = [];
    };
  }, []);

  return (
    <>
      <div id="app-live-region" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div
        id="app-live-region-assertive"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertive}
      </div>
    </>
  );
}
