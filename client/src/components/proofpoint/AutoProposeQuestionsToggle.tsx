type Variant = "on-dark" | "on-light";

interface AutoProposeQuestionsToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  variant?: Variant;
}

/**
 * Highlighted (on) state runs auto-proposed questions via useCustomerProposedQuestionAutoSend.
 */
export function AutoProposeQuestionsToggle({
  enabled,
  onChange,
  variant = "on-dark",
}: AutoProposeQuestionsToggleProps) {
  const styles =
    variant === "on-dark"
      ? enabled
        ? "border-[#66CC33] bg-[#66CC33]/25 text-white shadow-[inset_0_0_0_1px_rgba(102,204,51,0.35)]"
        : "border-white/25 bg-white/5 text-white/80 hover:bg-white/10"
      : enabled
        ? "border-[#66CC33] bg-[#66CC33]/15 text-slate-900 shadow-sm"
        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Auto propose questions based on customer content"
      onClick={() => onChange(!enabled)}
      className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${styles}`}
    >
      Auto propose questions
    </button>
  );
}
