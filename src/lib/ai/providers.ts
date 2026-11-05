import OpenAI, { toFile } from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function callOpenAi(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatTurn[]
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 500,
    messages: [{ role: "system", content: systemPrompt }, ...history],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatTurn[]
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model,
    max_tokens: 500,
    system: systemPrompt,
    messages: history,
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text.trim() : "";
}

export type MimeDeImagen = "image/jpeg" | "image/png" | "image/webp";

/**
 * Le muestra una imagen al modelo y devuelve su texto. Con limite de tiempo: una
 * imagen que no se deja leer no debe quedarse esperando los 10 minutos por defecto.
 */
export async function leerImagenConIa(
  provider: "openai" | "anthropic",
  apiKey: string,
  model: string,
  imagen: { base64: string; mime: MimeDeImagen },
  instruccion: string
): Promise<string> {
  const opciones = { apiKey, timeout: 30_000, maxRetries: 1 };
  if (provider === "openai") {
    const completion = await new OpenAI(opciones).chat.completions.create({
      model,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruccion },
            { type: "image_url", image_url: { url: `data:${imagen.mime};base64,${imagen.base64}` } },
          ],
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  }
  const message = await new Anthropic(opciones).messages.create({
    model,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imagen.mime, data: imagen.base64 } },
          { type: "text", text: instruccion },
        ],
      },
    ],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text.trim() : "";
}

// Whisper transcription only exists on OpenAI — used to give the AI (and
// the inbox) a text version of a voice note. Only called when the workspace
// has an OpenAI key connected, using that same key.
export async function transcribeAudio(
  apiKey: string,
  audioBlob: Blob,
  filename: string
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const file = await toFile(audioBlob, filename);
  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "es",
  });
  return transcription.text.trim();
}

export async function callAiProvider(
  provider: "openai" | "anthropic",
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatTurn[]
): Promise<string> {
  return provider === "openai"
    ? callOpenAi(apiKey, model, systemPrompt, history)
    : callClaude(apiKey, model, systemPrompt, history);
}
