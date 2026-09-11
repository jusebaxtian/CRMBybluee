import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Borra los archivos de un espacio de trabajo.
 *
 * Postgres no sabe nada de `storage`, asi que el ON DELETE CASCADE de
 * `workspaces` se lleva las filas y deja los archivos. No es hipotetico: el 11
 * de septiembre de 2026 habia diez objetos en chat-media pertenecientes a
 * espacios que ya no existian, y el bucket es publico, asi que seguian
 * abriendose con la URL.
 *
 * La pagina /eliminar-datos promete borrar "cualquier archivo (imagenes,
 * audios, documentos)" en un plazo maximo de 30 dias. Esto es lo que hace que
 * esa frase sea cierta.
 *
 * Los dos buckets con datos de un espacio llevan su id como primer segmento de
 * la ruta. `banners` no: es de la plataforma y no se toca.
 */
const BUCKETS_POR_ESPACIO = ["chat-media", "payment-proofs"] as const;

export async function eliminarArchivosDelWorkspace(
  admin: SupabaseClient,
  workspaceId: string
): Promise<{ borrados: number; errores: string[] }> {
  let borrados = 0;
  const errores: string[] = [];

  for (const bucket of BUCKETS_POR_ESPACIO) {
    // list() no es recursivo: devuelve carpetas, no lo que hay dentro. Hay que
    // bajar nivel a nivel, y las rutas tienen hasta tres
    // (<espacio>/<conversacion>/<archivo>).
    const rutas = await listarRecursivo(admin, bucket, workspaceId, errores);
    if (rutas.length === 0) continue;

    // remove() acepta lotes; se trocea para no armar peticiones enormes en un
    // espacio con miles de adjuntos.
    for (let i = 0; i < rutas.length; i += 100) {
      const lote = rutas.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(lote);
      if (error) errores.push(`${bucket}: ${error.message}`);
      else borrados += lote.length;
    }
  }

  return { borrados, errores };
}

async function listarRecursivo(
  admin: SupabaseClient,
  bucket: string,
  prefijo: string,
  errores: string[],
  profundidad = 0
): Promise<string[]> {
  // Tope de seguridad: si alguna vez las rutas se anidan mas, es mejor dejar
  // archivos sin borrar y que se note, que recorrer sin fin.
  if (profundidad > 4) return [];

  const { data, error } = await admin.storage.from(bucket).list(prefijo, { limit: 1000 });
  if (error) {
    errores.push(`${bucket}/${prefijo}: ${error.message}`);
    return [];
  }

  const rutas: string[] = [];
  for (const entrada of data ?? []) {
    const ruta = `${prefijo}/${entrada.name}`;
    // Una entrada sin metadatos es una carpeta, no un archivo.
    if (entrada.id === null) {
      rutas.push(...(await listarRecursivo(admin, bucket, ruta, errores, profundidad + 1)));
    } else {
      rutas.push(ruta);
    }
  }
  return rutas;
}
