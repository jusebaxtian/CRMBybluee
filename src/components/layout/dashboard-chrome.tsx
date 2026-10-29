"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { InboundMessageSound } from "@/components/notifications/inbound-message-sound";
import { NotificationSound } from "@/components/notifications/notification-sound";
import { PushNotifications } from "@/components/notifications/push-notifications";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AvisoPantalla } from "@/components/notifications/aviso-pantalla";
import { BienvenidaTutoriales } from "@/components/tutoriales/bienvenida-tutoriales";
import type { Tutorial } from "@/components/tutoriales/biblioteca-tutoriales";

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  cta_label?: string | null;
  cta_url?: string | null;
  /** pantalla = aviso emergente a pantalla completa hasta cerrarlo (migracion 0115). */
  modo?: string | null;
};

export function DashboardChrome({
  menuEncogido = false,
  workspaceName,
  demo = null,
  workspaceRole,
  esVendedor = false,
  billingLocked = false,
  isPlatformAdmin,
  enabledModules,
  unreadMessagesCount,
  supportWhatsappNumber,
  supportWhatsappMessage,
  userEmail,
  notifications,
  tutorialesDestacados = [],
  workspaceId = null,
  planId = null,
  workspaceStatus = null,
  impersonatedOwnerId = null,
  isImpersonating = false,
  banner,
  children,
}: {
  /** Menu lateral encogido (solo iconos) en pantallas grandes; viene de la cookie. */
  menuEncogido?: boolean;
  workspaceName: string;
  /** Cuenta DEMO: dias que le quedan. null si no es demo. */
  demo?: { diasRestantes: number | null } | null;
  workspaceRole?: string | null;
  esVendedor?: boolean;
  billingLocked?: boolean;
  isPlatformAdmin: boolean;
  enabledModules: string[];
  unreadMessagesCount: number;
  supportWhatsappNumber?: string | null;
  supportWhatsappMessage?: string | null;
  userEmail: string;
  notifications: Notification[];
  tutorialesDestacados?: Tutorial[];
  workspaceId?: string | null;
  planId?: string | null;
  workspaceStatus?: string | null;
  impersonatedOwnerId?: string | null;
  isImpersonating?: boolean;
  banner: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [encogido, setEncogido] = useState(menuEncogido);
  const alternarMenu = () => {
    const nuevo = !encogido;
    setEncogido(nuevo);
    document.cookie = `menu_encogido=${nuevo ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };
  // Avisos emergentes pendientes (no se muestran en modo soporte para no
  // "leerselos" al cliente).
  const avisos = isImpersonating ? [] : notifications.filter((n) => n.modo === "pantalla" && !n.read);

  return (
    <div className="flex bg-background">
      <InboundMessageSound
        workspaceId={workspaceId}
        isPlatformAdmin={isPlatformAdmin}
        isImpersonating={isImpersonating}
      />
      <NotificationSound
        esDemo={!!demo}
        workspaceId={workspaceId}
        planId={planId}
        workspaceStatus={workspaceStatus}
      />
      <PushNotifications sinLeer={unreadMessagesCount} />
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
          demo={demo}
          workspaceRole={workspaceRole}
          esVendedor={esVendedor}
          encogido={encogido}
          onAlternar={alternarMenu}
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
        {avisos.length > 0 && <AvisoPantalla avisos={avisos} />}
        {!isImpersonating && avisos.length === 0 && <BienvenidaTutoriales destacados={tutorialesDestacados} />}
        {banner}
        <Topbar
          workspaceName={workspaceName}
          demo={demo}
          userEmail={userEmail}
          notifications={notifications}
          workspaceId={workspaceId}
          impersonatedOwnerId={impersonatedOwnerId}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 p-4 pb-20 font-dash-ui sm:p-5 sm:pb-20 lg:pb-5">{children}</main>
        <MobileBottomNav
          workspaceRole={workspaceRole}
          esVendedor={esVendedor}
          billingLocked={billingLocked}
          enabledModules={enabledModules}
          unreadMessagesCount={unreadMessagesCount}
        />
      </div>
    </div>
  );
}
