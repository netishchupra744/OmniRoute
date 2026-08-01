import { randomUUID } from "node:crypto";
import { POST as postChatCompletion } from "@/app/api/v1/chat/completions/route";
import { pickApiKeyForInternalUse } from "@/lib/db/apiKeys";
import { sanitizeErrorMessage } from "@omniroute/open-sse/utils/error";

interface InternalLlmMessage {
  role: "system" | "user";
  content: string;
}

export interface InvokeInternalLlmInput {
  model: string;
  messages: InternalLlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

function extractContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown })?.message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : ""
      )
      .join("");
  }
  return null;
}

export async function invokeInternalLlm(input: InvokeInternalLlmInput): Promise<string> {
  const model = input.model.trim();
  if (!model) throw new Error("A default LLM model must be selected.");
  const internalApiKey = await pickApiKeyForInternalUse("internal-probe");
  const request = new Request("http://omniroute.internal/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OmniRoute-No-Cache": "true",
      "X-OmniRoute-Compression": "off",
      "X-Request-Id": `bijoy-plan-${randomUUID()}`,
      ...(internalApiKey ? { Authorization: `Bearer ${internalApiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 24_000,
      stream: false,
    }),
  });

  const response = await postChatCompletion(request);
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A normalized error is thrown below.
  }
  if (!response.ok) {
    const rawMessage =
      payload && typeof payload === "object"
        ? (payload as { error?: { message?: unknown } | string }).error
        : null;
    const message =
      typeof rawMessage === "string"
        ? rawMessage
        : rawMessage && typeof rawMessage === "object" && typeof rawMessage.message === "string"
          ? rawMessage.message
          : `LLM request failed with HTTP ${response.status}.`;
    throw new Error(sanitizeErrorMessage(message) || "LLM request failed.");
  }
  const content = extractContent(payload);
  if (!content?.trim()) throw new Error("The selected LLM returned no usable content.");
  return content.trim();
}
