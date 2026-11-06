import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { recordOutboundMessage } from "@/lib/messaging/record";
import { toPublicUrl } from "@/lib/supabase/config";
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendMediaMessage } from "@/lib/whatsapp/graph";
import { textoParaVoz } from "@/lib/ai/voz-texto";

const execFileAsync = promisify(execFile);

/** La llave vive en el servidor, no en la base. Sin ella el agente solo escribe. */
export function vozDisponible(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** Convierte el texto en voz. eleven_multilingual_v2 es el modelo con mejor español. */
export async function generarAudioMp3(texto: string, vozId: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vozId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "content-type": "application/json", "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
    body: JSON.stringify({ text: texto, model_id: "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs respondió ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** WhatsApp muestra como nota de voz solo el audio OGG con codec Opus. */
async function aNotaDeVoz(mp3: Buffer): Promise<Buffer> {
  const base = path.join(tmpdir(), `voz-${randomUUID()}`);
  const entrada = `${base}.mp3`;
  const salida = `${base}.ogg`;
  try {
    await writeFile(entrada, mp3);
    await execFileAsync("ffmpeg", ["-y", "-i", entrada, "-vn", "-ac", "1", "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", salida]);
    return await readFile(salida);
  } finally {
    await Promise.all([unlink(entrada).catch(() => {}), unlink(salida).catch(() => {})]);
  }
}

/**
 * Genera y envia una nota de voz. Devuelve false si no se pudo, y quien llama manda
 * el mismo contenido por escrito: el cliente nunca se queda sin respuesta por el audio.
 */
export async function enviarNotaDeVoz(
  supabase: ReturnType<typeof createAdminClient>,
  d: {
    workspaceId: string;
    conversationId: string;
    cuenta: { phone_number_id: string; access_token: string };
    waId: string;
    audio: string;
    vozId: string;
  }
): Promise<boolean> {
  const texto = textoParaVoz(d.audio);
  if (!texto || !vozDisponible()) return false;
  try {
    const nota = await aNotaDeVoz(await generarAudioMp3(texto, d.vozId));

    // Con la llave de servicio: el flujo tambien puede correr con la sesion de un asesor.
    const { createAdminClient: clienteDeServicio } = await import("@/lib/supabase/admin");
    const admin = clienteDeServicio();
    const ruta = `${d.workspaceId}/out/voz-${randomUUID()}.ogg`;
    const { error } = await admin.storage.from("chat-media").upload(ruta, nota, { contentType: "audio/ogg" });
    if (error) throw new Error(error.message);
    const url = toPublicUrl(admin.storage.from("chat-media").getPublicUrl(ruta).data.publicUrl);

    const enviado = await sendMediaMessage(d.cuenta.phone_number_id, d.cuenta.access_token, d.waId, "audio", { link: url });
    // El guion queda como texto del mensaje: asi el agente recuerda lo que dijo.
    await recordOutboundMessage(supabase, {
      origen: "ia",
      conversationId: d.conversationId,
      messageType: "audio",
      body: texto,
      mediaUrl: url,
      mediaMimeType: "audio/ogg",
      waMessageId: enviado.messages[0]?.id,
    });
    return true;
  } catch (err) {
    console.error(`nota de voz fallida: workspace=${d.workspaceId}:`, err);
    return false;
  }
}
