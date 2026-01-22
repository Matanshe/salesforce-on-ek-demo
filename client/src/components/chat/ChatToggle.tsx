interface ChatToggleProps {
  onClick: () => void;
}

export const ChatToggle = ({ onClick }: ChatToggleProps) => {
  return (
    <button
      onClick={onClick}
      className="w-14 h-14 sm:w-16 sm:h-16 bg-[#0176D3] text-white rounded-full shadow-lg hover:bg-[#014486] hover:shadow-xl transition-all flex items-center justify-center group fixed bottom-4 right-4 sm:static"
      aria-label="Open chat"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 w-7 sm:h-8 sm:w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#2E844A] rounded-full border-2 border-white"></div>
    </button>
  );
};
