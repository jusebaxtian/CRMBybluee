import {
  LayoutDashboard,
  Bell,
  CreditCard,
  Package,
  Image as ImageIcon,
  LifeBuoy,
  MessageSquare,
  PlaySquare,
  HeartHandshake,
  BellRing,
  Handshake,
} from "lucide-react";

/** Opciones del panel admin. Las usan el menu lateral (escritorio) y el menu del celular. */
export const OPCIONES_ADMIN = [
  { href: "/admin", etiqueta: "Workspaces", Icono: LayoutDashboard },
  { href: "/admin/notifications", etiqueta: "Notificaciones", Icono: Bell },
  { href: "/admin/avisos-celular", etiqueta: "Avisos del celular", Icono: BellRing },
  { href: "/admin/payments", etiqueta: "Pagos", Icono: CreditCard },
  { href: "/admin/vendedores", etiqueta: "Vendedores", Icono: Handshake },
  { href: "/admin/plans", etiqueta: "Planes", Icono: Package },
  { href: "/admin/whatsapp", etiqueta: "WhatsApp Admin", Icono: MessageSquare },
  { href: "/admin/fidelidad", etiqueta: "Plan de fidelidad", Icono: HeartHandshake },
  { href: "/admin/banner", etiqueta: "Banner", Icono: ImageIcon },
  { href: "/admin/tutoriales", etiqueta: "Capacitaciones", Icono: PlaySquare },
  { href: "/admin/support", etiqueta: "Ayuda / Soporte", Icono: LifeBuoy },
] as const;
