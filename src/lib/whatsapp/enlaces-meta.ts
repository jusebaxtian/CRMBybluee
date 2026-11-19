/**
 * Enlaces directos al Administrador de WhatsApp de Meta para una cuenta (WABA)
 * conectada (19 nov 2026). Abren la cuenta en business.facebook.com: ahi se ve
 * el estado, la calidad, el perfil (foto, descripcion), las plantillas y las
 * estadisticas. Solo funcionan con un Facebook que tenga acceso a esa cuenta.
 */
export type EnlaceMeta = { clave: string; texto: string; ayuda: string; url: string };

const BASE = "https://business.facebook.com/wa/manage";

export function enlacesDelAdministrador(wabaId: string): EnlaceMeta[] {
  const id = encodeURIComponent(wabaId.trim());
  if (!id) return [];
  const url = (ruta: string) => `${BASE}/${ruta}/?waba_id=${id}`;
  return [
    { clave: "resumen", texto: "Resumen de la cuenta", ayuda: "Estado, calidad y límites", url: url("home") },
    { clave: "numeros", texto: "Números y perfil", ayuda: "Foto, descripción, nombre visible", url: url("phone-numbers") },
    { clave: "plantillas", texto: "Plantillas", ayuda: "Crear y revisar plantillas", url: url("message-templates") },
    { clave: "estadisticas", texto: "Estadísticas", ayuda: "Mensajes enviados, entregados y costos", url: url("insights") },
  ];
}
