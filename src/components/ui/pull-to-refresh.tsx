"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 64;
const MAX_PULL = 90;

// Installed-to-homescreen mode ("standalone" in manifest.json) drops
// Safari's own bounce/pull-to-refresh gesture entirely — the app has no
// browser chrome to trigger it. This reimplements the same gesture by hand
// on any scrollable pane (conversation list, message thread) so pulling
// down at the very top still refreshes, same muscle memory as any other app.
export function PullToRefresh({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (refreshing) return;
    // Only arm the gesture when already scrolled to the very top — otherwise
    // this would hijack normal downward scrolling mid-list.
    if ((scrollRef.current?.scrollTop ?? 0) > 0) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Diminishing returns past the threshold — mirrors the native rubber-band feel.
    const eased = delta < PULL_THRESHOLD ? delta : PULL_THRESHOLD + (delta - PULL_THRESHOLD) * 0.3;
    setPullDistance(Math.min(eased, MAX_PULL));
  }

  function handleTouchEnd() {
    if (startY.current === null) return;
    const shouldRefresh = pullDistance >= PULL_THRESHOLD;
    startY.current = null;
    setPullDistance(0);
    if (!shouldRefresh) return;

    setRefreshing(true);
    router.refresh();
    // router.refresh() doesn't return a promise tied to completion — a
    // short fixed spinner gives clear feedback without guessing server timing.
    setTimeout(() => setRefreshing(false), 700);
  }

  const indicatorHeight = refreshing ? 44 : pullDistance;

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`overflow-y-auto ${className}`}
    >
      <div
        style={{ height: indicatorHeight }}
        className="flex items-center justify-center overflow-hidden text-muted transition-[height] duration-200"
      >
        {(refreshing || pullDistance > 10) && (
          <RefreshCw
            size={18}
            className={refreshing ? "animate-spin" : ""}
            style={!refreshing ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined}
          />
        )}
      </div>
      {children}
    </div>
  );
}
