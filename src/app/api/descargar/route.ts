import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, SUPABASE_SERVER_URL } from "@/lib/supabase/config";

/**
 * Descarga de adjuntos del chat con nombre de archivo.
 *
 * Los adjuntos viven en storage (otro origen), asi que el atributo
 * `download` del navegador no aplica y el archivo se abria en una pestaña.
 * Esta ruta lo sirve con Content-Disposition: attachment. Solo acepta URLs
 * del bucket chat-media de este Supabase y exige sesion iniciada.
 */
const PREFIJO_PUBLICO = `${SUPABASE_URL}/storage/v1/object/public/chat-media/`;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  const nombre = (request.nextUrl.searchParams.get("nombre") ?? "").replace(/[\r\n"]/g, "").slice(0, 150);

  if (!url.startsWith(PREFIJO_PUBLICO)) {
    return NextResponse.json({ error: "URL no permitida." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  // El servidor lee por la red interna cuando esta configurada (mas rapido).
  const interna = url.replace(SUPABASE_URL, SUPABASE_SERVER_URL);
  const origen = await fetch(interna);
  if (!origen.ok || !origen.body) {
    return NextResponse.json({ error: "El archivo ya no está disponible." }, { status: 404 });
  }

  const nombreFinal = nombre || decodeURIComponent(url.split("/").pop() ?? "archivo");
  const headers = new Headers();
  headers.set("Content-Type", origen.headers.get("content-type") ?? "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nombreFinal)}`);
  const largo = origen.headers.get("content-length");
  if (largo) headers.set("Content-Length", largo);
  headers.set("Cache-Control", "private, max-age=0");

  return new NextResponse(origen.body, { status: 200, headers });
}
