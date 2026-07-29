"use client";

import { usePathname } from "next/navigation";

export function InboxShell({
  list,
  children,
}: {
  list: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const conversationOpen = pathname !== "/dashboard/inbox";

  // The mobile bottom nav is hidden while a conversation is open full-screen
  // (see MobileBottomNav), so only the list view needs its height reduced to
  // make room for it.
  const heightClass = conversationOpen
    ? "h-[calc(100vh-3.75rem)] sm:h-[calc(100vh-4rem)]"
    : "h-[calc(100vh-3.75rem-3.5rem)] sm:h-[calc(100vh-4rem-3.5rem)] lg:h-[calc(100vh-4rem)]";

  return (
    <div className={`flex w-full ${heightClass}`}>
      <div className={`${conversationOpen ? "hidden lg:flex" : "flex"} w-full lg:w-auto`}>
        {list}
      </div>
      <div className={`${conversationOpen ? "flex" : "hidden lg:flex"} flex-1 overflow-hidden`}>
        {children}
      </div>
    </div>
  );
}
