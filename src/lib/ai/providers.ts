import OpenAI from "openai";
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
