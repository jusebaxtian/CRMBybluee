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
