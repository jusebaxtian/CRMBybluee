import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RECUPERACION_POR_CORREO, RECUPERACION_POR_WHATSAPP } from "@/lib/auth/telefono";

// La ruta existe si hay alguna via de recuperacion activa. Hoy es la de
// WhatsApp; la de correo sigue apagada por no tener SMTP.
export default function Layout({ children }: { children: ReactNode }) {
  if (!RECUPERACION_POR_CORREO && !RECUPERACION_POR_WHATSAPP) notFound();
  return children;
}
