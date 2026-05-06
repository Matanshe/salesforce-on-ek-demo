import type { Message } from "../types/message";

function pushUnique(out: string[], seen: Set<string>, value: unknown) {
  if (typeof value !== "string") return;
  const t = value.trim();
  if (!t || seen.has(t)) return;
  seen.add(t);
  out.push(t);
}

/** Pull human-readable strings from nested Agentforce / rich-message shapes. */
function collectFromUnknown(obj: unknown, out: string[], seen: Set<string>) {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  for (const key of [
    "text",
    "label",
    "title",
    "value",
    "prompt",
    "question",
    "name",
    "displayText",
    "caption",
    "description",
  ]) {
    pushUnique(out, seen, o[key]);
  }
  for (const key of ["option", "choice", "message"]) {
    collectFromUnknown(o[key], out, seen);
  }
  for (const key of ["choices", "options", "suggestions", "items", "answers", "buttons", "quickReplies"]) {
    const arr = o[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (typeof item === "string") pushUnique(out, seen, item);
      else collectFromUnknown(item, out, seen);
    }
  }
}

/**
 * Best-effort extraction of suggested / starter questions from an Agentforce message.
 * The API often puts these in `result` (array) or nested objects inside `messageParts`.
 */
export function extractAgentSuggestedReplies(message: Message): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  if (Array.isArray(message.result)) {
    for (const item of message.result) {
      if (typeof item === "string") pushUnique(out, seen, item);
      else collectFromUnknown(item, out, seen);
    }
  }

  const raw = message as unknown as Record<string, unknown>;
  const parts = raw.messageParts;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      collectFromUnknown(p, out, seen);
    }
  }

  return out.slice(0, 8);
}
