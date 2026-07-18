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

  return (
    <div className="flex h-full w-full">
      <div className={`${conversationOpen ? "hidden lg:flex" : "flex"} w-full lg:w-auto`}>
        {list}
      </div>
      <div className={`${conversationOpen ? "flex" : "hidden lg:flex"} flex-1 overflow-hidden`}>
        {children}
      </div>
    </div>
  );
}
