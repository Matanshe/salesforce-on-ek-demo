import type { ChatWidgetProps } from "../../types/message";
import { ChatWindow } from "./ChatWindow";
import { ChatToggle } from "./ChatToggle";

export const ChatWidget = ({
  messages,
  onMessageClick,
  onSendMessage,
  onDeleteSession,
  onStartNewSession,
  sessionInitialized,
  isLoading,
  isOpen,
  onToggle,
  minimized = false,
  fetchingHudmoFor = new Set(),
  prefetchedHudmoData = new Map(),
  citationBehavior,
  chunkPreviewByMessageId,
  onHoverCitation,
}: ChatWidgetProps) => {
  const chatWindowProps = {
    messages,
    onMessageClick,
    onSendMessage,
    onDeleteSession,
    onStartNewSession,
    sessionInitialized,
    isLoading,
    fetchingHudmoFor,
    prefetchedHudmoData,
    citationBehavior,
    chunkPreviewByMessageId,
    onHoverCitation,
  };

  if (minimized) {
    return (
      <div className="h-full flex flex-col">
        <ChatWindow
          {...chatWindowProps}
          onClose={() => {}}
          embedded={false}
          minimized={true}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:max-w-none pointer-events-none">
      {isOpen ? (
        <div className="pointer-events-auto">
          <ChatWindow
            {...chatWindowProps}
            onClose={onToggle}
            embedded={false}
            minimized={false}
          />
        </div>
      ) : (
        <div className="pointer-events-auto">
          <ChatToggle onClick={onToggle} />
        </div>
      )}
    </div>
  );
};
