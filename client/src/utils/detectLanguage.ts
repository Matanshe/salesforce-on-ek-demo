/**
 * Detects language from user message text for agent selection.
 * Returns ISO 639-1 code: "en" (English) or "de" (German).
 * Used to choose the correct agent from the first message in the conversation.
 * Prefers English unless there is clear German signal (umlauts or multiple German words).
 */
export function detectLanguage(text: string | null | undefined): "en" | "de" {
  const raw = (text ?? "").trim();
  if (!raw) return "en";

  const lower = raw.toLowerCase();

  // Strong German signal: umlauts or ß
  if (/[äöüß]/.test(lower)) return "de";

  // Common English words – if present, prefer English (avoids "die"/"was" etc. flipping to German)
  const englishWords =
    /\b(the|and|for|are|but|not|you|all|can|had|her|his|was|one|our|out|day|get|has|him|how|man|new|now|old|see|way|who|boy|did|its|let|put|say|she|too|use|what|when|where|which|help|this|that|with|from|have|been|were|they|their|there|will|your|would|could|should|about|into|some|more|than|then|them|these|those)\b/i;
  if (englishWords.test(lower)) return "en";

  // German words that are unlikely in English (exclude "die"/"was"/"von" which can be ambiguous)
  const germanWords =
    /\b(und|der|das|ist|sind|nicht|für|mit|auf|wie|wer|wann|wo|warum|kann|muss|haben|können|wird|wurde|diese|dieser|dieses|alle|auch|noch|schon|sehr|nur|bei|nach|zum|zur)\b/i;
  const germanMatches = lower.match(germanWords);
  const germanCount = germanMatches ? germanMatches.length : 0;
  // Require at least 2 German word matches to avoid single-word false positives
  if (germanCount >= 2) return "de";

  return "en";
}

/** Browser UI language for session start when no message text is available (e.g. Start New Session). */
export function getBrowserLanguage(): "en" | "de" {
  const lang = typeof navigator !== "undefined" ? navigator.language?.toLowerCase() : "";
  return lang?.startsWith("de") ? "de" : "en";
}
