import type { Message } from "../types/message";
import { extractAgentSuggestedReplies } from "./extractAgentSuggestedReplies";

type AgentMsg = {
  message?: string;
  messageParts?: Array<{ type?: string; text?: string }>;
} | null | undefined;

/**
 * Display text from an Agentforce API message (.message or joined .messageParts text).
 * When the agent returns starter questions only in `result` (not in the main string), append them
 * as bullet lines so the chat bubble matches older inline behavior.
 */
export function getAgentMessageText(msg: AgentMsg, fallback: string): string {
  let base = fallback;
  try {
    if (msg && typeof msg === "object") {
      if (typeof msg.message === "string" && msg.message.trim()) {
        base = msg.message;
      } else if (Array.isArray(msg.messageParts)) {
        const text = msg.messageParts
          .map((p) =>
            p && typeof p === "object" && typeof (p as { text?: string }).text === "string" ? (p as { text: string }).text : ""
          )
          .join("");
        if (typeof text === "string" && text.trim()) base = text;
      }
    }
  } catch {
    // keep base
  }

  const hybrid = {
    ...(msg && typeof msg === "object" ? msg : {}),
    content: base,
    sender: "bot" as const,
    id: "tmp",
    timestamp: new Date(),
  } as Message;

  const suggestions = extractAgentSuggestedReplies(hybrid);
  const extras = suggestions.filter((s) => s && !base.includes(s));
  if (extras.length === 0) return base;
  return `${base.trimEnd()}\n\n${extras.map((s) => `• ${s}`).join("\n")}`;
}
