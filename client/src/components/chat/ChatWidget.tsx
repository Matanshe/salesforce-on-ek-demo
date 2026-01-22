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
}: ChatWidgetProps) => {
  if (minimized) {
    return (
      <div className="h-full flex flex-col">
        <ChatWindow
          messages={messages}
          onMessageClick={onMessageClick}
          onSendMessage={onSendMessage}
          onDeleteSession={onDeleteSession}
          onStartNewSession={onStartNewSession}
          sessionInitialized={sessionInitialized}
          isLoading={isLoading}
          onClose={() => {}}
          embedded={false}
          minimized={true}
          fetchingHudmoFor={fetchingHudmoFor}
          prefetchedHudmoData={prefetchedHudmoData}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:max-w-none pointer-events-none">
      {isOpen ? (
        <div className="pointer-events-auto">
          <ChatWindow
            messages={messages}
            onMessageClick={onMessageClick}
            onSendMessage={onSendMessage}
            onDeleteSession={onDeleteSession}
            onStartNewSession={onStartNewSession}
            sessionInitialized={sessionInitialized}
            isLoading={isLoading}
            onClose={onToggle}
            embedded={false}
            minimized={false}
            fetchingHudmoFor={fetchingHudmoFor}
            prefetchedHudmoData={prefetchedHudmoData}
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
