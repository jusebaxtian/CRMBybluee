"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { InboundMessageSound } from "@/components/inbound-message-sound";
import { NotificationSound } from "@/components/notification-sound";
import { PushNotifications } from "@/components/push-notifications";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  cta_label?: string | null;
  cta_url?: string | null;
};

export function DashboardChrome({
  workspaceName,
  workspaceRole,
  billingLocked = false,
  isPlatformAdmin,
  enabledModules,
  unreadMessagesCount,
  supportWhatsappNumber,
  supportWhatsappMessage,
  userEmail,
  notifications,
  workspaceId = null,
  planId = null,
  workspaceStatus = null,
  impersonatedOwnerId = null,
  isImpersonating = false,
  banner,
  children,
}: {
  workspaceName: string;
  workspaceRole?: string | null;
  billingLocked?: boolean;
  isPlatformAdmin: boolean;
  enabledModules: string[];
  unreadMessagesCount: number;
  supportWhatsappNumber?: string | null;
  supportWhatsappMessage?: string | null;
  userEmail: string;
  notifications: Notification[];
  workspaceId?: string | null;
  planId?: string | null;
  workspaceStatus?: string | null;
  impersonatedOwnerId?: string | null;
  isImpersonating?: boolean;
  banner: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex bg-background">
      <InboundMessageSound
        workspaceId={workspaceId}
        isPlatformAdmin={isPlatformAdmin}
        isImpersonating={isImpersonating}
      />
      <NotificationSound
        workspaceId={workspaceId}
        planId={planId}
        workspaceStatus={workspaceStatus}
      />
      <PushNotifications />
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          workspaceName={workspaceName}
          workspaceRole={workspaceRole}
          billingLocked={billingLocked}
          isPlatformAdmin={isPlatformAdmin}
          enabledModules={enabledModules}
          unreadMessagesCount={unreadMessagesCount}
          supportWhatsappNumber={supportWhatsappNumber}
          supportWhatsappMessage={supportWhatsappMessage}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="flex min-h-screen w-full flex-1 flex-col overflow-x-hidden">
        {banner}
        <Topbar
          workspaceName={workspaceName}
          userEmail={userEmail}
          notifications={notifications}
          workspaceId={workspaceId}
          impersonatedOwnerId={impersonatedOwnerId}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 p-4 pb-20 sm:p-5 sm:pb-20 lg:pb-5">{children}</main>
        <MobileBottomNav
          workspaceRole={workspaceRole}
          billingLocked={billingLocked}
          enabledModules={enabledModules}
          unreadMessagesCount={unreadMessagesCount}
        />
      </div>
    </div>
  );
}
