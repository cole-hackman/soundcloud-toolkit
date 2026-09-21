"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";
import {
  PREVIOUS_PRODUCT_NAME,
  PRODUCT_NAME,
  REBRAND_STATE_EVENT,
  dismissRebrandBanner,
  isRebrandBannerDismissed,
} from "@/lib/rebrand";

/**
 * Site-wide rebrand notice, sticky at the top of every page.
 *
 * Layout contract: the banner sits in normal flow (so nothing has to be padded
 * out of its way) and publishes its measured height as `--announcement-h` on
 * the document element. The two `position: fixed` headers that would otherwise
 * sit underneath it — the landing nav and the app's mobile header — read that
 * variable as their `top`. The variable is defined as `0px` in globals.css, so
 * both are correct before this mounts and again after it is dismissed.
 *
 * z-40 is deliberate: above ordinary page content, below the mobile drawer
 * (z-50) and every modal (z-70), which are meant to cover the whole viewport.
 */

const OFFSET_VAR = "--announcement-h";

export function RebrandBanner() {
  // Never render during the static-export prerender: the dismissal lives in
  // localStorage, so server output would flash a banner the user has already
  // dismissed. Mounting decides it instead.
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setVisible(!isRebrandBannerDismissed());
    sync();
    // Acknowledging the modal settles the banner too, and that happens in a
    // different component; without this the strip would linger until reload.
    window.addEventListener(REBRAND_STATE_EVENT, sync);
    return () => window.removeEventListener(REBRAND_STATE_EVENT, sync);
  }, []);

  // Publish the height, and keep it right when the text wraps to two lines on
  // a narrow screen or the window is resized.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!visible || !el) {
      root.style.setProperty(OFFSET_VAR, "0px");
      return;
    }

    const publish = () => {
      root.style.setProperty(OFFSET_VAR, `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty(OFFSET_VAR, "0px");
    };
  }, [visible]);

  const handleDismiss = useCallback(() => {
    dismissRebrandBanner();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Site announcement"
      className="sticky top-0 z-40 border-b border-primary/25 bg-primary/10 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6">
        <Megaphone
          className="hidden h-4 w-4 shrink-0 text-primary sm:block"
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground sm:text-sm">
          <span className="font-semibold">
            {PREVIOUS_PRODUCT_NAME} is now {PRODUCT_NAME}.
          </span>{" "}
          <span className="text-muted-foreground">
            Same tools, same account — just a new name.
          </span>
        </p>
        <Link
          href="/faq/#rebrand"
          className="shrink-0 whitespace-nowrap text-xs font-medium text-foreground underline underline-offset-2 transition hover:text-primary sm:text-sm"
        >
          Read the FAQ
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default RebrandBanner;
