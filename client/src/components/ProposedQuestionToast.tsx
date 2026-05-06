/** Fixed toast shown while waiting to auto-send the customer proposed question. */
export function ProposedQuestionToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
