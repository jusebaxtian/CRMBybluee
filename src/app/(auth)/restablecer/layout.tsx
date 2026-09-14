import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RECUPERACION_POR_CORREO } from "@/lib/auth/telefono";

// La recuperacion por correo esta apagada (sin SMTP): la ruta no existe
// hasta que se active. Ver RECUPERACION_POR_CORREO.
export default function Layout({ children }: { children: ReactNode }) {
  if (!RECUPERACION_POR_CORREO) notFound();
  return children;
}
