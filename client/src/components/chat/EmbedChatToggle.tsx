import agentforceLogo from "../../assets/agentforce_logo.webp";

interface EmbedChatToggleProps {
  onClick: () => void;
}

export function EmbedChatToggle({ onClick }: EmbedChatToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-14 h-14 sm:w-16 sm:h-16 bg-[var(--theme-primary)] text-white rounded-full shadow-lg hover:bg-[var(--theme-primary-hover)] hover:shadow-xl hover:scale-105 active:scale-100 transition-all flex items-center justify-center border-2 border-white focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:ring-offset-2"
      aria-label="Open Agentforce chat"
    >
      <img
        src={agentforceLogo}
        alt="Agentforce"
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
      />
      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[var(--theme-accent)] rounded-full border-2 border-white" aria-hidden />
    </button>
  );
}
