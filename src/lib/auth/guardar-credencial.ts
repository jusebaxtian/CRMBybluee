"use client";

/**
 * Pide al navegador que guarde usuario y contraseña tras un login o registro
 * correctos (Credential Management API: Chrome, Edge, Android). Los
 * formularios llegan al servidor por accion de servidor (fetch), y ahi el
 * gestor de contraseñas no siempre detecta el envio; con esto se le pide de
 * forma explicita. En navegadores sin la API no hace nada.
 */
export async function guardarCredencial(id: string, password: string): Promise<void> {
  try {
    const w = window as unknown as {
      PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential;
    };
    if (!w.PasswordCredential || !navigator.credentials?.store) return;
    await navigator.credentials.store(new w.PasswordCredential({ id, password }));
  } catch {
    // El usuario puede rechazar el guardado; no es un error de la app.
  }
}
