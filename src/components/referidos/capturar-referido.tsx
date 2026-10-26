"use client";

import { useEffect } from "react";

/**
 * Guarda el codigo de ?ref= por 30 dias para que la persona se pueda registrar
 * despues (o con Google, que da la vuelta por otra pagina) y el referido igual
 * quede anotado. El servidor valida el codigo al crear la cuenta.
 */
export function CapturarReferido() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9]{6,12}$/.test(ref)) {
        document.cookie = `bbl_ref=${ref.toUpperCase()}; max-age=${30 * 86400}; path=/; SameSite=Lax`;
      }
    } catch {
      /* sin cookies: el registro sigue igual, solo no se anota el referido */
    }
  }, []);
  return null;
}
