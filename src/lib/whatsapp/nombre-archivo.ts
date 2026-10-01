/**
 * El nombre con el que se subio un archivo, sacado de su URL.
 *
 * WhatsApp muestra los documentos con el `filename` que se le manda en el
 * envio. Si no se le manda ninguno, el cliente ve "Sin titulo" -- le paso a
 * tienda Zelika con su catalogo en PDF: el archivo se llamaba
 * "Catalogo Joyero.pdf" y a sus clientes les llegaba sin nombre.
 *
 * No hace falta guardar el nombre en otra columna: al subir el archivo se
 * conserva dentro de la ruta, con una marca de tiempo por delante para que dos
 * archivos iguales no se pisen:
 *
 *   .../templates/1790529418661-Catalogo%20Joyero.pdf  ->  "Catalogo Joyero.pdf"
 */
export function nombreDeArchivoDeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const sinParametros = url.split("?")[0].split("#")[0];
  const ultimo = sinParametros.split("/").pop();
  if (!ultimo) return null;

  let nombre: string;
  try {
    nombre = decodeURIComponent(ultimo);
  } catch {
    // Una URL mal codificada no debe tumbar un envio: se usa tal cual.
    nombre = ultimo;
  }

  // Quita la marca de tiempo que antepone la subida (13 digitos y un guion).
  nombre = nombre.replace(/^\d{10,}-/, "").trim();

  return nombre || null;
}

/** El nombre guardado si existe y, si no, el que diga la URL. */
export function nombreDeDocumento(
  guardado: string | null | undefined,
  url: string | null | undefined
): string | undefined {
  const limpio = guardado?.trim();
  if (limpio) return limpio;
  return nombreDeArchivoDeUrl(url) ?? undefined;
}
