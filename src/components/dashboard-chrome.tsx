"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { InboundMessageSound } from "@/components/inbound-message-sound";

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
};

export function DashboardChrome({
  workspaceName,
  isPlatformAdmin,
  enabledModules,
  unreadMessagesCount,
  userEmail,
  notifications,
  banner,
  children,
}: {
  workspaceName: string;
  isPlatformAdmin: boolean;
  enabledModules: string[];
  unreadMessagesCount: number;
  userEmail: string;
  notifications: Notification[];
  banner: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex bg-background">
      <InboundMessageSound />
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          workspaceName={workspaceName}
          isPlatformAdmin={isPlatformAdmin}
          enabledModules={enabledModules}
          unreadMessagesCount={unreadMessagesCount}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="flex min-h-screen w-full flex-1 flex-col overflow-x-hidden">
        {banner}
        <Topbar
          workspaceName={workspaceName}
          userEmail={userEmail}
          notifications={notifications}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
